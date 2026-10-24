import { Router } from 'express';
import { emailReportRateLimit } from '../../middleware/rateLimit.js';
import {
  alertStatsHandler,
  emailReportHandler,
  getAlertHandler,
  listAlertsHandler,
  resolveAlertHandler,
} from './alerts.controller.js';

export const alertsRouter = Router();

alertsRouter.get('/', listAlertsHandler);
// Registered before /:id, which would otherwise match "stats".
alertsRouter.get('/stats', alertStatsHandler);
alertsRouter.post('/report/email', emailReportRateLimit, emailReportHandler);
alertsRouter.get('/:id', getAlertHandler);
alertsRouter.patch('/:id/resolve', resolveAlertHandler);
