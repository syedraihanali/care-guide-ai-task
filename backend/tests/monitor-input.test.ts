import { describe, expect, it } from 'vitest';
import { AppError } from '../src/lib/errors.js';
import { normalizeBatch, parseItems } from '../src/modules/monitor/monitor.schema.js';

function appErrorFrom(run: () => unknown): AppError {
  try {
    run();
  } catch (error) {
    if (error instanceof AppError) return error;
    throw error;
  }
  throw new Error('Expected an AppError');
}

describe('normalizeBatch', () => {
  it('wraps a single result in an array', () => {
    expect(normalizeBatch({ api_name: 'AuthAPI' }, 10)).toEqual([{ api_name: 'AuthAPI' }]);
  });

  it('keeps an array as it is', () => {
    const batch = [{ api_name: 'A' }, { api_name: 'B' }];
    expect(normalizeBatch(batch, 10)).toBe(batch);
  });

  it('rejects an empty array with 400 VALIDATION_ERROR', () => {
    const error = appErrorFrom(() => normalizeBatch([], 10));
    expect(error).toMatchObject({ status: 400, code: 'VALIDATION_ERROR', message: 'The batch is empty' });
  });

  it('accepts exactly the size limit', () => {
    expect(normalizeBatch([{}, {}], 2)).toHaveLength(2);
  });

  it('rejects a batch over the size limit with 413 PAYLOAD_TOO_LARGE', () => {
    const error = appErrorFrom(() => normalizeBatch([{}, {}, {}], 2));
    expect(error).toMatchObject({ status: 413, code: 'PAYLOAD_TOO_LARGE' });
  });

  it.each([undefined, null, 'text', 42, true])('rejects a body of %s with 400', (body) => {
    expect(appErrorFrom(() => normalizeBatch(body, 10))).toMatchObject({ status: 400, code: 'VALIDATION_ERROR' });
  });
});

describe('parseItems', () => {
  it('maps a valid result to the detector input and keeps its position', () => {
    const { valid, invalid } = parseItems([
      { api_name: 'BillingAPI', response_time_ms: 3200, status_code: 200, records_returned: 120 },
    ]);
    expect(invalid).toEqual([]);
    expect(valid).toEqual([{ index: 0, apiName: 'BillingAPI', statusCode: 200, responseTimeMs: 3200, recordsReturned: 120 }]);
  });

  it('trims the API name', () => {
    expect(parseItems([{ api_name: '  AuthAPI  ' }]).valid[0]?.apiName).toBe('AuthAPI');
  });

  it('ignores extra fields', () => {
    const { valid } = parseItems([{ api_name: 'AuthAPI', status_code: 200, region: 'eu', nested: { a: 1 } }]);
    expect(Object.keys(valid[0] ?? {})).toEqual(['index', 'apiName', 'statusCode', 'responseTimeMs', 'recordsReturned']);
  });

  it('keeps malformed metrics, which the detector reports as anomalies', () => {
    const { valid, invalid } = parseItems([{ api_name: 'ImagingAPI', response_time_ms: '850ms' }]);
    expect(invalid).toEqual([]);
    expect(valid[0]).toMatchObject({ responseTimeMs: '850ms', statusCode: undefined, recordsReturned: undefined });
  });

  it('rejects only the bad items, with their original positions', () => {
    const { valid, invalid } = parseItems([
      { api_name: 'A' },
      {},
      { api_name: '   ' },
      'text',
      { api_name: 7 },
      null,
      { api_name: null },
      [1, 2],
      { api_name: 'B' },
    ]);
    expect(valid.map((item) => [item.index, item.apiName])).toEqual([
      [0, 'A'],
      [8, 'B'],
    ]);
    expect(invalid).toEqual([
      { index: 1, reason: 'api_name is missing' },
      { index: 2, reason: 'api_name must be a non-empty string' },
      { index: 3, reason: 'item must be a JSON object' },
      { index: 4, reason: 'api_name must be a non-empty string' },
      { index: 5, reason: 'item must be a JSON object' },
      { index: 6, reason: 'api_name is missing' },
      { index: 7, reason: 'item must be a JSON object' },
    ]);
  });
});
