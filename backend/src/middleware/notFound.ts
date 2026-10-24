import type { RequestHandler } from 'express';
import { notFoundError } from '../lib/errors.js';

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(notFoundError(`No route for ${req.method} ${req.path}`));
};
