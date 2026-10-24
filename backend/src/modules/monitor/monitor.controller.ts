import type { Request, Response } from 'express';
import { runMonitor } from './monitor.service.js';

export async function postMonitor(req: Request, res: Response): Promise<void> {
  res.json(await runMonitor(req.body, 'api'));
}
