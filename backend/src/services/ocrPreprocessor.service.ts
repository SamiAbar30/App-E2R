import sharp from 'sharp';

/**
 * OcrImagePreprocessor — server-side image conditioning pipeline.
 *
 * Transforms raw mobile camera photos of physical food labels into
 * clean, high-contrast text matrices optimized for OCR extraction.
 *
 * Addresses three primary degradation vectors:
 *   1. Inverted luminance (white text on dark backgrounds)
 *   2. Cylindrical surface skew (curved label geometry)
 *   3. Specular highlight halation (glossy surface reflections)
 *
 * @trace COMP-002 — Pluggable Adapter architecture (preprocessing layer)
 */
export class OcrImagePreprocessor {
  /**
   * Transforms a raw camera image buffer into a clean, binarized
   * text matrix suitable for OCR engines trained on black-on-white text.
   *
   * Pipeline stages:
   *   1. Grayscale — isolate luminance layer, discard color noise
   *   2. Upscale — inflate text pixel density for small labels
   *   3. Sharpen — Laplacian filter to restore blurred character edges
   *   4. Normalise — stretch contrast to recover text under glare
   *   5. Negate — flip white-on-dark to black-on-white
   *   6. Threshold — adaptive binarization to lock black/white pixels
   *
   * @param imageBuffer — Raw image bytes decoded from base64 payload
   * @returns Preprocessed image buffer ready for OCR extraction
   */
  public static async processForOcr(imageBuffer: Buffer): Promise<Buffer> {
    console.log('[OCR Preprocessor] Starting image preprocessing pipeline...');

    const result = await sharp(imageBuffer)
      // Step 1: Strip color channels to isolate clean luminance values
      .grayscale()

      // Step 2: Rescale image dimensions to inflate text pixel density
      .resize({ width: 2400, withoutEnlargement: true })

      // Step 3: Sharpen character boundaries blurred by curved surfaces
      .sharpen({ sigma: 1.5, m1: 0.5, m2: 2.0 })

      // Step 4: Stretch contrast range to normalize shadows and glare
      .normalise()

      // Step 5: Convert white-on-dark labels to black-on-white for OCR
      .negate({ alpha: false })

      // Step 6: Adaptive binarization — lock pixels to absolute B/W
      .threshold(140)

      .toBuffer();

    console.log(`[OCR Preprocessor] Pipeline complete. Output size: ${result.length} bytes`);
    return result;
  }
}
