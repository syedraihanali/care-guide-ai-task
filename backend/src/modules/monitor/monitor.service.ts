import { Types } from 'mongoose';
import pLimit from 'p-limit';
import { config } from '../../config/env.js';
import { thresholdsFor } from '../../config/thresholds.js';
import type { CheckSeverity, Issue, LlmMode, RunSource } from '../../domain/monitoring.js';
import { validationError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { Alert } from '../../models/alert.model.js';
import { ApiCheck, type ApiCheckAttrs } from '../../models/apiCheck.model.js';
import { MonitorRun } from '../../models/monitorRun.model.js';
import { detect } from '../../services/detector.js';
import { alertWriter, type AlertWriter, type WrittenAlertText } from '../../services/llm/alertWriter.js';
import { sendCriticalDigest } from '../../services/notifier/alertEmail.js';
import type { AlertTextRequest } from '../../services/llm/types.js';
import { applyCheck } from '../alerts/alerts.lifecycle.js';
import { normalizeBatch, parseItems, type InvalidItem, type ValidItem } from './monitor.schema.js';

/** How many APIs are processed at once. Items for the same API always run one at a time, in input order. */
const API_CONCURRENCY = 8;

export interface CheckResult {
  apiName: string;
  healthy: boolean;
  severity: CheckSeverity;
  issues: Issue[];
}

export interface MonitorResult {
  runId: string;
  received: number;
  processed: number;
  invalid: InvalidItem[];
  healthy: number;
  anomalies: number;
  alerts: { created: number; updated: number; autoResolved: number };
  llm: { mode: LlmMode; calls: number; fallbacks: number };
  durationMs: number;
  results: CheckResult[];
}

/**
 * The batch pipeline behind POST /monitor and the file CLI: validate, detect, update incidents,
 * then write alert text in LLM batches. The LLM step never fails the batch.
 */
export async function runMonitor(
  body: unknown,
  source: RunSource,
  writer: AlertWriter = alertWriter,
): Promise<MonitorResult> {
  const started = performance.now();
  const checkedAt = new Date();
  const runId = new Types.ObjectId();

  const items = normalizeBatch(body, config.monitor.maxBatchSize);
  const { valid, invalid } = parseItems(items);
  if (valid.length === 0) throw validationError('Every item in the batch is invalid', { invalid });

  const results = new Map<number, CheckResult>();
  const checks = new Map<number, ApiCheckAttrs>();
  const textRequests = new Map<string, AlertTextRequest>();
  /** New or escalated critical alerts, for the digest email. */
  const newCritical = new Set<string>();
  const alerts = { created: 0, updated: 0, autoResolved: 0 };

  const processApi = async (apiItems: readonly ValidItem[]) => {
    for (const item of apiItems) {
      const thresholds = thresholdsFor(item.apiName);
      const detection = detect(item, thresholds);
      const { apiName, healthy, severity, issues, metrics } = detection;
      results.set(item.index, { apiName, healthy, severity, issues });
      const issueTypes = [...new Set(issues.map((issue) => issue.type))];
      checks.set(item.index, { apiName, runId, metrics, healthy, severity, issueTypes, checkedAt });

      const outcome = await applyCheck(detection, thresholds, checkedAt);
      if (outcome.kind === 'created' || outcome.kind === 'updated') {
        alerts[outcome.kind] += 1;
        // A later item for the same API refreshes a pending request, so the text describes the final state.
        if (outcome.needsText || textRequests.has(outcome.textRequest.id)) {
          textRequests.set(outcome.textRequest.id, outcome.textRequest);
        }
        const becameCritical = outcome.kind === 'created' || outcome.escalated;
        if (becameCritical && outcome.alert.severity === 'critical') newCritical.add(outcome.alert.id);
      } else if (outcome.kind === 'resolved') {
        alerts.autoResolved += 1;
        textRequests.delete(outcome.alert.id);
        newCritical.delete(outcome.alert.id);
      }
    }
  };

  const limit = pLimit(API_CONCURRENCY);
  await Promise.all([...groupByApi(valid).values()].map((apiItems) => limit(() => processApi(apiItems))));

  // Inserted in input order: checks from one batch share checkedAt, and _id order then marks the latest.
  await ApiCheck.insertMany(inInputOrder(checks));

  const { texts, stats } = await writer.write([...textRequests.values()]);
  await saveGeneratedTexts(texts);
  // Not awaited: the email must neither slow nor break the batch, and it logs its own outcome.
  if (config.email.enabled && newCritical.size > 0) void sendCriticalDigest([...newCritical]);

  const ordered = inInputOrder(results);
  const healthy = ordered.filter((result) => result.healthy).length;
  const result: MonitorResult = {
    runId: runId.toString(),
    received: items.length,
    processed: valid.length,
    invalid,
    healthy,
    anomalies: valid.length - healthy,
    alerts,
    llm: { mode: stats.mode, calls: stats.calls, fallbacks: stats.fallbacks },
    durationMs: Math.round(performance.now() - started),
    results: ordered,
  };

  await MonitorRun.create({
    _id: runId,
    source,
    received: result.received,
    processed: result.processed,
    invalid,
    healthy,
    anomalies: result.anomalies,
    alerts,
    llm: stats,
    durationMs: result.durationMs,
    startedAt: checkedAt,
  });
  logger.info(
    {
      runId: result.runId,
      source,
      received: result.received,
      processed: result.processed,
      invalid: invalid.length,
      healthy,
      anomalies: result.anomalies,
      alerts,
      llm: stats,
      durationMs: result.durationMs,
    },
    'Monitor batch processed',
  );
  return result;
}

/** Groups items by API, keeping each API's items in input order. */
function groupByApi(items: readonly ValidItem[]): Map<string, ValidItem[]> {
  const groups = new Map<string, ValidItem[]>();
  for (const item of items) {
    const group = groups.get(item.apiName);
    if (group) group.push(item);
    else groups.set(item.apiName, [item]);
  }
  return groups;
}

function inInputOrder<T>(byIndex: ReadonlyMap<number, T>): T[] {
  return [...byIndex.entries()].sort(([a], [b]) => a - b).map(([, value]) => value);
}

/** Replaces the template text with the LLM's text for every alert the LLM wrote. */
async function saveGeneratedTexts(texts: ReadonlyMap<string, WrittenAlertText>): Promise<void> {
  const updates = [...texts]
    .filter(([, text]) => text.aiGenerated)
    .map(([id, { title, message, likelyCause, suggestedAction, aiModel }]) => ({
      updateOne: {
        filter: { _id: new Types.ObjectId(id) },
        update: { $set: { title, message, likelyCause, suggestedAction, aiGenerated: true, aiModel } },
      },
    }));
  if (updates.length > 0) await Alert.bulkWrite(updates);
}
