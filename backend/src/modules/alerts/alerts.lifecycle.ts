import { Types, mongo } from 'mongoose';
import { config } from '../../config/env.js';
import type { Thresholds } from '../../config/thresholds.js';
import { isMoreSevere, type AlertSeverity, type Issue } from '../../domain/monitoring.js';
import { logger } from '../../lib/logger.js';
import { Alert, type AlertDocument } from '../../models/alert.model.js';
import type { Detection } from '../../services/detector.js';
import { templateAlert } from '../../services/llm/templateAlert.js';
import type { AlertTextRequest } from '../../services/llm/types.js';

interface ChangedAlert {
  alert: AlertDocument;
  /** The alert's current facts, for the LLM writer. */
  textRequest: AlertTextRequest;
  /** True when the alert is new, or its issue types changed, or its severity escalated. */
  needsText: boolean;
}

export type LifecycleOutcome =
  | { kind: 'unchanged' }
  | ({ kind: 'created' } & ChangedAlert)
  | ({ kind: 'updated'; escalated: boolean } & ChangedAlert)
  | { kind: 'resolved'; alert: AlertDocument };

/** A concurrent batch can open or resolve the same API's alert between our read and write; then we read again. */
const MAX_ATTEMPTS = 3;

/**
 * Applies one check to its API's incident (one active alert per API):
 * anomalous with no active alert opens one, anomalous with one updates it, healthy resolves it.
 */
export async function applyCheck(detection: Detection, thresholds: Thresholds, now: Date): Promise<LifecycleOutcome> {
  if (detection.healthy) return resolveRecovered(detection.apiName, now);

  const severity: AlertSeverity = detection.severity === 'critical' ? 'critical' : 'warning';
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const active = await Alert.findOne({ apiName: detection.apiName, status: 'active' });
    const outcome = active
      ? await updateIncident(active, detection, severity, thresholds, now)
      : await openIncident(detection, severity, thresholds, now);
    if (outcome) return outcome;
  }
  throw new Error(`Could not record the anomaly for ${detection.apiName}: its alert kept changing concurrently`);
}

/** Returns null when another batch opened the API's alert first. */
async function openIncident(
  detection: Detection,
  severity: AlertSeverity,
  thresholds: Thresholds,
  now: Date,
): Promise<LifecycleOutcome | null> {
  const id = new Types.ObjectId();
  const textRequest = toTextRequest(id.toString(), detection, severity, 1, thresholds);
  try {
    const alert = await Alert.create({
      _id: id,
      apiName: detection.apiName,
      status: 'active',
      severity,
      issues: detection.issues,
      ...templateAlert(textRequest),
      aiGenerated: false,
      aiModel: null,
      lastMetrics: detection.metrics,
      occurrences: 1,
      firstSeen: now,
      lastSeen: now,
    });
    return { kind: 'created', alert, textRequest, needsText: true };
  } catch (error) {
    if (isDuplicateKeyError(error)) return null;
    throw error;
  }
}

/** Returns null when the alert was resolved in the meantime, so the anomaly opens a new incident. */
async function updateIncident(
  active: AlertDocument,
  detection: Detection,
  severity: AlertSeverity,
  thresholds: Thresholds,
  now: Date,
): Promise<LifecycleOutcome | null> {
  const escalated = isMoreSevere(severity, active.severity);
  // Regenerating text costs an LLM call, so it only happens when the alert's story changes.
  const needsText = escalated || !sameIssueTypes(active.issues, detection.issues);

  const changes: Record<string, unknown> = { issues: detection.issues, lastMetrics: detection.metrics };
  // Only ever raise the severity, so a concurrent update can never undo an escalation.
  if (escalated) changes.severity = severity;
  if (needsText) {
    const draft = toTextRequest(active.id, detection, escalated ? severity : active.severity, active.occurrences + 1, thresholds);
    Object.assign(changes, templateAlert(draft), { aiGenerated: false, aiModel: null });
  }

  const alert = await Alert.findOneAndUpdate(
    { _id: active._id, status: 'active' },
    { $set: changes, $inc: { occurrences: 1 }, $max: { lastSeen: now } },
    { returnDocument: 'after' },
  );
  if (!alert) return null;

  const textRequest = toTextRequest(alert.id, detection, alert.severity, alert.occurrences, thresholds);
  return { kind: 'updated', alert, textRequest, needsText, escalated };
}

async function resolveRecovered(apiName: string, now: Date): Promise<LifecycleOutcome> {
  if (!config.monitor.autoResolveOnRecovery) return { kind: 'unchanged' };

  const alert = await Alert.findOneAndUpdate(
    { apiName, status: 'active' },
    { $set: { status: 'resolved', resolvedAt: now, resolvedBy: 'auto-recovery' } },
    { returnDocument: 'after' },
  );
  if (!alert) return { kind: 'unchanged' };

  logger.info({ alertId: alert.id, apiName, occurrences: alert.occurrences }, 'Alert auto-resolved: the API is healthy again');
  return { kind: 'resolved', alert };
}

function toTextRequest(
  id: string,
  detection: Detection,
  severity: AlertSeverity,
  occurrences: number,
  thresholds: Thresholds,
): AlertTextRequest {
  return {
    id,
    apiName: detection.apiName,
    severity,
    occurrences,
    issues: detection.issues,
    metrics: detection.metrics,
    thresholds,
  };
}

function sameIssueTypes(previous: readonly Issue[], current: readonly Issue[]): boolean {
  const before = new Set(previous.map((issue) => issue.type));
  const after = new Set(current.map((issue) => issue.type));
  return before.size === after.size && [...before].every((type) => after.has(type));
}

function isDuplicateKeyError(error: unknown): boolean {
  return error instanceof mongo.MongoServerError && error.code === 11000;
}
