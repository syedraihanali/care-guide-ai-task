import type { Server } from 'node:http';
import { createApp } from './app.js';
import { config } from './config/env.js';
import { connectToDatabase, disconnectFromDatabase, redactMongoUri } from './db/mongoose.js';
import { exitAfterFlush, logger } from './lib/logger.js';
import { alertWriter } from './services/llm/alertWriter.js';
import { pendingDigestEmails } from './services/notifier/alertEmail.js';

const SHUTDOWN_TIMEOUT_MS = 10_000;

let server: Server | undefined;
let shuttingDown = false;

async function start(): Promise<void> {
  logger.info(
    {
      env: config.env,
      port: config.port,
      mongoUri: redactMongoUri(config.mongoUri),
      corsOrigins: config.corsOrigins,
      llm: { mode: alertWriter.mode, model: config.llm.model, timeoutMs: config.llm.timeoutMs, batchSize: config.llm.batchSize },
      monitor: config.monitor,
      email: {
        digest: config.email.enabled,
        transport: config.email.smtp.host ? 'smtp' : 'ethereal test inbox',
        to: config.email.to ?? null,
      },
      logLevel: config.logLevel,
    },
    'Starting the API monitor backend',
  );
  if (alertWriter.mode === 'template') {
    logger.info('OPENAI_API_KEY is not set: alerts use template text (template mode)');
  }

  try {
    await connectToDatabase(config.mongoUri);
  } catch (error) {
    logger.fatal(
      { err: error },
      `Cannot connect to MongoDB at ${redactMongoUri(config.mongoUri)}. Is it running? Start it with "npm run db:up".`,
    );
    exitAfterFlush(1);
    return;
  }

  server = createApp().listen(config.port, (error) => {
    if (error) {
      logger.fatal({ err: error }, `Cannot listen on port ${config.port}`);
      void shutdown(1);
      return;
    }
    logger.info(`API listening on http://localhost:${config.port}`);
  });
}

/** Stops accepting requests, lets in-flight ones and digest emails finish, then closes MongoDB. */
async function shutdown(exitCode: number): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info('Shutting down');

  const forceExit = setTimeout(() => {
    logger.error(`Shutdown took longer than ${SHUTDOWN_TIMEOUT_MS} ms; exiting anyway`);
    exitAfterFlush(exitCode || 1);
  }, SHUTDOWN_TIMEOUT_MS);
  forceExit.unref();

  let code = exitCode;
  try {
    if (server) await closeServer(server);
    await pendingDigestEmails();
    await disconnectFromDatabase();
  } catch (error) {
    logger.error({ err: error }, 'Error during shutdown');
    code ||= 1;
  }
  exitAfterFlush(code);
}

function closeServer(httpServer: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    httpServer.close((error) => (error ? reject(error) : resolve()));
    httpServer.closeIdleConnections();
  });
}

process.on('SIGINT', () => void shutdown(0));
process.on('SIGTERM', () => void shutdown(0));
// A stray rejection is a bug to fix, but it does not corrupt the process, so the server keeps serving.
process.on('unhandledRejection', (reason) => logger.error({ err: reason }, 'Unhandled promise rejection'));
// After an uncaught exception the process state is unknown, so shut down.
process.on('uncaughtException', (error) => {
  logger.fatal({ err: error }, 'Uncaught exception');
  void shutdown(1);
});

void start();
