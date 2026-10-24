import { z } from 'zod';
import { ALERT_SEVERITIES } from '../../domain/monitoring.js';
import { blankToUndefined } from '../../lib/validation.js';

/** GET /alerts query. Blank values (e.g. a cleared search box) count as not set. */
export const listAlertsQuerySchema = z.object({
  status: z.preprocess(blankToUndefined, z.enum(['active', 'resolved', 'all']).default('active')),
  severity: z.preprocess(blankToUndefined, z.enum(ALERT_SEVERITIES).optional()),
  apiName: z.preprocess(blankToUndefined, z.string().trim().max(100).optional()),
  limit: z.preprocess(blankToUndefined, z.coerce.number().int().min(1).max(500).default(100)),
  page: z.preprocess(blankToUndefined, z.coerce.number().int().min(1).default(1)),
});
export type ListAlertsQuery = z.infer<typeof listAlertsQuerySchema>;

export const alertIdParamsSchema = z.object({
  id: z.string().regex(/^[a-f0-9]{24}$/i, 'must be a 24-character hexadecimal alert id'),
});
