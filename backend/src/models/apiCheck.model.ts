import { Schema, model, type Types } from 'mongoose';
import { CHECK_SEVERITIES, ISSUE_TYPES, type CheckSeverity, type IssueType, type Metrics } from '../domain/monitoring.js';
import { jsonOutput, metricsSchema } from './shared.js';

const RETENTION_SECONDS = 30 * 24 * 60 * 60;

/** One processed API result: the history behind GET /apis/status and the stats. */
export interface ApiCheckAttrs {
  apiName: string;
  runId: Types.ObjectId;
  metrics: Metrics;
  healthy: boolean;
  severity: CheckSeverity;
  issueTypes: IssueType[];
  checkedAt: Date;
}

const apiCheckSchema = new Schema<ApiCheckAttrs>(
  {
    apiName: { type: String, required: true },
    runId: { type: Schema.Types.ObjectId, ref: 'MonitorRun', required: true },
    metrics: { type: metricsSchema, required: true },
    healthy: { type: Boolean, required: true },
    severity: { type: String, enum: CHECK_SEVERITIES, required: true },
    issueTypes: { type: [String], enum: ISSUE_TYPES, default: [] },
    checkedAt: { type: Date, required: true },
  },
  { versionKey: false, toJSON: jsonOutput },
);

// Latest check per API. Checks from one batch share checkedAt, so _id (assigned in input order) breaks ties.
apiCheckSchema.index({ apiName: 1, checkedAt: -1, _id: -1 });
apiCheckSchema.index({ checkedAt: 1 }, { expireAfterSeconds: RETENTION_SECONDS });

export const ApiCheck = model<ApiCheckAttrs>('ApiCheck', apiCheckSchema);
