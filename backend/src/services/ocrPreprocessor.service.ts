import sharp from 'sharp';

export interface PreprocessedVariant {
  name: string;
  buffer: Buffer;
}

/**
 * OcrImagePreprocessor — server-side image conditioning pipeline.
 *
 * Implements an A/B ensemble preprocessing strategy. Instead of forcing
 * one strict pipeline (which might destroy some labels while fixing others),
 * it generates multiple variants of the image to test against the OCR engine.
 *
 * @trace COMP-002 — Pluggable Adapter architecture (preprocessing layer)
 */
export class OcrImagePreprocessor {
  /**
   * Transforms a raw camera image buffer into multiple clean text matrices.
   *
   * @param imageBuffer — Raw image bytes decoded from base64 payload
   * @returns Array of preprocessed image variants ready for OCR extraction
   */
  public static async processForOcrVariants(imageBuffer: Buffer): Promise<PreprocessedVariant[]> {
    console.log('[OCR Preprocessor] Starting dynamic A/B image preprocessing pipeline...');

    // Base processing: Strip color and upscale for pixel density
    const baseImage = sharp(imageBuffer)
      .grayscale()
      .resize({ width: 2400, withoutEnlargement: true });

    // Variant A: Standard Binarization (Normal labels)
    const variantA = await baseImage.clone()
      .sharpen({ sigma: 1.5, m1: 0.5, m2: 2.0 })
      .normalise()
      .threshold(150)
      .toBuffer();

    // Variant B: Negated Binarization (For white text on dark background)
    const variantB = await baseImage.clone()
      .sharpen({ sigma: 1.5, m1: 0.5, m2: 2.0 })
      .normalise()
      .negate({ alpha: false })
      .threshold(140)
      .toBuffer();

    // Variant C: High Contrast Stretch without hard binarization (Good for dealing with specular glare)
    const variantC = await baseImage.clone()
      .sharpen({ sigma: 1.5, m1: 0.5, m2: 2.0 })
      .linear(1.5, -(128 * 0.5)) // Contrast stretch formula approximation
      .toBuffer();

    console.log(`[OCR Preprocessor] Pipeline complete. Generated 3 image variants.`);
    
    return [
      { name: 'Standard_B&W', buffer: variantA },
      { name: 'Negated_B&W', buffer: variantB },
      { name: 'HighContrast_Soft', buffer: variantC }
    ];
  }

  /**
   * Backwards-compatible method for other OCR adapters that only expect a single buffer.
   * Runs the standard preprocessing variant.
   */
  public static async processForOcr(imageBuffer: Buffer): Promise<Buffer> {
    const variants = await this.processForOcrVariants(imageBuffer);
    return variants[0].buffer; // Return Standard_B&W variant
  }
}
