import { OcrResult, OcrUnavailableError } from '../types';
import { env } from '../config/env';
import { OcrImagePreprocessor } from './ocrPreprocessor.service';

export interface IOcrProvider {
  extract(base64: string): Promise<OcrResult>;
}

const MAX_RETRIES = 2;
const BACKOFF_MS = [200, 400];
const REQUEST_TIMEOUT_MS = 10000;

interface GcpVisionResponse {
  responses: Array<{
    textAnnotations?: Array<{
      description: string;
      boundingPoly?: unknown;
    }>;
    fullTextAnnotation?: {
      text: string;
      pages: Array<{
        confidence: number;
        blocks: Array<{
          paragraphs: Array<{
            words: Array<{
              symbols: Array<{ text: string }>;
            }>;
          }>;
        }>;
      }>;
    };
    error?: {
      code: number;
      message: string;
    };
  }>;
}

function normalizeOcrText(raw: string): string {
  const withoutControls = raw.replace(/[\x00-\x1F\x7F]/g, ' ');
  return withoutControls.replace(/\s+/g, ' ').trim();
}

export class GcpVisionAdapter implements IOcrProvider {
  private readonly apiKey: string;
  private readonly endpoint: string;

  constructor() {
    this.apiKey = env.GCP_VISION_KEY;
    if (!this.apiKey) {
      throw new Error('GCP_VISION_KEY is required for GcpVisionAdapter');
    }
    const baseUrl = env.GCP_VISION_URL;
    if (!baseUrl) {
      throw new Error('GCP_VISION_URL is required for GcpVisionAdapter');
    }
    this.endpoint = `${baseUrl}?key=${this.apiKey}`;
  }

  async extract(base64: string): Promise<OcrResult> {
    const raw = base64.includes(',') ? base64.split(',')[1] : base64;
    const rawBuffer = Buffer.from(raw, 'base64');

    const variants = typeof (OcrImagePreprocessor as any).processForOcrVariants === 'function'
      ? await OcrImagePreprocessor.processForOcrVariants(rawBuffer)
      : [{
          name: 'Preprocessed_Default',
          buffer: await OcrImagePreprocessor.processForOcr(rawBuffer)
        }];
    const candidates = [
      { name: 'Camera_Original', buffer: rawBuffer },
      ...this.prioritizeVariants(variants)
    ];

    let bestResult: OcrResult | null = null;
    let lastError: Error | null = null;

    for (const candidate of candidates) {
      try {
        const result = await this.attemptRequest(candidate.buffer.toString('base64'), 0, candidate.name);
        bestResult = this.pickBetterResult(bestResult, result);

        if (this.isUsefulLabelText(result)) {
          console.log(`[GCP Vision] Selected OCR candidate: ${candidate.name}`);
          return result;
        }
      } catch (error) {
        lastError = error as Error;
        console.warn(`[GCP Vision] Candidate ${candidate.name} rejected: ${lastError.message}`);
      }
    }

    if (bestResult) {
      console.log('[GCP Vision] Returning best low-confidence OCR candidate after trying all variants.');
      return bestResult;
    }

    throw new OcrUnavailableError(
      `GCP Vision failed on all OCR candidates: ${lastError?.message || 'No text detected in image'}`
    );
  }

  private prioritizeVariants(variants: Array<{ name: string; buffer: Buffer; regionGroup?: string }>) {
    const priority = (name: string, regionGroup?: string): number => {
      if (name === 'Label_No_Barcode_Soft') return 1;
      if (name === 'Gray_Soft_Contrast') return 2;
      if (name === 'HighContrast_Glare_Soft') return 3;
      if (name === 'Label_No_Barcode_Adaptive_Text') return 4;
      if (name === 'Dark_Label_Adaptive_Text') return 5;
      if (regionGroup) return 8;
      return 6;
    };

    return [...variants].sort((a, b) => priority(a.name, a.regionGroup) - priority(b.name, b.regionGroup));
  }

  private pickBetterResult(current: OcrResult | null, candidate: OcrResult): OcrResult {
    if (!current) return candidate;
    return this.scoreOcrResult(candidate) > this.scoreOcrResult(current) ? candidate : current;
  }

  private scoreOcrResult(result: OcrResult): number {
    const text = result.rawText;
    const signalScore = /ingredientes?|al[eé]rgenos?|aditivos?|agua\s+mineral|composici[oó]n\s+anal[ií]tica|conservar|e-?\d{3}/i.test(text)
      ? 250
      : 0;
    const barcodePenalty = /^\s*[\d\s|]{8,}\s*$/.test(text) ? 300 : 0;
    return text.length + result.lines.length * 12 + result.confidence * 100 + signalScore - barcodePenalty;
  }

  private isUsefulLabelText(result: OcrResult): boolean {
    const text = result.rawText;
    if (/^\s*[\d\s|]{8,}\s*$/.test(text)) return false;
    if (/ingredientes?|al[eé]rgenos?|aditivos?|agua\s+mineral|composici[oó]n\s+anal[ií]tica|conservar|e-?\d{3}/i.test(text)) {
      return true;
    }
    return text.length >= 120 && result.lines.length >= 3;
  }

  private async attemptRequest(base64: string, attempt: number, candidateName: string): Promise<OcrResult> {
    try {
      return await this.executeRequest(base64, candidateName);
    } catch (error) {
      const err = error as Error;
      const retryable = this.isRetryableError(err);
      if (!retryable || attempt >= MAX_RETRIES) {
        console.error(`[GCP Vision Error] Failed to extract text from ${candidateName}:`, err.message);
        throw new OcrUnavailableError(
          `GCP Vision failed for ${candidateName} after ${attempt + 1} attempts: ${err.message}`
        );
      }

      const backoffMs = BACKOFF_MS[attempt];
      await new Promise(resolve => setTimeout(resolve, backoffMs));
      return this.attemptRequest(base64, attempt + 1, candidateName);
    }
  }

  private async executeRequest(base64: string, candidateName: string): Promise<OcrResult> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      console.log(`[GCP Vision] Sending request to Google APIs (${candidateName})...`);
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [{
            image: { content: base64 },
            features: [{ type: 'DOCUMENT_TEXT_DETECTION', maxResults: 1 }]
          }]
        }),
        signal: controller.signal
      });

      console.log(`[GCP Vision] Received HTTP ${response.status} from Google APIs (${candidateName})`);

      if (response.status >= 500) {
        throw new Error(`GCP Vision returned ${response.status}`);
      }

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`GCP Vision error ${response.status}: ${errorBody}`);
      }

      const data = await response.json() as GcpVisionResponse;
      return this.parseResponse(data);
    } catch (err: any) {
      console.error(`[GCP Vision] fetch() threw an error:`, err.message || err.name);
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private parseResponse(data: GcpVisionResponse): OcrResult {
    const firstResponse = data.responses?.[0];
    if (!firstResponse) {
      throw new Error('Empty response from GCP Vision');
    }

    if (firstResponse.error) {
      throw new Error(`GCP Vision API error: ${firstResponse.error.message}`);
    }

    const fullText = firstResponse.fullTextAnnotation?.text ||
      firstResponse.textAnnotations?.[0]?.description || '';

    if (!fullText.trim()) {
      throw new Error('No text detected in image');
    }

    const normalized = normalizeOcrText(fullText);
    const confidence = firstResponse.fullTextAnnotation?.pages?.[0]?.confidence ?? 0;
    const lines = fullText
      .split(/\r?\n/)
      .map(line => normalizeOcrText(line))
      .filter(line => line.trim().length > 0);

    return {
      rawText: normalized,
      confidence,
      lines
    };
  }

  private isRetryableError(error: Error): boolean {
    if (error.name === 'AbortError') return true;
    if (error.message.includes('ECONNREFUSED')) return true;
    if (error.message.includes('ECONNRESET')) return true;
    if (error.message.includes('ETIMEDOUT')) return true;
    if (/5\d{2}/.test(error.message)) return true;
    return false;
  }
}
