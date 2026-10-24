// Shapes of the backend's JSON responses.

export type IssueType =
  | 'SERVER_ERROR'
  | 'CLIENT_ERROR'
  | 'UNEXPECTED_STATUS'
  | 'HIGH_LATENCY'
  | 'EMPTY_DATA'
  | 'MISSING_DATA'
  | 'INVALID_DATA'

export type AlertSeverity = 'warning' | 'critical'
/** A check's overall result: 'healthy' when it has no issues. */
export type CheckSeverity = 'healthy' | AlertSeverity
export type AlertStatus = 'active' | 'resolved'
export type ResolvedBy = 'user' | 'auto-recovery'
export type LlmMode = 'ai' | 'template'

export interface Issue {
  type: IssueType
  severity: AlertSeverity
  detail: string
}

/** A value is null when the API's monitoring data had no valid value for it. */
export interface Metrics {
  statusCode: number | null
  responseTimeMs: number | null
  recordsReturned: number | null
}

export interface Alert {
  id: string
  apiName: string
  status: AlertStatus
  severity: AlertSeverity
  issues: Issue[]
  title: string
  message: string
  likelyCause: string
  suggestedAction: string
  aiGenerated: boolean
  aiModel: string | null
  lastMetrics: Metrics
  occurrences: number
  firstSeen: string
  lastSeen: string
  resolvedAt: string | null
  resolvedBy: ResolvedBy | null
  createdAt: string
  updatedAt: string
}

export type AlertStatusFilter = AlertStatus | 'all'

export interface AlertQuery {
  status: AlertStatusFilter
  severity?: AlertSeverity
  apiName?: string
  page: number
  limit: number
}

export interface AlertPage {
  data: Alert[]
  total: number
  page: number
  limit: number
}

export interface AlertStats {
  active: number
  critical: number
  warning: number
  apisAffected: number
  resolvedLast24h: number
  checksLast24h: number
}

export interface ApiStatus {
  apiName: string
  healthy: boolean
  severity: CheckSeverity
  metrics: Metrics
  issueTypes: IssueType[]
  checkedAt: string
  activeAlert: { id: string; severity: AlertSeverity } | null
}

export interface Health {
  status: 'ok' | 'degraded'
  db: 'up' | 'down'
  llm: LlmMode
  model: string | null
  uptimeSec: number
}

export interface EmailReportResult {
  sent: true
  alerts: number
  to: string
  messageId: string
  /** Ethereal web preview of the email; null when it went through real SMTP. */
  previewUrl: string | null
}

export interface InvalidItem {
  index: number
  reason: string
}

export interface MonitorResult {
  runId: string
  received: number
  processed: number
  invalid: InvalidItem[]
  healthy: number
  anomalies: number
  alerts: { created: number; updated: number; autoResolved: number }
  llm: { mode: LlmMode; calls: number; fallbacks: number }
  durationMs: number
  results: Array<{ apiName: string; healthy: boolean; severity: CheckSeverity; issues: Issue[] }>
}
