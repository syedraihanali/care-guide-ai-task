import { Router } from 'express';
import { alertStatsHandler, getAlertHandler, listAlertsHandler, resolveAlertHandler } from './alerts.controller.js';

export const alertsRouter = Router();

alertsRouter.get('/', listAlertsHandler);
// Registered before /:id, which would otherwise match "stats".
alertsRouter.get('/stats', alertStatsHandler);
alertsRouter.get('/:id', getAlertHandler);
alertsRouter.patch('/:id/resolve', resolveAlertHandler);
