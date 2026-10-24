import { describe, expect, it } from 'vitest';
import { thresholdsFor } from '../src/config/thresholds.js';
import { detect, type CheckInput } from '../src/services/detector.js';
import { templateAlert } from '../src/services/llm/templateAlert.js';

function textFor(input: CheckInput) {
  const thresholds = thresholdsFor(input.apiName);
  const detection = detect(input, thresholds);
  return templateAlert({
    id: '1',
    apiName: input.apiName,
    severity: detection.severity === 'critical' ? 'critical' : 'warning',
    occurrences: 1,
    issues: detection.issues,
    metrics: detection.metrics,
    thresholds,
  });
}

/** One anomalous result per issue type, from the sample batch. */
const anomalies: CheckInput[] = [
  { apiName: 'AppointmentAPI', statusCode: 500, responseTimeMs: 5500, recordsReturned: 0 },
  { apiName: 'InsuranceAPI', statusCode: 404, responseTimeMs: 380, recordsReturned: 0 },
  { apiName: 'ReferralAPI', statusCode: 302, responseTimeMs: 260, recordsReturned: 0 },
  { apiName: 'InventoryAPI', statusCode: 200, responseTimeMs: 7000, recordsReturned: 340 },
  { apiName: 'LabResultsAPI', statusCode: 200, responseTimeMs: 450, recordsReturned: 0 },
  { apiName: 'PrescriptionAPI', statusCode: 200, responseTimeMs: 610, recordsReturned: undefined },
  { apiName: 'ImagingAPI', statusCode: 200, responseTimeMs: '850ms', recordsReturned: 15 },
];

describe('templateAlert', () => {
  it('matches the example alert from the task', () => {
    expect(textFor(anomalies[0]!).message).toBe(
      'AppointmentAPI failed with status 500 and returned 0 records (5500 ms). Possible outage or data issue.',
    );
  });

  it('explains a slow response against its threshold', () => {
    expect(textFor({ apiName: 'BillingAPI', statusCode: 200, responseTimeMs: 3200, recordsReturned: 120 }).message).toBe(
      'BillingAPI took 3200 ms to respond, above its 2000 ms warning threshold. Possible performance degradation.',
    );
  });

  it('names the malformed field', () => {
    expect(textFor(anomalies[6]!).message).toContain('response_time_ms must be a non-negative number (got a string)');
  });

  it('tailors the cause and action to the status code', () => {
    const text = (statusCode: number) => textFor({ apiName: 'X', statusCode, responseTimeMs: 100, recordsReturned: 1 });
    expect(text(401).likelyCause).toContain('credentials');
    expect(text(404).likelyCause).toContain('endpoint');
    expect(text(429).likelyCause).toContain('rate limiting');
  });

  it.each(anomalies.map((input) => [input.apiName, input] as const))(
    'keeps the %s title within 8 words and the cause hedged',
    (_name, input) => {
      const text = textFor(input);
      expect(text.title.split(/\s+/).length).toBeLessThanOrEqual(8);
      expect(text.likelyCause).toMatch(/^(Likely|Possibly) /);
      expect(text.message.startsWith(input.apiName)).toBe(true);
    },
  );
});
