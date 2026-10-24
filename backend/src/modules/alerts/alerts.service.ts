import type { AlertSeverity } from '../../domain/monitoring.js';
import { AppError, notFoundError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { Alert, type AlertDocument } from '../../models/alert.model.js';
import { ApiCheck } from '../../models/apiCheck.model.js';
import { sendAlertEmail } from '../../services/notifier/alertEmail.js';
import type { ListAlertsQuery } from './alerts.schema.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface AlertPage {
  data: AlertDocument[];
  total: number;
  page: number;
  limit: number;
}

export async function listAlerts(query: ListAlertsQuery): Promise<AlertPage> {
  const filter: Record<string, unknown> = {};
  if (query.status !== 'all') filter.status = query.status;
  if (query.severity) filter.severity = query.severity;
  if (query.apiName) filter.apiName = { $regex: escapeRegExp(query.apiName), $options: 'i' };

  const [data, total] = await Promise.all([
    Alert.find(filter)
      // 'critical' sorts before 'warning' alphabetically, so ascending severity lists critical alerts first.
      .sort({ severity: 1, lastSeen: -1, _id: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit),
    Alert.countDocuments(filter),
  ]);
  return { data, total, page: query.page, limit: query.limit };
}

export async function getAlertStats() {
  const since = new Date(Date.now() - DAY_MS);
  const [activeBySeverity, apisAffected, resolvedLast24h, checksLast24h] = await Promise.all([
    Alert.aggregate<{ _id: AlertSeverity; count: number }>([
      { $match: { status: 'active' } },
      { $group: { _id: '$severity', count: { $sum: 1 } } },
    ]),
    Alert.distinct('apiName', { status: 'active' }),
    Alert.countDocuments({ status: 'resolved', resolvedAt: { $gte: since } }),
    ApiCheck.countDocuments({ checkedAt: { $gte: since } }),
  ]);
  const count = (severity: AlertSeverity) => activeBySeverity.find((row) => row._id === severity)?.count ?? 0;
  const critical = count('critical');
  const warning = count('warning');
  return {
    active: critical + warning,
    critical,
    warning,
    apisAffected: apisAffected.length,
    resolvedLast24h,
    checksLast24h,
  };
}

export async function getAlert(id: string): Promise<AlertDocument> {
  const alert = await Alert.findById(id);
  if (!alert) throw notFoundError(`Alert ${id} not found`);
  return alert;
}

/** Resolving is idempotent: an alert that is already resolved is returned unchanged. */
export async function resolveAlert(id: string): Promise<AlertDocument> {
  const resolved = await Alert.findOneAndUpdate(
    { _id: id, status: 'active' },
    { $set: { status: 'resolved', resolvedAt: new Date(), resolvedBy: 'user' } },
    { returnDocument: 'after' },
  );
  if (resolved) {
    logger.info({ alertId: id, apiName: resolved.apiName }, 'Alert resolved by a user');
    return resolved;
  }
  return getAlert(id);
}

export interface EmailReportResult {
  sent: true;
  alerts: number;
  to: string;
  messageId: string;
  previewUrl: string | null;
}

/** Emails a report of every active alert, on demand. Works with real SMTP or an Ethereal test inbox. */
export async function emailActiveAlertsReport(): Promise<EmailReportResult> {
  const alerts = await Alert.find({ status: 'active' }).sort({ severity: 1, lastSeen: -1, _id: -1 });
  try {
    const { to, messageId, previewUrl } = await sendAlertEmail('report', alerts);
    return { sent: true, alerts: alerts.length, to, messageId, previewUrl };
  } catch (error) {
    logger.warn({ err: error }, 'Could not send the alerts report email');
    throw new AppError(502, 'EMAIL_FAILED', `The report email could not be sent: ${(error as Error).message}`);
  }
}

/** Makes user input safe to embed in a regular expression. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
