import { Schema } from 'mongoose';
import { ALERT_SEVERITIES, ISSUE_TYPES, type Issue, type Metrics } from '../domain/monitoring.js';

export const issueSchema = new Schema<Issue>(
  {
    type: { type: String, enum: ISSUE_TYPES, required: true },
    severity: { type: String, enum: ALERT_SEVERITIES, required: true },
    detail: { type: String, required: true },
  },
  { _id: false },
);

export const metricsSchema = new Schema<Metrics>(
  {
    statusCode: { type: Number, default: null },
    responseTimeMs: { type: Number, default: null },
    recordsReturned: { type: Number, default: null },
  },
  { _id: false },
);

/** API responses use `id` instead of MongoDB's `_id`. */
export const jsonOutput = {
  transform: (_doc: unknown, ret: { _id: unknown }) => {
    const { _id, ...rest } = ret;
    return { id: String(_id), ...rest };
  },
};
