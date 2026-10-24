import { rateLimit } from 'express-rate-limit';
import { AppError } from '../lib/errors.js';

/** POST /monitor does the heavy work (database writes and LLM calls), so each client gets a budget per minute. */
export const monitorRateLimit = rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(new AppError(429, 'RATE_LIMITED', 'Too many monitor requests. Wait a minute and try again.'));
  },
});
