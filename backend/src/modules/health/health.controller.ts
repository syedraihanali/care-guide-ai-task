import type { Request, Response } from 'express';
import { isDatabaseConnected } from '../../db/mongoose.js';
import { alertWriter } from '../../services/llm/alertWriter.js';

/** Answers 503 while the database is down, so load balancers and the dashboard can tell. */
export function healthHandler(_req: Request, res: Response): void {
  const db = isDatabaseConnected() ? 'up' : 'down';
  res.status(db === 'up' ? 200 : 503).json({
    status: db === 'up' ? 'ok' : 'degraded',
    db,
    llm: alertWriter.mode,
    model: alertWriter.mode === 'ai' ? alertWriter.model : null,
    uptimeSec: Math.round(process.uptime()),
  });
}
