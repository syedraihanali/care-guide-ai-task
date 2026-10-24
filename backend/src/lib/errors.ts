/** An error with an HTTP status and a stable code, turned into a JSON response by the error handler. */
export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const validationError = (message: string, details?: unknown) =>
  new AppError(400, 'VALIDATION_ERROR', message, details);

export const notFoundError = (message: string) => new AppError(404, 'NOT_FOUND', message);

export const payloadTooLargeError = (message: string) => new AppError(413, 'PAYLOAD_TOO_LARGE', message);
