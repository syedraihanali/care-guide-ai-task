import type { Thresholds } from '../../config/thresholds.js';
import type { AlertSeverity, Issue, Metrics } from '../../domain/monitoring.js';

/** The facts about one alert that the writer may use. It holds metrics only, never a raw payload. */
export interface AlertTextRequest {
  /** The alert's id, used to match the LLM's answer to the alert. */
  id: string;
  apiName: string;
  severity: AlertSeverity;
  occurrences: number;
  issues: Issue[];
  metrics: Metrics;
  thresholds: Thresholds;
}

export interface AlertText {
  title: string;
  message: string;
  likelyCause: string;
  suggestedAction: string;
}
