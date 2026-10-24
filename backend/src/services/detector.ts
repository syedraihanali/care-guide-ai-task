import type { Thresholds } from '../config/thresholds.js';
import type { CheckSeverity, Issue, Metrics } from '../domain/monitoring.js';

/** One API result to evaluate. Field values come straight from the input, so they may be missing or malformed. */
export interface CheckInput {
  apiName: string;
  statusCode: unknown;
  responseTimeMs: unknown;
  recordsReturned: unknown;
}

export interface Detection {
  apiName: string;
  healthy: boolean;
  severity: CheckSeverity;
  issues: Issue[];
  metrics: Metrics;
}

/** Applies the detection rules to one API result. Pure: no I/O, and the same input always gives the same result. */
export function detect(input: CheckInput, thresholds: Thresholds): Detection {
  const issues: Issue[] = [];
  const metrics: Metrics = {
    statusCode: checkStatusCode(input.statusCode, issues),
    responseTimeMs: checkResponseTime(input.responseTimeMs, thresholds, issues),
    recordsReturned: checkRecords(input.recordsReturned, thresholds, issues),
  };
  return {
    apiName: input.apiName,
    healthy: issues.length === 0,
    severity: overallSeverity(issues),
    issues,
    metrics,
  };
}

function checkStatusCode(value: unknown, issues: Issue[]): number | null {
  if (!isInteger(value) || value < 100 || value > 599) {
    issues.push(invalidData('status_code', value, 'an integer from 100 to 599'));
    return null;
  }
  if (value >= 500) {
    issues.push({ type: 'SERVER_ERROR', severity: 'critical', detail: `HTTP ${value} server error` });
  } else if (value >= 400) {
    issues.push({ type: 'CLIENT_ERROR', severity: 'warning', detail: `HTTP ${value} client error` });
  } else if (value < 200 || value >= 300) {
    issues.push({ type: 'UNEXPECTED_STATUS', severity: 'warning', detail: `Unexpected HTTP ${value} (expected 2xx)` });
  }
  return value;
}

function checkResponseTime(value: unknown, thresholds: Thresholds, issues: Issue[]): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    issues.push(invalidData('response_time_ms', value, 'a non-negative number'));
    return null;
  }
  if (value > thresholds.latencyCriticalMs) {
    issues.push({
      type: 'HIGH_LATENCY',
      severity: 'critical',
      detail: `Response time ${value} ms is above the ${thresholds.latencyCriticalMs} ms critical threshold`,
    });
  } else if (value > thresholds.latencyWarningMs) {
    issues.push({
      type: 'HIGH_LATENCY',
      severity: 'warning',
      detail: `Response time ${value} ms is above the ${thresholds.latencyWarningMs} ms warning threshold`,
    });
  }
  return value;
}

function checkRecords(value: unknown, thresholds: Thresholds, issues: Issue[]): number | null {
  if (value === undefined || value === null) {
    issues.push({ type: 'MISSING_DATA', severity: 'warning', detail: `records_returned is ${value === null ? 'null' : 'missing'}` });
    return null;
  }
  if (!isInteger(value) || value < 0) {
    issues.push(invalidData('records_returned', value, 'a non-negative integer'));
    return null;
  }
  if (value === 0 && thresholds.expectRecords) {
    issues.push({ type: 'EMPTY_DATA', severity: 'warning', detail: 'Returned 0 records' });
  }
  return value;
}

function invalidData(field: string, value: unknown, expected: string): Issue {
  const detail = value === undefined ? `${field} is missing` : `${field} must be ${expected} (got ${describeValue(value)})`;
  return { type: 'INVALID_DATA', severity: 'warning', detail };
}

/** Strings are described, not echoed: a malformed field could hold anything, and alert text is sent to the LLM. */
function describeValue(value: unknown): string {
  if (value === null || typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return 'an array';
  if (typeof value === 'object') return 'an object';
  return `a ${typeof value}`;
}

function overallSeverity(issues: readonly Issue[]): CheckSeverity {
  if (issues.length === 0) return 'healthy';
  return issues.some((issue) => issue.severity === 'critical') ? 'critical' : 'warning';
}

function isInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}
