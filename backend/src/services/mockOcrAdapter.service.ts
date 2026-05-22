import { IOcrProvider } from './ocrAdapter.service';
import { OcrResult } from '../types';

export class MockOcrAdapter implements IOcrProvider {
  async extract(base64: string): Promise<OcrResult> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 800));

    const rawText = "Ingredients: Water, Sugar, Citric Acid (E330), Natural Flavors, Peanuts, Sodium Benzoate.";

    return {
      rawText,
      confidence: 0.98,
      lines: [
        "Ingredients: Water, Sugar,",
        "Citric Acid (E330), Natural Flavors,",
        "Peanuts, Sodium Benzoate."
      ]
    };
  }
}
