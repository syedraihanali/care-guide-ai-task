import type { ErrorRequestHandler } from 'express';
import mongoose from 'mongoose';
import { ZodError } from 'zod';
import { config } from '../config/env.js';
import { isDatabaseConnected } from '../db/mongoose.js';
import { AppError } from '../lib/errors.js';
import { describeZodIssues } from '../lib/validation.js';

/** Errors from express.json() carry a `type` such as 'entity.parse.failed'. */
interface BodyParserError extends Error {
  type: string;
  status?: number;
}

function isBodyParserError(error: unknown): error is BodyParserError {
  return error instanceof Error && typeof (error as Partial<BodyParserError>).type === 'string';
}

function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (error instanceof ZodError) return new AppError(400, 'VALIDATION_ERROR', 'Invalid request', describeZodIssues(error));
  if (isBodyParserError(error)) {
    if (error.type === 'entity.parse.failed') return new AppError(400, 'INVALID_JSON', 'The request body is not valid JSON');
    if (error.type === 'entity.too.large') return new AppError(413, 'PAYLOAD_TOO_LARGE', 'The request body is larger than 1mb');
    return new AppError(error.status ?? 400, 'BAD_REQUEST', error.message);
  }
  if (isDatabaseError(error) && !isDatabaseConnected()) {
    return new AppError(503, 'DATABASE_UNAVAILABLE', 'The database is unavailable. Try again shortly.');
  }
  return new AppError(500, 'INTERNAL_ERROR', 'Something went wrong on the server');
}

function isDatabaseError(error: unknown): boolean {
  return error instanceof mongoose.Error || error instanceof mongoose.mongo.MongoError;
}

/** Every error becomes `{ error: { code, message, details?, requestId } }`. Stacks are only shown outside production. */
export const errorHandler: ErrorRequestHandler = (error, req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }
  const appError = toAppError(error);
  res.locals.errorCode = appError.code;
  // pino-http logs the response; attaching the error puts its stack in that log line.
  if (appError.status >= 500) res.err = error instanceof Error ? error : new Error(String(error));

  const showStack = !config.isProduction && appError.status >= 500 && error instanceof Error;
  res.status(appError.status).json({
    error: {
      code: appError.code,
      message: appError.message,
      ...(appError.details === undefined ? {} : { details: appError.details }),
      requestId: req.id,
      ...(showStack ? { stack: error.stack } : {}),
    },
  });
};
