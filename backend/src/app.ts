import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { config } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFoundHandler } from './middleware/notFound.js';
import { requestLogger } from './middleware/requestLogger.js';
import { alertsRouter } from './modules/alerts/alerts.routes.js';
import { apisRouter } from './modules/apis/apis.routes.js';
import { healthRouter } from './modules/health/health.routes.js';
import { monitorRouter } from './modules/monitor/monitor.routes.js';

// The app is built separately from server.ts so tests can use it without opening a port.
export function createApp(): Express {
  const app = express();

  app.use(requestLogger);
  app.use(helmet());
  app.use(cors({ origin: config.corsOrigins, exposedHeaders: ['X-Request-Id'] }));
  app.use(express.json({ limit: '1mb' }));

  app.use('/health', healthRouter);
  app.use('/monitor', monitorRouter);
  app.use('/alerts', alertsRouter);
  app.use('/apis', apisRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
