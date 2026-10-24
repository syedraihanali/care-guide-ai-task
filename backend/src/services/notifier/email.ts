import { createTestAccount, createTransport, getTestMessageUrl } from 'nodemailer';
import { config } from '../../config/env.js';
import { logger } from '../../lib/logger.js';

type Mailer = ReturnType<typeof createTransport>;

export interface EmailMessage {
  subject: string;
  html: string;
  text: string;
}

export interface SentEmail {
  messageId: string;
  to: string;
  /** Link to view the message in Ethereal's web inbox; null when sent through real SMTP. */
  previewUrl: string | null;
}

const DEFAULT_FROM = 'API Monitor <alerts@api-monitor.local>';
/** Ethereal accepts mail for any address, so a placeholder inbox works when EMAIL_TO is not set. */
const ETHEREAL_TO = 'on-call@api-monitor.local';
const TIMEOUTS = { connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 20_000 };
const TEST_ACCOUNT_TIMEOUT_MS = 15_000;

let mailerSetup: Promise<{ mailer: Mailer; ethereal: boolean }> | undefined;

/** Real SMTP when SMTP_HOST is set; otherwise a throwaway Ethereal account, so emails can be demoed via a preview link. */
function getMailer(): Promise<{ mailer: Mailer; ethereal: boolean }> {
  mailerSetup ??= createMailer().catch((error: unknown) => {
    mailerSetup = undefined; // retry on the next email instead of caching the failure
    throw error;
  });
  return mailerSetup;
}

async function createMailer(): Promise<{ mailer: Mailer; ethereal: boolean }> {
  const { host, port, user, pass } = config.email.smtp;
  if (host) {
    const auth = user ? { user, pass } : undefined;
    return { mailer: createTransport({ host, port, secure: port === 465, auth, ...TIMEOUTS }), ethereal: false };
  }

  const account = await withTimeout(createTestAccount(), TEST_ACCOUNT_TIMEOUT_MS, 'Creating an Ethereal test account timed out');
  logger.info({ user: account.user }, 'No SMTP configured: emails go to an Ethereal test inbox');
  const auth = { user: account.user, pass: account.pass };
  const { host: etherealHost, port: etherealPort, secure } = account.smtp;
  return { mailer: createTransport({ host: etherealHost, port: etherealPort, secure, auth, ...TIMEOUTS }), ethereal: true };
}

export async function sendEmail(message: EmailMessage): Promise<SentEmail> {
  const { mailer, ethereal } = await getMailer();
  const to = config.email.to ?? (ethereal ? ETHEREAL_TO : undefined);
  if (!to) throw new Error('EMAIL_TO is not set, so the email has no recipient');

  const info = await mailer.sendMail({ from: config.email.from ?? DEFAULT_FROM, to, ...message });
  const previewUrl = getTestMessageUrl(info);
  return { messageId: info.messageId, to, previewUrl: typeof previewUrl === 'string' ? previewUrl : null };
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
