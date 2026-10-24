import type { IssueType } from '../../domain/monitoring.js';
import type { AlertText, AlertTextRequest } from './types.js';

/** When an alert has several issues, the first one in this list leads its text. */
const PRIORITY: readonly IssueType[] = [
  'SERVER_ERROR',
  'CLIENT_ERROR',
  'UNEXPECTED_STATUS',
  'HIGH_LATENCY',
  'EMPTY_DATA',
  'MISSING_DATA',
  'INVALID_DATA',
];

/**
 * Deterministic alert text, used in template mode and whenever the LLM fails. For example:
 * "AppointmentAPI failed with status 500 and returned 0 records (5500 ms). Possible outage or data issue."
 */
export function templateAlert(request: AlertTextRequest): AlertText {
  const types = new Set(request.issues.map((issue) => issue.type));
  const primary = PRIORITY.find((type) => types.has(type)) ?? 'INVALID_DATA';
  const status = request.metrics.statusCode;
  return {
    title: title(primary, request),
    message: message(types, primary, request),
    likelyCause: likelyCause(primary, status),
    suggestedAction: suggestedAction(primary, status),
  };
}

function title(primary: IssueType, request: AlertTextRequest): string {
  const { apiName, metrics } = request;
  switch (primary) {
    case 'SERVER_ERROR':
      return `${apiName} failing with HTTP ${metrics.statusCode}`;
    case 'CLIENT_ERROR':
      return `${apiName} returning HTTP ${metrics.statusCode}`;
    case 'UNEXPECTED_STATUS':
      return `${apiName} returned unexpected HTTP ${metrics.statusCode}`;
    case 'HIGH_LATENCY':
      return `${apiName} ${isCriticalLatency(request) ? 'critically slow' : 'responding slowly'} (${metrics.responseTimeMs} ms)`;
    case 'EMPTY_DATA':
      return `${apiName} returned no records`;
    case 'MISSING_DATA':
      return `${apiName} missing its record count`;
    case 'INVALID_DATA':
      return `${apiName} sent malformed monitoring data`;
  }
}

function message(types: ReadonlySet<IssueType>, primary: IssueType, request: AlertTextRequest): string {
  const { apiName, metrics, thresholds } = request;
  const statusFailed = types.has('SERVER_ERROR') || types.has('CLIENT_ERROR') || types.has('UNEXPECTED_STATUS');
  const slow = types.has('HIGH_LATENCY');

  const problems: string[] = [];
  if (types.has('SERVER_ERROR') || types.has('CLIENT_ERROR')) problems.push(`failed with status ${metrics.statusCode}`);
  else if (types.has('UNEXPECTED_STATUS')) problems.push(`responded with unexpected status ${metrics.statusCode}`);
  if (types.has('EMPTY_DATA')) problems.push('returned 0 records');
  if (types.has('MISSING_DATA')) problems.push('did not report records_returned');
  // Next to a failed request the response time is context, so it goes in brackets instead of its own clause.
  if (slow && !statusFailed) {
    const critical = isCriticalLatency(request);
    const limit = critical ? thresholds.latencyCriticalMs : thresholds.latencyWarningMs;
    problems.push(`took ${metrics.responseTimeMs} ms to respond, above its ${limit} ms ${critical ? 'critical' : 'warning'} threshold`);
  }

  const sentences: string[] = [];
  if (problems.length > 0) {
    const timing = metrics.responseTimeMs !== null && (statusFailed || !slow) ? ` (${metrics.responseTimeMs} ms)` : '';
    sentences.push(`${apiName} ${joinWithAnd(problems)}${timing}.`);
  }
  const malformed = request.issues.filter((issue) => issue.type === 'INVALID_DATA').map((issue) => issue.detail);
  if (malformed.length > 0) {
    sentences.push(`${sentences.length > 0 ? 'It also sent' : `${apiName} sent`} malformed monitoring data: ${malformed.join('; ')}.`);
  }
  sentences.push(hint(primary, types));
  return sentences.join(' ');
}

function hint(primary: IssueType, types: ReadonlySet<IssueType>): string {
  switch (primary) {
    case 'SERVER_ERROR':
      return types.has('EMPTY_DATA') || types.has('MISSING_DATA') ? 'Possible outage or data issue.' : 'Possible outage.';
    case 'CLIENT_ERROR':
      return 'Possible request, credential or endpoint problem.';
    case 'UNEXPECTED_STATUS':
      return 'Possible redirect or misconfigured endpoint.';
    case 'HIGH_LATENCY':
      return 'Possible performance degradation.';
    case 'EMPTY_DATA':
      return 'Possible data or query issue.';
    case 'MISSING_DATA':
      return 'Possible incomplete response.';
    case 'INVALID_DATA':
      return 'Possible monitoring probe or format issue.';
  }
}

function likelyCause(primary: IssueType, status: number | null): string {
  switch (primary) {
    case 'SERVER_ERROR':
      return 'Likely an outage or an unhandled error in the service or one of its dependencies.';
    case 'CLIENT_ERROR':
      if (status === 401 || status === 403) return 'Likely expired or invalid credentials, or missing permissions.';
      if (status === 404) return 'Likely a changed or removed endpoint, or a wrong resource path.';
      if (status === 429) return 'Likely rate limiting by the API provider.';
      return 'Likely a malformed request or a change in the API contract.';
    case 'UNEXPECTED_STATUS':
      return status !== null && status < 200
        ? 'Likely an incomplete or interrupted response.'
        : 'Likely a redirect from a moved endpoint or an outdated base URL.';
    case 'HIGH_LATENCY':
      return 'Likely heavy load, slow database queries or a slow upstream dependency.';
    case 'EMPTY_DATA':
      return 'Possibly a data sync problem, or query filters that exclude every record.';
    case 'MISSING_DATA':
      return 'Possibly an incomplete response, or a monitoring probe that could not read the record count.';
    case 'INVALID_DATA':
      return 'Possibly a faulty monitoring probe, or a change in the response format.';
  }
}

function suggestedAction(primary: IssueType, status: number | null): string {
  switch (primary) {
    case 'SERVER_ERROR':
      return "Inspect the API's server logs around the failure and check the status page of its upstream dependencies; fail over or restart the service if it is down.";
    case 'CLIENT_ERROR':
      if (status === 401 || status === 403) return 'Verify the API credentials and token expiry, then retry the request.';
      if (status === 404) return "Confirm the endpoint path and API version against the provider's documentation.";
      if (status === 429) return 'Lower the request rate or raise the quota, and honour the Retry-After header.';
      return 'Compare the request payload and parameters with the API contract.';
    case 'UNEXPECTED_STATUS':
      return 'Check the endpoint URL and redirect configuration, and point the client at the final URL.';
    case 'HIGH_LATENCY':
      return "Check the service's CPU, memory and database connection pool, and look for slow queries in its logs.";
    case 'EMPTY_DATA':
      return 'Verify the query filters and pagination parameters, and confirm that upstream data sync jobs ran.';
    case 'MISSING_DATA':
      return "Inspect a raw response and the monitoring probe's parser to see why the record count is missing.";
    case 'INVALID_DATA':
      return 'Check the monitoring probe or integration that reports these metrics, and validate its payload format.';
  }
}

function isCriticalLatency(request: AlertTextRequest): boolean {
  return request.issues.some((issue) => issue.type === 'HIGH_LATENCY' && issue.severity === 'critical');
}

function joinWithAnd(parts: readonly string[]): string {
  return parts.length <= 1 ? parts.join('') : `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`;
}
