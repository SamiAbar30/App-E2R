import { Request, Response, NextFunction } from 'express';
import { AppError, ApiEnvelope } from '../types';

/**
 * Global error handling middleware.
 * Maps known `AppError` subclasses to appropriate HTTP responses using the
 * project's standard API envelope format. Unknown errors return 500.
 *
 * Handles:
 * - `AppError` subclasses → mapped `statusCode` + typed `errorCode`
 * - `SyntaxError` with `body` property → 400 INVALID_JSON (Express JSON parse)
 * - All other errors → 500 INTERNAL_ERROR (message hidden in production)
 *
 * @trace NFR-REL-001 — System must return structured error responses
 */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error(`[ERROR] ${err.name}: ${err.message}`);

  if (err instanceof AppError) {
    const envelope: ApiEnvelope<null> = {
      status: 'error',
      data: null,
      code: err.errorCode,
      message: err.message,
    };
    res.status(err.statusCode).json(envelope);
    return;
  }

  // Handle JSON parse errors from Express body-parser
  if (err instanceof SyntaxError && 'body' in err) {
    const envelope: ApiEnvelope<null> = {
      status: 'error',
      data: null,
      code: 'INVALID_JSON',
      message: 'Request body contains invalid JSON',
    };
    res.status(400).json(envelope);
    return;
  }

  // Unknown/unhandled error — hide details in production
  const envelope: ApiEnvelope<null> = {
    status: 'error',
    data: null,
    code: 'INTERNAL_ERROR',
    message: process.env.NODE_ENV === 'production'
      ? 'An internal error occurred'
      : err.message,
  };
  res.status(500).json(envelope);
}
