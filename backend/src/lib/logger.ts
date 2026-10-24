import path from 'node:path';
import { pino, type LoggerOptions, type TransportTargetOptions } from 'pino';
import { config } from '../config/env.js';

/** Every log line is also written here as JSON (backend/logs/app.log). */
export const LOG_FILE = path.resolve(import.meta.dirname, '../../logs/app.log');

const options: LoggerOptions = {
  level: config.logLevel,
  // pino-http logs request and response headers; credentials must never reach the logs.
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', 'req.headers["x-api-key"]', 'res.headers["set-cookie"]'],
    censor: '[redacted]',
  },
};

function transportTargets(): TransportTargetOptions[] {
  const consoleTarget: TransportTargetOptions = config.isProduction
    ? { target: 'pino/file', level: config.logLevel, options: { destination: 1 } }
    : {
        target: 'pino-pretty',
        level: config.logLevel,
        // Request and response details stay in the JSON log file; the console shows the one-line summary.
        options: { colorize: true, translateTime: 'SYS:HH:MM:ss.l', ignore: 'pid,hostname,req,res,responseTime' },
      };
  const fileTarget: TransportTargetOptions = {
    target: 'pino/file',
    level: config.logLevel,
    options: { destination: LOG_FILE, mkdir: true },
  };
  return [consoleTarget, fileTarget];
}

// Tests log nothing, so they start no transport workers and write no log file.
export const logger =
  config.env === 'test'
    ? pino({ ...options, level: 'silent' })
    : pino({ ...options, transport: { targets: transportTargets() } });

/** Exits once buffered log lines are written, so a fatal message is never lost. */
export function exitAfterFlush(code: number): void {
  process.exitCode = code;
  setTimeout(() => process.exit(code), 2_000).unref();
  logger.flush(() => process.exit(code));
}
