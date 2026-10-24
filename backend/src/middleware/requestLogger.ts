import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import { pinoHttp } from 'pino-http';
import { logger } from '../lib/logger.js';

/** Accept a caller's X-Request-Id only if it is short and plain, so it is safe to log and echo back. */
const SAFE_REQUEST_ID = /^[\w.:-]{1,128}$/;

export const requestLogger = pinoHttp<Request, Response>({
  logger,
  genReqId(req, res) {
    const incoming = req.headers['x-request-id'];
    const id = typeof incoming === 'string' && SAFE_REQUEST_ID.test(incoming) ? incoming : randomUUID();
    res.setHeader('X-Request-Id', id);
    return id;
  },
  customProps: (req) => ({ requestId: req.id }),
  customLogLevel(req, res, error) {
    if (error || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    // The dashboard polls the GET endpoints every few seconds; at debug they do not drown out the rest.
    return req.method === 'GET' ? 'debug' : 'info';
  },
  customSuccessMessage(req, res, responseTime) {
    const code = typeof res.locals.errorCode === 'string' ? ` ${res.locals.errorCode}` : '';
    return `${req.method} ${req.originalUrl} -> ${res.statusCode}${code} in ${Math.round(responseTime)} ms`;
  },
  customErrorMessage(req, res, error) {
    return `${req.method} ${req.originalUrl} -> ${res.statusCode} failed: ${error.message}`;
  },
});
