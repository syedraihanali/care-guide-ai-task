import express, { type Express } from 'express';

// The app is built separately from server.ts so tests can use it without opening a port.
export function createApp(): Express {
  const app = express();

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', uptimeSec: Math.round(process.uptime()) });
  });

  return app;
}
