import type { Request, Response } from 'express';
import { alertIdParamsSchema, listAlertsQuerySchema } from './alerts.schema.js';
import { getAlert, getAlertStats, listAlerts, resolveAlert } from './alerts.service.js';

// Inputs are parsed with zod here; a ZodError becomes a 400 VALIDATION_ERROR in the error handler.

export async function listAlertsHandler(req: Request, res: Response): Promise<void> {
  res.json(await listAlerts(listAlertsQuerySchema.parse(req.query)));
}

export async function alertStatsHandler(_req: Request, res: Response): Promise<void> {
  res.json(await getAlertStats());
}

export async function getAlertHandler(req: Request, res: Response): Promise<void> {
  const { id } = alertIdParamsSchema.parse(req.params);
  res.json(await getAlert(id));
}

export async function resolveAlertHandler(req: Request, res: Response): Promise<void> {
  const { id } = alertIdParamsSchema.parse(req.params);
  res.json(await resolveAlert(id));
}
