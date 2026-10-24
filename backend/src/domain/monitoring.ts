// Shared monitoring vocabulary: used by the detector, the models and the API responses.

export const ISSUE_TYPES = [
  'SERVER_ERROR',
  'CLIENT_ERROR',
  'UNEXPECTED_STATUS',
  'HIGH_LATENCY',
  'EMPTY_DATA',
  'MISSING_DATA',
  'INVALID_DATA',
] as const;
export type IssueType = (typeof ISSUE_TYPES)[number];

export const ALERT_SEVERITIES = ['warning', 'critical'] as const;
export type AlertSeverity = (typeof ALERT_SEVERITIES)[number];

/** A check's overall result: 'healthy' when it has no issues, otherwise its highest issue severity. */
export const CHECK_SEVERITIES = ['healthy', 'warning', 'critical'] as const;
export type CheckSeverity = (typeof CHECK_SEVERITIES)[number];

export const ALERT_STATUSES = ['active', 'resolved'] as const;
export type AlertStatus = (typeof ALERT_STATUSES)[number];

export const RESOLVERS = ['user', 'auto-recovery'] as const;
export type ResolvedBy = (typeof RESOLVERS)[number];

export const RUN_SOURCES = ['api', 'file'] as const;
export type RunSource = (typeof RUN_SOURCES)[number];

export const LLM_MODES = ['ai', 'template'] as const;
export type LlmMode = (typeof LLM_MODES)[number];

export interface Issue {
  type: IssueType;
  severity: AlertSeverity;
  detail: string;
}

/** Metrics from one API result. A value is null when it was missing or malformed. */
export interface Metrics {
  statusCode: number | null;
  responseTimeMs: number | null;
  recordsReturned: number | null;
}

const SEVERITY_RANK: Record<AlertSeverity, number> = { warning: 1, critical: 2 };

export function isMoreSevere(a: AlertSeverity, b: AlertSeverity): boolean {
  return SEVERITY_RANK[a] > SEVERITY_RANK[b];
}
