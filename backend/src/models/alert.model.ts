import { Schema, model, type HydratedDocument } from 'mongoose';
import {
  ALERT_SEVERITIES,
  ALERT_STATUSES,
  RESOLVERS,
  type AlertSeverity,
  type AlertStatus,
  type Issue,
  type Metrics,
  type ResolvedBy,
} from '../domain/monitoring.js';
import { issueSchema, jsonOutput, metricsSchema } from './shared.js';

/** An incident: while an API stays anomalous, its single active alert is updated instead of duplicated. */
export interface AlertAttrs {
  apiName: string;
  status: AlertStatus;
  /** The highest severity seen during the incident. */
  severity: AlertSeverity;
  /** Issues from the latest anomalous check. */
  issues: Issue[];
  title: string;
  message: string;
  likelyCause: string;
  suggestedAction: string;
  aiGenerated: boolean;
  aiModel: string | null;
  lastMetrics: Metrics;
  occurrences: number;
  firstSeen: Date;
  lastSeen: Date;
  resolvedAt: Date | null;
  resolvedBy: ResolvedBy | null;
  createdAt: Date;
  updatedAt: Date;
}

const alertSchema = new Schema<AlertAttrs>(
  {
    apiName: { type: String, required: true },
    status: { type: String, enum: ALERT_STATUSES, required: true, default: 'active' },
    severity: { type: String, enum: ALERT_SEVERITIES, required: true },
    issues: { type: [issueSchema], default: [] },
    title: { type: String, required: true },
    message: { type: String, required: true },
    likelyCause: { type: String, required: true },
    suggestedAction: { type: String, required: true },
    aiGenerated: { type: Boolean, required: true, default: false },
    aiModel: { type: String, default: null },
    lastMetrics: { type: metricsSchema, required: true },
    occurrences: { type: Number, required: true, default: 1, min: 1 },
    firstSeen: { type: Date, required: true },
    lastSeen: { type: Date, required: true },
    resolvedAt: { type: Date, default: null },
    resolvedBy: { type: String, enum: RESOLVERS, default: null },
  },
  { timestamps: true, versionKey: false, toJSON: jsonOutput },
);

// At most one active alert per API. The database enforces it, so it also holds for concurrent batches.
alertSchema.index(
  { apiName: 1 },
  { unique: true, partialFilterExpression: { status: 'active' }, name: 'one_active_alert_per_api' },
);
// The dashboard query: filter by status (and severity), sorted by severity, then most recently seen.
alertSchema.index({ status: 1, severity: 1, lastSeen: -1 });
alertSchema.index({ lastSeen: -1 });

export const Alert = model<AlertAttrs>('Alert', alertSchema);
export type AlertDocument = HydratedDocument<AlertAttrs>;
