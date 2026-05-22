import { createWorker } from 'tesseract.js';
import { IOcrProvider } from './ocrAdapter.service';
import { OcrResult, OcrUnavailableError } from '../types';
import { OcrImagePreprocessor } from './ocrPreprocessor.service';

/**
 * TesseractOcrAdapter — local, offline OCR engine implementation.
 * Uses tesseract.js under the hood for local testing without external APIs.
 * 
 * @trace COMP-002 — Pluggable Adapter architecture
 */
export class TesseractOcrAdapter implements IOcrProvider {
  /**
   * Extract text from a base64 encoded image payload.
   * 
   * @param base64 — The image payload in base64 format (with or without data: URI header).
   * @returns Resolves to an OcrResult envelope.
   * @throws {OcrUnavailableError} If OCR processing fails.
   */
  async extract(base64: string): Promise<OcrResult> {
    // 1. Strip potential Data URI scheme prefix (e.g. "data:image/jpeg;base64,")
    const payload = base64.includes(',') ? base64.split(',')[1] : base64;
    const rawBuffer = Buffer.from(payload, 'base64');

    // 2. Run image preprocessing pipeline (grayscale, sharpen, normalise, negate, threshold)
    const buffer = await OcrImagePreprocessor.processForOcr(rawBuffer);

    let worker: any = null;
    try {
      console.log('[Tesseract OCR] Initializing local worker (Spanish + English)...');
      
      // Initialize the worker with Spanish (primary) and English (secondary) training data.
      worker = await createWorker('spa+eng');

      console.log('[Tesseract OCR] Running local text recognition...');
      const { data } = await worker.recognize(buffer);
      const text = data.text;
      const confidence = data.confidence; // 0 to 100

      if (!text || !text.trim()) {
        throw new Error('No text was recognized in the image.');
      }

      // 2. Clean and normalize the raw text
      const rawText = text.replace(/[\x00-\x1F\x7F]/g, ' ').replace(/\s+/g, ' ').trim();

      // 3. Extract individual lines
      const lines = text
        .split(/\r?\n/)
        .map((line: string) => line.replace(/[\x00-\x1F\x7F]/g, ' ').replace(/\s+/g, ' ').trim())
        .filter((line: string) => line.length > 0);

      // 4. Normalize tesseract confidence (0-100) to standard 0-1 scale
      const normalizedConfidence = (confidence ?? 0) / 100;

      console.log(`[Tesseract OCR] Successful extraction. Confidence: ${normalizedConfidence.toFixed(2)}`);

      return {
        rawText,
        confidence: normalizedConfidence,
        lines
      };
    } catch (error: any) {
      console.error('[Tesseract OCR Error] Extraction failed:', error.message);
      throw new OcrUnavailableError(`Tesseract OCR processing failed: ${error.message}`);
    } finally {
      if (worker) {
        console.log('[Tesseract OCR] Terminating worker to release resources...');
        await worker.terminate();
      }
    }
  }
}
