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

    // 2. Generate multiple preprocessed variants for A/B testing
    const variants = await OcrImagePreprocessor.processForOcrVariants(rawBuffer);

    let worker: any = null;
    try {
      console.log('[Tesseract OCR] Initializing local worker (Spanish + English)...');
      worker = await createWorker('spa+eng');
      
      // 3. Engine Tuning: Optimize for sparse text (labels) and disable dictionaries 
      // to prevent hallucinating words out of chemicals/numbers.
      await worker.setParameters({
        tessedit_pageseg_mode: '11',
        load_system_dawg: '0',
        load_freq_dawg: '0'
      });

      console.log('[Tesseract OCR] Running dynamic A/B extraction...');
      
      let bestResult: OcrResult | null = null;
      let highestConfidence = -1;

      // 4. Test each variant sequentially
      for (const variant of variants) {
        console.log(`[Tesseract OCR] Testing variant: ${variant.name}...`);
        const { data } = await worker.recognize(variant.buffer);
        const text = data.text;
        const confidence = data.confidence; // 0 to 100

        if (!text || !text.trim()) {
          console.log(`[Tesseract OCR] Variant ${variant.name} yielded no text.`);
          continue;
        }

        // Clean and normalize the raw text
        const rawText = text.replace(/[\x00-\x1F\x7F]/g, ' ').replace(/\s+/g, ' ').trim();
        const lines = text
          .split(/\r?\n/)
          .map((line: string) => line.replace(/[\x00-\x1F\x7F]/g, ' ').replace(/\s+/g, ' ').trim())
          .filter((line: string) => line.length > 0);

        // Normalize tesseract confidence (0-100) to standard 0-1 scale
        const normalizedConfidence = (confidence ?? 0) / 100;

        if (normalizedConfidence > highestConfidence) {
          highestConfidence = normalizedConfidence;
          bestResult = {
            rawText,
            confidence: normalizedConfidence,
            lines
          };
        }

        // Early Exit: if confidence is excellent, skip processing remaining variants
        if (normalizedConfidence >= 0.80) {
          console.log(`[Tesseract OCR] Early exit triggered on ${variant.name} (Confidence: ${normalizedConfidence.toFixed(2)})`);
          break;
        }
      }

      if (!bestResult) {
        throw new Error('No text was recognized in any of the image variants.');
      }

      console.log(`[Tesseract OCR] Successful extraction. Final Confidence: ${bestResult.confidence.toFixed(2)}`);
      return bestResult;
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
