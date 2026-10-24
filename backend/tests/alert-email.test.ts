import { describe, expect, it } from 'vitest';
import { renderAlertEmail, type EmailAlert } from '../src/services/notifier/alertEmail.js';

const auth: EmailAlert = {
  apiName: 'AuthAPI',
  severity: 'critical',
  message: 'AuthAPI failed with status 503 and returned 0 records.',
  suggestedAction: 'Check the auth service logs.',
};
const billing: EmailAlert = {
  apiName: 'BillingAPI',
  severity: 'warning',
  message: 'BillingAPI took 3200 ms to respond.',
  suggestedAction: 'Check the database connection pool.',
};
const dashboard = 'http://localhost:5173';
const sentAt = new Date('2026-10-24T12:00:00Z');

describe('renderAlertEmail', () => {
  it('names the critical APIs in a digest subject', () => {
    expect(renderAlertEmail('digest', [auth], dashboard, sentAt).subject).toBe('[API Monitor] 1 critical alert: AuthAPI');
  });

  it('counts active and critical alerts in a report subject', () => {
    expect(renderAlertEmail('report', [auth, billing], dashboard, sentAt).subject).toBe('[API Monitor] Active alerts: 2 (1 critical)');
  });

  it('puts the API, severity, AI message and suggested action in an HTML table', () => {
    const { html } = renderAlertEmail('report', [auth, billing], dashboard, sentAt);
    expect(html).toContain('<table');
    for (const text of ['Severity', 'Message', 'Suggested action', 'AuthAPI', 'Critical', auth.message, auth.suggestedAction, 'BillingAPI', 'Warning']) {
      expect(html).toContain(text);
    }
  });

  it('escapes HTML that comes from alert text', () => {
    const { html } = renderAlertEmail('report', [{ ...auth, message: '<script>alert(1)</script> & "quoted"' }], dashboard, sentAt);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;quoted&quot;');
  });

  it('includes a plain-text copy with the dashboard link', () => {
    const { text } = renderAlertEmail('digest', [auth], dashboard, sentAt);
    expect(text).toContain('AuthAPI (Critical)');
    expect(text).toContain('Suggested action: Check the auth service logs.');
    expect(text).toContain(`Dashboard: ${dashboard}`);
  });

  it('says so when there are no active alerts', () => {
    const { html, text } = renderAlertEmail('report', [], dashboard, sentAt);
    expect(html).not.toContain('<table');
    expect(html).toContain('No active alerts');
    expect(text).toContain('No active alerts');
  });
});
