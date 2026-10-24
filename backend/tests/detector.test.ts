import { describe, expect, it } from 'vitest';
import { DEFAULT_THRESHOLDS, thresholdsFor } from '../src/config/thresholds.js';
import { detect, type CheckInput, type Detection } from '../src/services/detector.js';

const normal: CheckInput = { apiName: 'TestAPI', statusCode: 200, responseTimeMs: 300, recordsReturned: 10 };

function check(changes: Partial<CheckInput>, thresholds = DEFAULT_THRESHOLDS): Detection {
  return detect({ ...normal, ...changes }, thresholds);
}

function issueTypes(detection: Detection): string[] {
  return detection.issues.map((issue) => issue.type);
}

describe('detect', () => {
  it('reports a normal result as healthy, with its metrics', () => {
    expect(check({})).toEqual({
      apiName: 'TestAPI',
      healthy: true,
      severity: 'healthy',
      issues: [],
      metrics: { statusCode: 200, responseTimeMs: 300, recordsReturned: 10 },
    });
  });

  describe('status codes', () => {
    it.each([500, 503, 599])('flags HTTP %i as a critical SERVER_ERROR', (statusCode) => {
      const detection = check({ statusCode });
      expect(issueTypes(detection)).toEqual(['SERVER_ERROR']);
      expect(detection.severity).toBe('critical');
    });

    it.each([400, 401, 404, 429, 499])('flags HTTP %i as a CLIENT_ERROR warning', (statusCode) => {
      const detection = check({ statusCode });
      expect(issueTypes(detection)).toEqual(['CLIENT_ERROR']);
      expect(detection.severity).toBe('warning');
    });

    it.each([100, 199, 301, 302, 399])('flags HTTP %i as an UNEXPECTED_STATUS warning', (statusCode) => {
      const detection = check({ statusCode });
      expect(issueTypes(detection)).toEqual(['UNEXPECTED_STATUS']);
      expect(detection.severity).toBe('warning');
    });

    it.each([200, 201, 204, 299])('accepts HTTP %i', (statusCode) => {
      expect(check({ statusCode }).healthy).toBe(true);
    });
  });

  describe('response time', () => {
    it('allows exactly the warning threshold', () => {
      expect(check({ responseTimeMs: 2000 }).healthy).toBe(true);
    });

    it('warns just above the warning threshold', () => {
      expect(check({ responseTimeMs: 2001 }).issues).toEqual([
        { type: 'HIGH_LATENCY', severity: 'warning', detail: 'Response time 2001 ms is above the 2000 ms warning threshold' },
      ]);
    });

    it('is still a warning at exactly the critical threshold', () => {
      expect(check({ responseTimeMs: 5000 }).severity).toBe('warning');
    });

    it('is critical above the critical threshold', () => {
      const detection = check({ responseTimeMs: 5001 });
      expect(detection.severity).toBe('critical');
      expect(detection.issues).toEqual([
        { type: 'HIGH_LATENCY', severity: 'critical', detail: 'Response time 5001 ms is above the 5000 ms critical threshold' },
      ]);
    });
  });

  describe('records', () => {
    it('flags 0 records as EMPTY_DATA', () => {
      const detection = check({ recordsReturned: 0 });
      expect(issueTypes(detection)).toEqual(['EMPTY_DATA']);
      expect(detection.severity).toBe('warning');
    });

    it.each([
      [undefined, 'records_returned is missing'],
      [null, 'records_returned is null'],
    ])('flags %s records as MISSING_DATA', (recordsReturned, detail) => {
      const detection = check({ recordsReturned });
      expect(detection.issues).toEqual([{ type: 'MISSING_DATA', severity: 'warning', detail }]);
      expect(detection.metrics.recordsReturned).toBeNull();
    });
  });

  describe('malformed fields', () => {
    it.each<[string, Partial<CheckInput>]>([
      ['status_code', { statusCode: undefined }],
      ['status_code', { statusCode: null }],
      ['status_code', { statusCode: '200' }],
      ['status_code', { statusCode: 99 }],
      ['status_code', { statusCode: 600 }],
      ['status_code', { statusCode: 200.5 }],
      ['response_time_ms', { responseTimeMs: undefined }],
      ['response_time_ms', { responseTimeMs: null }],
      ['response_time_ms', { responseTimeMs: 'fast' }],
      ['response_time_ms', { responseTimeMs: -1 }],
      ['response_time_ms', { responseTimeMs: Number.POSITIVE_INFINITY }],
      ['records_returned', { recordsReturned: -1 }],
      ['records_returned', { recordsReturned: 1.5 }],
      ['records_returned', { recordsReturned: '10' }],
      ['records_returned', { recordsReturned: true }],
    ])('reports a bad %s as INVALID_DATA (%o)', (field, changes) => {
      const detection = check(changes);
      expect(issueTypes(detection)).toEqual(['INVALID_DATA']);
      expect(detection.issues[0]?.detail).toContain(field);
      expect(detection.severity).toBe('warning');
    });

    it('describes string values instead of echoing them', () => {
      expect(check({ responseTimeMs: 'see patient John Doe' }).issues[0]?.detail).toBe(
        'response_time_ms must be a non-negative number (got a string)',
      );
    });

    it('stores null for a malformed metric', () => {
      expect(check({ statusCode: 'oops' }).metrics).toEqual({ statusCode: null, responseTimeMs: 300, recordsReturned: 10 });
    });
  });

  describe('combinations', () => {
    it('reports every problem of the task example (AppointmentAPI)', () => {
      const input = { apiName: 'AppointmentAPI', statusCode: 500, responseTimeMs: 5500, recordsReturned: 0 };
      const detection = detect(input, thresholdsFor('AppointmentAPI'));
      expect(issueTypes(detection)).toEqual(['SERVER_ERROR', 'HIGH_LATENCY', 'EMPTY_DATA']);
      expect(detection.severity).toBe('critical');
    });

    it('is critical when any issue is critical', () => {
      expect(check({ statusCode: 404, responseTimeMs: 6000 }).severity).toBe('critical');
    });

    it('stays a warning when every issue is a warning', () => {
      const detection = check({ statusCode: 404, responseTimeMs: 3000, recordsReturned: 0 });
      expect(issueTypes(detection)).toEqual(['CLIENT_ERROR', 'HIGH_LATENCY', 'EMPTY_DATA']);
      expect(detection.severity).toBe('warning');
    });
  });

  describe('per-API thresholds', () => {
    it('uses the defaults for other APIs', () => {
      expect(thresholdsFor('SomeOtherAPI')).toEqual(DEFAULT_THRESHOLDS);
    });

    it('alerts on PatientDataAPI sooner than on other APIs', () => {
      const patient = thresholdsFor('PatientDataAPI');
      expect(check({ apiName: 'PatientDataAPI', responseTimeMs: 1600 }, patient).severity).toBe('warning');
      expect(check({ apiName: 'PatientDataAPI', responseTimeMs: 3100 }, patient).severity).toBe('critical');
      expect(check({ responseTimeMs: 1600 }).healthy).toBe(true);
    });

    it('keeps the sample PatientDataAPI result (1200 ms) healthy', () => {
      expect(check({ apiName: 'PatientDataAPI', responseTimeMs: 1200 }, thresholdsFor('PatientDataAPI')).healthy).toBe(true);
    });

    it('lets HealthCheckAPI return 0 records', () => {
      expect(check({ apiName: 'HealthCheckAPI', recordsReturned: 0 }, thresholdsFor('HealthCheckAPI')).healthy).toBe(true);
    });
  });
});
