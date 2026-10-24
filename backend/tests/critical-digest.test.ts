import { beforeEach, describe, expect, it, vi } from 'vitest';
import { pendingDigestEmails, sendCriticalDigest } from '../src/services/notifier/alertEmail.js';
import type { SentEmail } from '../src/services/notifier/email.js';

// The database and the mail transport are mocked; vi.mock calls are hoisted above the imports.
const mocks = vi.hoisted(() => ({ find: vi.fn(), sendEmail: vi.fn() }));
vi.mock('../src/models/alert.model.js', () => ({ Alert: { find: mocks.find } }));
vi.mock('../src/services/notifier/email.js', () => ({ sendEmail: mocks.sendEmail }));

const auth = {
  apiName: 'AuthAPI',
  severity: 'critical',
  message: 'AuthAPI failed with status 503 and returned 0 records.',
  suggestedAction: 'Check the auth service logs.',
};
const sent: SentEmail = { messageId: '<1@test>', to: 'on-call@api-monitor.local', previewUrl: 'https://ethereal.email/message/abc' };

/** Alert.find(...).sort(...) resolves to these alerts. */
function alertsInDatabase(result: Promise<unknown[]>) {
  mocks.find.mockReturnValue({ sort: () => result });
}

beforeEach(() => {
  mocks.find.mockReset();
  mocks.sendEmail.mockReset();
});

describe('sendCriticalDigest', () => {
  it('sends one digest built from the alerts read back from the database', async () => {
    alertsInDatabase(Promise.resolve([auth]));
    mocks.sendEmail.mockResolvedValue(sent);

    await expect(sendCriticalDigest(['a1'])).resolves.toEqual(sent);
    expect(mocks.find).toHaveBeenCalledWith({ _id: { $in: ['a1'] }, status: 'active' });
    expect(mocks.sendEmail).toHaveBeenCalledOnce();
    expect(mocks.sendEmail.mock.calls[0]?.[0]).toMatchObject({ subject: '[API Monitor] 1 critical alert: AuthAPI' });
  });

  it('sends nothing when none of the alerts is still active', async () => {
    alertsInDatabase(Promise.resolve([]));

    await expect(sendCriticalDigest(['a1'])).resolves.toBeNull();
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it('never rejects: a failed send resolves to null, so it cannot break the batch', async () => {
    alertsInDatabase(Promise.resolve([auth]));
    mocks.sendEmail.mockRejectedValue(new Error('SMTP connection refused'));

    await expect(sendCriticalDigest(['a1'])).resolves.toBeNull();
  });

  it('never rejects when the database read fails either', async () => {
    alertsInDatabase(Promise.reject(new Error('MongoDB is down')));

    await expect(sendCriticalDigest(['a1'])).resolves.toBeNull();
  });
});

describe('pendingDigestEmails', () => {
  it('waits for digests still being sent, then forgets them', async () => {
    alertsInDatabase(Promise.resolve([auth]));
    let finishSending: (value: SentEmail) => void = () => {};
    mocks.sendEmail.mockReturnValue(new Promise<SentEmail>((resolve) => (finishSending = resolve)));

    void sendCriticalDigest(['a1']);
    let settled = false;
    const pending = pendingDigestEmails().then((results) => {
      settled = true;
      return results;
    });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(settled).toBe(false);

    finishSending(sent);
    await expect(pending).resolves.toEqual([sent]);
    await expect(pendingDigestEmails()).resolves.toEqual([]);
  });
});
