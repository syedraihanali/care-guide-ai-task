import type { ZodError } from 'zod';

/** Treats blank strings as missing, so optional values and defaults apply to them. */
export function blankToUndefined(value: unknown): unknown {
  return typeof value === 'string' && value.trim() === '' ? undefined : value;
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Flattens zod issues into `{ path, message }` pairs for error responses. */
export function describeZodIssues(error: ZodError): Array<{ path: string; message: string }> {
  return error.issues.map((issue) => ({ path: issue.path.map(String).join('.'), message: issue.message }));
}
