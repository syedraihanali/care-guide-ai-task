import { payloadTooLargeError, validationError } from '../../lib/errors.js';
import { isPlainObject } from '../../lib/validation.js';
import type { CheckInput } from '../../services/detector.js';

/** An input item that passed validation, with its position in the batch. */
export interface ValidItem extends CheckInput {
  index: number;
}

export interface InvalidItem {
  index: number;
  reason: string;
}

/** Accepts one API result or an array of them, and enforces the batch size limits. */
export function normalizeBatch(body: unknown, maxBatchSize: number): unknown[] {
  const items = Array.isArray(body) ? body : isPlainObject(body) ? [body] : null;
  if (!items) {
    throw validationError('Send a JSON object or an array of objects, with Content-Type: application/json');
  }
  if (items.length === 0) throw validationError('The batch is empty');
  if (items.length > maxBatchSize) {
    throw payloadTooLargeError(`The batch has ${items.length} items; the limit is ${maxBatchSize}`);
  }
  return items;
}

/**
 * Splits items into valid and invalid ones. Only a missing or blank api_name rejects an item:
 * any other problem becomes an anomaly in the detector, and the rest of the batch still runs.
 * Extra fields are ignored.
 */
export function parseItems(items: readonly unknown[]): { valid: ValidItem[]; invalid: InvalidItem[] } {
  const valid: ValidItem[] = [];
  const invalid: InvalidItem[] = [];

  items.forEach((item, index) => {
    if (!isPlainObject(item)) {
      invalid.push({ index, reason: 'item must be a JSON object' });
      return;
    }
    const apiName = item.api_name;
    if (apiName === undefined || apiName === null) {
      invalid.push({ index, reason: 'api_name is missing' });
      return;
    }
    if (typeof apiName !== 'string' || apiName.trim() === '') {
      invalid.push({ index, reason: 'api_name must be a non-empty string' });
      return;
    }
    valid.push({
      index,
      apiName: apiName.trim(),
      statusCode: item.status_code,
      responseTimeMs: item.response_time_ms,
      recordsReturned: item.records_returned,
    });
  });

  return { valid, invalid };
}
