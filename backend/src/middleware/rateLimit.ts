import { rateLimit, type Options } from 'express-rate-limit';
import { AppError } from '../lib/errors.js';

function limitPerMinute(limit: number, message: string) {
  const options: Partial<Options> = {
    windowMs: 60_000,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, _res, next) => next(new AppError(429, 'RATE_LIMITED', message)),
  };
  return rateLimit(options);
}

/** POST /monitor does the heavy work (database writes and LLM calls), so each client gets a budget per minute. */
export const monitorRateLimit = limitPerMinute(30, 'Too many monitor requests. Wait a minute and try again.');

/** Each report is a real email, so this budget is small. */
export const emailReportRateLimit = limitPerMinute(5, 'Too many email reports. Wait a minute and try again.');
