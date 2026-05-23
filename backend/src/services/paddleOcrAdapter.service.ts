/**
 * @fileoverview PaddleOCR Adapter — Decoupled HTTP client for the self-hosted
 * PaddleOCR FastAPI microservice sidecar.
 *
 * Implements the {@link IOcrProvider} interface contract so it can be swapped
 * in as a drop-in replacement for GcpVisionAdapter, TesseractOcrAdapter, or
 * MockOcrAdapter via the `OCR_PROVIDER` environment variable.
 *
 * NFR-PERF-002: Hard 1,500 ms request timeout via AbortController.
 * NFR-REL-002:  Exponential-backoff retry (200 ms → 400 ms, max 2 retries)
 *               on AbortError, connection failures, and HTTP 5xx responses.
 *
 * IEEE 29148 trace: FR-OCR-001, NFR-EXT-001 (provider swappability),
 * NFR-PERF-002, NFR-REL-002.
 */

import { IOcrProvider } from './ocrAdapter.service';
import { OcrResult, OcrUnavailableError } from '../types';
import { env } from '../config/env';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Hard timeout ceiling for a single HTTP request (NFR-PERF-002). */
const REQUEST_TIMEOUT_MS = 60_000;

/** Maximum number of sequential retries before propagating the failure. */
const MAX_RETRIES = 2;

/**
 * Exponential backoff timeline in milliseconds.
 * Retry 1: 200 ms delay, Retry 2: 400 ms delay (NFR-REL-002).
 */
const BACKOFF_MS: readonly number[] = [200, 400] as const;

// ---------------------------------------------------------------------------
// Response contract from the Python microservice
// ---------------------------------------------------------------------------

interface PaddleOcrSuccessResponse {
  status: 'success';
  rawText: string;
}

interface PaddleOcrErrorResponse {
  status: 'error';
  errorCode: string;
  message: string;
}

type PaddleOcrResponse = PaddleOcrSuccessResponse | PaddleOcrErrorResponse;

// ---------------------------------------------------------------------------
// PaddleOcrAdapter
// ---------------------------------------------------------------------------

/**
 * HTTP adapter client that delegates OCR extraction to the self-hosted
 * PaddleOCR FastAPI container over the internal service network.
 *
 * @example
 * ```ts
 * const adapter = new PaddleOcrAdapter();
 * const result = await adapter.extract(base64ImageString);
 * console.log(result.rawText);
 * ```
 */
export class PaddleOcrAdapter implements IOcrProvider {
  /**
   * Fully-qualified URL of the PaddleOCR extraction endpoint.
   * Read from `env.OCR_SERVICE_URL` at construction time.
   */
  private readonly endpointUrl: string;

  constructor() {
    const baseUrl = env.OCR_SERVICE_URL;
    if (!baseUrl) {
      throw new Error('OCR_SERVICE_URL is required for PaddleOcrAdapter');
    }
    // Ensure no trailing slash before appending the path
    this.endpointUrl = `${baseUrl.replace(/\/+$/, '')}/v1/ocr/extract`;
    console.log(`[PaddleOCR Adapter] Endpoint configured: ${this.endpointUrl}`);
  }

  // -----------------------------------------------------------------------
  // Public interface (IOcrProvider contract)
  // -----------------------------------------------------------------------

  /**
   * Extract text from a Base64-encoded image by dispatching the payload to
   * the PaddleOCR microservice.
   *
   * @param base64 — Raw Base64-encoded image (with or without data-URI prefix).
   * @returns An {@link OcrResult} containing the normalized text, confidence,
   *          and individual lines.
   * @throws {OcrUnavailableError} If all retry attempts are exhausted.
   */
  async extract(base64: string): Promise<OcrResult> {
    // Strip the optional data-URI scheme prefix (e.g. "data:image/jpeg;base64,")
    const payload = base64.includes(',') ? base64.split(',')[1] : base64;
    return this.attemptRequest(payload, 0);
  }

  // -----------------------------------------------------------------------
  // Retry state machine (recursive)
  // -----------------------------------------------------------------------

  /**
   * Recursive retry loop with exponential backoff.
   *
   * @param base64  — Clean Base64 payload (no data-URI prefix).
   * @param attempt — Zero-based attempt counter.
   */
  private async attemptRequest(base64: string, attempt: number): Promise<OcrResult> {
    try {
      return await this.executeRequest(base64);
    } catch (error) {
      const err = error as Error;
      const retryable = this.isRetryableError(err);

      if (!retryable || attempt >= MAX_RETRIES) {
        console.error(
          `[PaddleOCR Adapter] Failed after ${attempt + 1} attempt(s): ${err.message}`,
        );
        throw new OcrUnavailableError(
          `PaddleOCR service failed after ${attempt + 1} attempt(s): ${err.message}`,
        );
      }

      const delayMs = BACKOFF_MS[attempt];
      console.warn(
        `[PaddleOCR Adapter] Attempt ${attempt + 1} failed (${err.message}). ` +
        `Retrying in ${delayMs} ms…`,
      );
      await this.sleep(delayMs);
      return this.attemptRequest(base64, attempt + 1);
    }
  }

  // -----------------------------------------------------------------------
  // HTTP execution
  // -----------------------------------------------------------------------

  /**
   * Execute a single HTTP POST to the PaddleOCR endpoint with an
   * AbortController-enforced timeout.
   */
  private async executeRequest(base64: string): Promise<OcrResult> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      console.log(`[PaddleOCR Adapter] Dispatching request to ${this.endpointUrl}…`);

      const response = await fetch(this.endpointUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imagePayload: base64 }),
        signal: controller.signal,
      });

      console.log(`[PaddleOCR Adapter] Received HTTP ${response.status}.`);

      // 5xx errors are retryable — throw so the retry loop catches them
      if (response.status >= 500) {
        throw new Error(`PaddleOCR sidecar returned HTTP ${response.status}`);
      }

      // Non-success, non-5xx (e.g. 422 processing error) — not retryable
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({})) as Partial<PaddleOcrErrorResponse>;
        throw new Error(
          errorBody.message || `PaddleOCR request failed with HTTP ${response.status}`,
        );
      }

      const data = (await response.json()) as PaddleOcrResponse;
      return this.parseResponse(data);

    } catch (err: any) {
      // Re-throw with a clearer name for abort scenarios
      if (err.name === 'AbortError') {
        throw new Error(
          `PaddleOCR request aborted: exceeded ${REQUEST_TIMEOUT_MS} ms timeout ceiling (NFR-PERF-002)`,
        );
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // -----------------------------------------------------------------------
  // Response parsing
  // -----------------------------------------------------------------------

  /**
   * Transform the PaddleOCR microservice response into the standard
   * {@link OcrResult} envelope consumed by the upstream analyze controller.
   */
  private parseResponse(data: PaddleOcrResponse): OcrResult {
    if (data.status !== 'success' || !('rawText' in data)) {
      const errData = data as PaddleOcrErrorResponse;
      throw new Error(
        `PaddleOCR returned error: [${errData.errorCode}] ${errData.message}`,
      );
    }

    const rawText = data.rawText;

    if (!rawText.trim()) {
      throw new Error('PaddleOCR returned empty text — no text detected in image.');
    }

    // Split into individual lines for downstream ingredient parsing
    const lines = rawText
      .split(/\r?\n/)
      .map((line) => line.replace(/\s+/g, ' ').trim())
      .filter((line) => line.length > 0);

    return {
      rawText: rawText.replace(/\s+/g, ' ').trim(),
      // PaddleOCR does not return an aggregate confidence score through the
      // REST interface — we report 1.0 as a placeholder. Per-line confidence
      // is available in the Python service if needed in the future.
      confidence: 1.0,
      lines,
    };
  }

  // -----------------------------------------------------------------------
  // Error classification
  // -----------------------------------------------------------------------

  /**
   * Determine whether an error should trigger a retry.
   * Retryable conditions:
   *   - AbortError (timeout)
   *   - Network-level socket errors (ECONNREFUSED, ECONNRESET, ETIMEDOUT)
   *   - HTTP 5xx server errors
   */
  private isRetryableError(error: Error): boolean {
    if (error.name === 'AbortError') return true;
    const msg = error.message;
    if (msg.includes('aborted')) return true;
    if (msg.includes('ECONNREFUSED')) return true;
    if (msg.includes('ECONNRESET')) return true;
    if (msg.includes('ETIMEDOUT')) return true;
    if (msg.includes('ENOTFOUND')) return true;
    if (/HTTP 5\d{2}/.test(msg)) return true;
    return false;
  }

  // -----------------------------------------------------------------------
  // Utilities
  // -----------------------------------------------------------------------

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
