import { IOcrProvider } from './ocrAdapter.service';
import { OcrResult, OcrUnavailableError } from '../types';
import { env } from '../config/env';
import { OcrImagePreprocessor } from './ocrPreprocessor.service';

const MAX_RETRIES = 2;
const BACKOFF_MS = [200, 400];
const REQUEST_TIMEOUT_MS = 60000; // Give LLMs 60s to respond

interface NvidiaApiResponse {
  choices?: Array<{
    message?: {
      content: string;
    };
  }>;
  error?: {
    message: string;
  };
}

function normalizeOcrText(raw: string): string {
  const withoutControls = raw.replace(/[\x00-\x1F\x7F]/g, ' ');
  return withoutControls.replace(/\s+/g, ' ').trim();
}

export class NvidiaOcrAdapter implements IOcrProvider {
  private readonly apiKey: string;
  private readonly endpoint = 'https://integrate.api.nvidia.com/v1/chat/completions';
  private readonly model: string;

  constructor() {
    this.apiKey = env.NVIDIA_API_KEY;
    this.model = env.NVIDIA_MODEL;
    if (!this.apiKey) {
      throw new Error('NVIDIA_API_KEY is required for NvidiaOcrAdapter');
    }
  }

  async extract(base64: string): Promise<OcrResult> {
    const raw = base64.includes(',') ? base64.split(',')[1] : base64;

    // Run image preprocessing pipeline to reduce token cost / improve clarity
    const rawBuffer = Buffer.from(raw, 'base64');
    const processedBuffer = await OcrImagePreprocessor.processForOcr(rawBuffer);
    const payload = processedBuffer.toString('base64');
    
    const dataUri = `data:image/jpeg;base64,${payload}`;

    return this.attemptRequest(dataUri, 0);
  }

  private async attemptRequest(dataUri: string, attempt: number): Promise<OcrResult> {
    try {
      return await this.executeRequest(dataUri);
    } catch (error) {
      const err = error as Error;
      const retryable = this.isRetryableError(err);
      if (!retryable || attempt >= MAX_RETRIES) {
        console.error(`[NVIDIA OCR Error] Failed to extract text:`, err.message);
        throw new OcrUnavailableError(
          `NVIDIA API failed after ${attempt + 1} attempts: ${err.message}`
        );
      }

      const backoffMs = BACKOFF_MS[attempt];
      await new Promise(resolve => setTimeout(resolve, backoffMs));
      return this.attemptRequest(dataUri, attempt + 1);
    }
  }

  private async executeRequest(dataUri: string): Promise<OcrResult> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      console.log(`[NVIDIA OCR] Sending request to NVIDIA APIs (${this.model})...`);
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Extract all the text from this food ingredient label. Only return the exact raw text as it appears on the label. Do not add any conversational text or formatting. Just the raw text.'
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: dataUri
                  }
                }
              ]
            }
          ],
          max_tokens: 2048,
          temperature: 0.15,
          top_p: 1.00,
          frequency_penalty: 0.00,
          presence_penalty: 0.00,
          stream: false
        }),
        signal: controller.signal
      });

      console.log(`[NVIDIA OCR] Received HTTP ${response.status} from NVIDIA APIs`);

      if (response.status >= 500) {
        throw new Error(`NVIDIA API returned ${response.status}`);
      }

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`NVIDIA API error ${response.status}: ${errorBody}`);
      }

      const data = await response.json() as NvidiaApiResponse;
      return this.parseResponse(data);
    } catch (err: any) {
      console.error(`[NVIDIA OCR] fetch() threw an error:`, err.message || err.name);
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private parseResponse(data: NvidiaApiResponse): OcrResult {
    if (data.error) {
      throw new Error(`NVIDIA API error: ${data.error.message}`);
    }

    const fullText = data.choices?.[0]?.message?.content || '';

    if (!fullText.trim()) {
      throw new Error('No text detected in image');
    }

    const normalized = normalizeOcrText(fullText);
    const lines = fullText
      .split(/\r?\n/)
      .map(line => normalizeOcrText(line))
      .filter(line => line.trim().length > 0);

    return {
      rawText: normalized,
      confidence: 1.0, // LLMs don't return an OCR confidence score typically, so we assume 1.0
      lines
    };
  }

  private isRetryableError(error: Error): boolean {
    if (error.name === 'AbortError') return true;
    if (error.message.includes('ECONNREFUSED')) return true;
    if (error.message.includes('ECONNRESET')) return true;
    if (error.message.includes('ETIMEDOUT')) return true;
    if (/5\d{2}/.test(error.message)) return true;
    // Rate limits (429) can also be retryable
    if (/429/.test(error.message)) return true;
    return false;
  }
}
