import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';
import { InvalidImageError } from '../types';

/**
 * Calculates the exact binary byte size of a Base64-encoded string.
 * Accounts for padding characters to avoid overestimation.
 * @param base64 The Base64 string to measure (may include data URI prefix)
 * @returns Exact byte count of the decoded binary data
 */
function calculateBase64ByteSize(base64: string): number {
  // Remove data URI prefix if present (e.g., "data:image/jpeg;base64,")
  const stripped = base64.includes(',') ? base64.split(',')[1] : base64;
  // Remove any whitespace or newlines that might be in the payload
  const cleaned = stripped.replace(/[\r\n\s]+/g, '');

  const len = cleaned.length;
  // Count trailing padding characters
  let padding = 0;
  if (len >= 2 && cleaned[len - 1] === '=') padding++;
  if (len >= 2 && cleaned[len - 2] === '=') padding++;

  return Math.ceil(len * 3 / 4) - padding;
}

/**
 * Validates that the Base64 string contains only valid characters.
 * Supports both raw Base64 and data URI prefixed strings.
 * @param str The string to validate
 * @returns `true` if the string is valid Base64
 */
function isValidBase64(str: string): boolean {
  const stripped = str.includes(',') ? str.split(',')[1] : str;
  const cleaned = stripped.replace(/[\r\n\s]+/g, '');
  return /^[A-Za-z0-9+/]*={0,2}$/.test(cleaned);
}

/**
 * Middleware that validates the `imagePayload` field in the request body.
 * Enforces the 2 MB binary size limit using exact byte calculation
 * (not naive Base64 string length).
 *
 * Checks performed:
 * 1. `imagePayload` is present and is a string
 * 2. `imagePayload` is non-empty
 * 3. `imagePayload` contains only valid Base64 characters
 * 4. Decoded binary size is < `env.MAX_IMAGE_BYTES` (default 2 097 152)
 *
 * @trace FR-IMG-001 — Image payload validation
 * @trace NFR-SEC-002 — Image payload must be < 2 MB
 */
export function imageSizeMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  try {
    const { imagePayload } = req.body as { imagePayload?: unknown };

    if (!imagePayload || typeof imagePayload !== 'string') {
      throw new InvalidImageError('Missing or non-string imagePayload field');
    }

    if (imagePayload.length === 0) {
      throw new InvalidImageError('Empty imagePayload');
    }

    if (!isValidBase64(imagePayload)) {
      throw new InvalidImageError('imagePayload contains invalid Base64 characters');
    }

    const byteSize = calculateBase64ByteSize(imagePayload);

    if (byteSize >= env.MAX_IMAGE_BYTES) {
      throw new InvalidImageError(
        `Image size ${byteSize} bytes exceeds maximum of ${env.MAX_IMAGE_BYTES} bytes (${(env.MAX_IMAGE_BYTES / 1048576).toFixed(1)}MB)`
      );
    }

    next();
  } catch (error) {
    next(error);
  }
}
