import { Router } from 'express';
import { monitorRateLimit } from '../../middleware/rateLimit.js';
import { postMonitor } from './monitor.controller.js';

export const monitorRouter = Router();

monitorRouter.post('/', monitorRateLimit, postMonitor);
