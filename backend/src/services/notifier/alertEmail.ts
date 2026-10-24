import { config } from '../../config/env.js';
import type { AlertSeverity } from '../../domain/monitoring.js';
import { logger } from '../../lib/logger.js';
import { Alert } from '../../models/alert.model.js';
import { sendEmail, type EmailMessage, type SentEmail } from './email.js';

/** 'digest': sent after a batch with new or escalated critical alerts. 'report': all active alerts, on demand. */
export type AlertEmailKind = 'digest' | 'report';

export interface EmailAlert {
  apiName: string;
  severity: AlertSeverity;
  message: string;
  suggestedAction: string;
}

const SEVERITY_LABEL: Record<AlertSeverity, string> = { critical: 'Critical', warning: 'Warning' };
const SEVERITY_DOT: Record<AlertSeverity, string> = { critical: '#d03b3b', warning: '#fab219' };

/** Builds the email: an HTML table (API, severity, AI message, suggested action) plus a plain-text copy. Pure. */
export function renderAlertEmail(
  kind: AlertEmailKind,
  alerts: readonly EmailAlert[],
  dashboardUrl: string,
  sentAt = new Date(),
): EmailMessage {
  const critical = alerts.filter((alert) => alert.severity === 'critical').length;
  const subject =
    kind === 'digest'
      ? `[API Monitor] ${count(alerts.length, 'critical alert')}: ${alerts.map((alert) => alert.apiName).join(', ')}`
      : `[API Monitor] Active alerts: ${alerts.length} (${critical} critical)`;
  const heading =
    kind === 'digest'
      ? `${count(alerts.length, 'critical alert')} need${alerts.length === 1 ? 's' : ''} attention`
      : `Active alerts report: ${count(alerts.length, 'alert')}`;
  const when = sentAt.toUTCString();

  const cell = 'padding:10px 12px;border-bottom:1px solid #e5e5e5;vertical-align:top;text-align:left;';
  const head = `${cell}font-size:12px;color:#737373;font-weight:600;`;
  const rows = alerts
    .map(
      (alert) => `<tr>
  <td style="${cell}font-weight:600;white-space:nowrap;">${escapeHtml(alert.apiName)}</td>
  <td style="${cell}white-space:nowrap;"><span style="color:${SEVERITY_DOT[alert.severity]};">&#9679;</span> ${SEVERITY_LABEL[alert.severity]}</td>
  <td style="${cell}">${escapeHtml(alert.message)}</td>
  <td style="${cell}">${escapeHtml(alert.suggestedAction)}</td>
</tr>`,
    )
    .join('\n');
  const body =
    alerts.length === 0
      ? '<p style="font-size:14px;">No active alerts: all monitored APIs are healthy.</p>'
      : `<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:14px;line-height:1.45;">
<thead><tr><th style="${head}">API</th><th style="${head}">Severity</th><th style="${head}">Message</th><th style="${head}">Suggested action</th></tr></thead>
<tbody>
${rows}
</tbody>
</table>`;

  const html = `<div style="font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0a0a0a;max-width:820px;">
<h1 style="font-size:18px;margin:0 0 4px;">${escapeHtml(heading)}</h1>
<p style="font-size:13px;color:#737373;margin:0 0 16px;">Sent by API Monitor on ${escapeHtml(when)}</p>
${body}
<p style="font-size:13px;color:#737373;margin-top:16px;">Open the dashboard to resolve alerts: <a href="${escapeHtml(dashboardUrl)}">${escapeHtml(dashboardUrl)}</a></p>
</div>`;

  const text = [
    heading,
    `Sent by API Monitor on ${when}`,
    '',
    ...(alerts.length === 0
      ? ['No active alerts: all monitored APIs are healthy.']
      : alerts.map(
          (alert) =>
            `${alert.apiName} (${SEVERITY_LABEL[alert.severity]})\n  ${alert.message}\n  Suggested action: ${alert.suggestedAction}`,
        )),
    '',
    `Dashboard: ${dashboardUrl}`,
  ].join('\n');

  return { subject, html, text };
}

export async function sendAlertEmail(kind: AlertEmailKind, alerts: readonly EmailAlert[]): Promise<SentEmail> {
  const dashboardUrl = config.corsOrigins[0] ?? 'http://localhost:5173';
  const sent = await sendEmail(renderAlertEmail(kind, alerts, dashboardUrl));
  logger.info(
    { kind, alerts: alerts.length, to: sent.to, messageId: sent.messageId, previewUrl: sent.previewUrl },
    sent.previewUrl ? `Alert email sent; preview it at ${sent.previewUrl}` : 'Alert email sent',
  );
  return sent;
}

const pendingDigests = new Set<Promise<SentEmail | null>>();

/**
 * One digest email for the new or escalated critical alerts of a batch. It never rejects, so it can't break the batch:
 * a failure is logged and resolves to null, as does a digest whose alerts were all resolved in the meantime.
 */
export function sendCriticalDigest(alertIds: readonly string[]): Promise<SentEmail | null> {
  const sending: Promise<SentEmail | null> = deliverDigest(alertIds).finally(() => pendingDigests.delete(sending));
  pendingDigests.add(sending);
  return sending;
}

/** Waits for the digests still being sent. The file CLI needs this before it disconnects from MongoDB and exits. */
export function pendingDigestEmails(): Promise<Array<SentEmail | null>> {
  return Promise.all(pendingDigests);
}

async function deliverDigest(alertIds: readonly string[]): Promise<SentEmail | null> {
  try {
    // Read the alerts back, so the email carries the LLM's text rather than the first template.
    const alerts = await Alert.find({ _id: { $in: alertIds }, status: 'active' }).sort({ lastSeen: -1, _id: -1 });
    return alerts.length > 0 ? await sendAlertEmail('digest', alerts) : null;
  } catch (error) {
    logger.warn({ err: error, alerts: alertIds.length }, 'Could not send the critical alert digest email');
    return null;
  }
}

function count(value: number, noun: string): string {
  return `${value} ${noun}${value === 1 ? '' : 's'}`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
