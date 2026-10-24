import { Router } from 'express';
import { apiStatusHandler } from './apis.controller.js';

export const apisRouter = Router();

apisRouter.get('/status', apiStatusHandler);
