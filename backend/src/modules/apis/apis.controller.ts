import type { Request, Response } from 'express';
import { getApiStatuses } from './apis.service.js';

export async function apiStatusHandler(_req: Request, res: Response): Promise<void> {
  res.json({ data: await getApiStatuses() });
}
