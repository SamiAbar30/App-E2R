import sharp from 'sharp';

export type OcrProfileHint =
  | 'food_label_default'
  | 'ingredient_block'
  | 'nutrition_table'
  | 'code_digit'
  | 'screenshot';

export interface PreprocessedVariant {
  name: string;
  buffer: Buffer;
  profileHint: OcrProfileHint;
  recommendedPsms: string[];
  regionGroup?: string;
  regionOrder?: number;
  diagnostics: {
    hardThreshold: boolean;
    inverted: boolean;
    cropApplied: boolean;
    contrastStrategy: string;
  };
}

const MAX_SIDE_PX = 3200;
const UPSCALE_TARGET_WIDTH_PX = 2400;
const ANALYSIS_WIDTH_PX = 520;
const WHITE = { r: 255, g: 255, b: 255 };

let opencvLoadAttempted = false;
let opencvAvailable = false;

function warmOptionalOpenCv(): void {
  if (opencvLoadAttempted) return;
  opencvLoadAttempted = true;

  if (process.env.NODE_ENV === 'test') {
    return;
  }

  void import('@techstark/opencv-js')
    .then(() => {
      opencvAvailable = true;
    })
    .catch(() => {
      opencvAvailable = false;
    });
}

function isLikelyDarkCoolLabelPixel(r: number, g: number, b: number): boolean {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const saturation = max - min;
  const darkBlue = b > r * 0.95 && b > g * 0.65 && max < 205 && saturation > 18;
  const deepCoolShadow = max < 90 && b >= r * 0.75 && b >= g * 0.75;

  return darkBlue || deepCoolShadow;
}

function findLargestMaskComponent(mask: Uint8Array, width: number, height: number) {
  const visited = new Uint8Array(mask.length);
  const stack: number[] = [];
  let best = {
    count: 0,
    minX: 0,
    minY: 0,
    maxX: -1,
    maxY: -1
  };

  for (let index = 0; index < mask.length; index += 1) {
    if (mask[index] === 0 || visited[index] === 1) continue;

    let count = 0;
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;

    stack.push(index);
    visited[index] = 1;

    while (stack.length > 0) {
      const current = stack.pop() as number;
      const x = current % width;
      const y = Math.floor(current / width);

      count += 1;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);

      const neighbors = [
        current - 1,
        current + 1,
        current - width,
        current + width
      ];

      for (const neighbor of neighbors) {
        if (neighbor < 0 || neighbor >= mask.length) continue;
        const neighborX = neighbor % width;
        if (Math.abs(neighborX - x) > 1) continue;
        if (mask[neighbor] === 0 || visited[neighbor] === 1) continue;

        visited[neighbor] = 1;
        stack.push(neighbor);
      }
    }

    if (count > best.count) {
      best = { count, minX, minY, maxX, maxY };
    }
  }

  return best;
}

async function cropLikelyProductLabel(imageBuffer: Buffer): Promise<{ buffer: Buffer; cropApplied: boolean }> {
  const sourceMetadata = await sharp(imageBuffer).metadata();
  const sourceWidth = sourceMetadata.width ?? 0;
  const sourceHeight = sourceMetadata.height ?? 0;

  if (sourceWidth === 0 || sourceHeight === 0) {
    return { buffer: imageBuffer, cropApplied: false };
  }

  const { data, info } = await sharp(imageBuffer)
    .resize({ width: ANALYSIS_WIDTH_PX, withoutEnlargement: true })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const mask = new Uint8Array(info.width * info.height);

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const offset = (y * info.width + x) * info.channels;
      const r = data[offset];
      const g = data[offset + 1];
      const b = data[offset + 2];

      if (isLikelyDarkCoolLabelPixel(r, g, b)) {
        mask[y * info.width + x] = 1;
      }
    }
  }

  const component = findLargestMaskComponent(mask, info.width, info.height);

  if (component.count === 0) {
    return { buffer: imageBuffer, cropApplied: false };
  }

  const matchRatio = component.count / (info.width * info.height);
  const boxWidth = component.maxX - component.minX + 1;
  const boxHeight = component.maxY - component.minY + 1;
  const boxAreaRatio = (boxWidth * boxHeight) / (info.width * info.height);

  if (matchRatio < 0.025 || boxAreaRatio < 0.10 || boxAreaRatio > 0.85 || boxHeight < info.height * 0.25) {
    return { buffer: imageBuffer, cropApplied: false };
  }

  const scaleX = sourceWidth / info.width;
  const scaleY = sourceHeight / info.height;
  const padX = Math.round(boxWidth * scaleX * 0.08);
  const padY = Math.round(boxHeight * scaleY * 0.04);
  const left = Math.max(0, Math.floor(component.minX * scaleX) - padX);
  const top = Math.max(0, Math.floor(component.minY * scaleY) - padY);
  const right = Math.min(sourceWidth, Math.ceil((component.maxX + 1) * scaleX) + padX);
  const bottom = Math.min(sourceHeight, Math.ceil((component.maxY + 1) * scaleY) + padY);

  if (right - left < sourceWidth * 0.2 || bottom - top < sourceHeight * 0.2) {
    return { buffer: imageBuffer, cropApplied: false };
  }

  const cropped = await sharp(imageBuffer)
    .extract({ left, top, width: right - left, height: bottom - top })
    .extend({ top: 18, bottom: 18, left: 18, right: 18, background: WHITE })
    .png()
    .toBuffer();

  return { buffer: cropped, cropApplied: true };
}

async function cropVerticalBand(
  imageBuffer: Buffer,
  topRatio: number,
  bottomRatio: number,
  minHeightRatio: number = 0.25
): Promise<Buffer> {
  const metadata = await sharp(imageBuffer).metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;

  if (width === 0 || height === 0) {
    return imageBuffer;
  }

  const top = Math.max(0, Math.floor(height * topRatio));
  const bottom = Math.min(height, Math.ceil(height * bottomRatio));
  const bandHeight = bottom - top;

  if (bandHeight < height * minHeightRatio) {
    return imageBuffer;
  }

  return sharp(imageBuffer)
    .extract({ left: 0, top, width, height: bandHeight })
    .extend({ top: 14, bottom: 14, left: 14, right: 14, background: WHITE })
    .png()
    .toBuffer();
}

async function adaptiveWhiteTextOnDark(imageBuffer: Buffer): Promise<Buffer> {
  const prepared = sharp(imageBuffer)
    .grayscale()
    .resize({ width: UPSCALE_TARGET_WIDTH_PX, withoutEnlargement: false })
    .extend({ top: 16, bottom: 16, left: 16, right: 16, background: WHITE });
  const { data, info } = await prepared.raw().toBuffer({ resolveWithObject: true });
  const width = info.width;
  const height = info.height;
  const integral = new Float64Array((width + 1) * (height + 1));
  const output = Buffer.alloc(width * height);
  const radius = 24;
  const thresholdOffset = 10;

  for (let y = 0; y < height; y += 1) {
    let rowSum = 0;
    for (let x = 0; x < width; x += 1) {
      rowSum += data[y * width + x];
      integral[(y + 1) * (width + 1) + x + 1] = integral[y * (width + 1) + x + 1] + rowSum;
    }
  }

  for (let y = 0; y < height; y += 1) {
    const top = Math.max(0, y - radius);
    const bottom = Math.min(height - 1, y + radius);

    for (let x = 0; x < width; x += 1) {
      const left = Math.max(0, x - radius);
      const right = Math.min(width - 1, x + radius);
      const area = (right - left + 1) * (bottom - top + 1);
      const sum =
        integral[(bottom + 1) * (width + 1) + right + 1] -
        integral[top * (width + 1) + right + 1] -
        integral[(bottom + 1) * (width + 1) + left] +
        integral[top * (width + 1) + left];
      const mean = sum / area;
      const value = data[y * width + x];

      output[y * width + x] = value > mean + thresholdOffset && value > 92 ? 0 : 255;
    }
  }

  return sharp(output, {
    raw: {
      width,
      height,
      channels: 1
    }
  })
    .median(1)
    .png()
    .toBuffer();
}

async function createAdaptiveRegionVariant(
  source: Buffer,
  name: string,
  topRatio: number,
  bottomRatio: number,
  regionOrder: number,
  cropApplied: boolean
): Promise<PreprocessedVariant> {
  const band = await cropVerticalBand(source, topRatio, bottomRatio, 0.08);

  return {
    name,
    buffer: await adaptiveWhiteTextOnDark(band),
    profileHint: 'ingredient_block',
    recommendedPsms: ['6'],
    regionGroup: 'cabreiroa_label_regions',
    regionOrder,
    diagnostics: {
      hardThreshold: true,
      inverted: true,
      cropApplied,
      contrastStrategy: `region_adaptive_${topRatio}_${bottomRatio}`
    }
  };
}

/**
 * OcrImagePreprocessor - server-side image conditioning pipeline.
 *
 * Builds complementary OCR candidates for real food-label photos instead of
 * forcing one destructive transform. The variants cover soft contrast, hard
 * binarization, inverse text, glare resistance, light morphology, and strict
 * code/digit recognition.
 *
 * @trace COMP-002 - Pluggable Adapter architecture (preprocessing layer)
 */
export class OcrImagePreprocessor {
  /**
   * Transforms a raw camera image buffer into multiple OCR candidates.
   *
   * @param imageBuffer - Raw image bytes decoded from base64 payload.
   * @returns Array of preprocessed image variants ready for OCR extraction.
   */
  public static async processForOcrVariants(imageBuffer: Buffer): Promise<PreprocessedVariant[]> {
    console.log('[OCR Preprocessor] Starting production candidate-generation pipeline...');
    warmOptionalOpenCv();

    const normalized = await sharp(imageBuffer, { failOn: 'none' })
      .rotate()
      .flatten({ background: WHITE })
      .resize({
        width: MAX_SIDE_PX,
        height: MAX_SIDE_PX,
        fit: 'inside',
        withoutEnlargement: true
      })
      .png()
      .toBuffer();

    const labelCrop = await cropLikelyProductLabel(normalized);
    const ocrSource = labelCrop.buffer;
    const noBarcodeSource = labelCrop.cropApplied
      ? await cropVerticalBand(ocrSource, 0, 0.78)
      : ocrSource;
    const metadata = await sharp(ocrSource).metadata();
    const shouldUpscale = (metadata.width ?? 0) < UPSCALE_TARGET_WIDTH_PX;
    const baseImage = sharp(ocrSource)
      .grayscale()
      .resize({
        width: UPSCALE_TARGET_WIDTH_PX,
        withoutEnlargement: false
      })
      .extend({ top: 16, bottom: 16, left: 16, right: 16, background: WHITE });
    const noBarcodeBaseImage = sharp(noBarcodeSource)
      .grayscale()
      .resize({
        width: UPSCALE_TARGET_WIDTH_PX,
        withoutEnlargement: false
      })
      .extend({ top: 16, bottom: 16, left: 16, right: 16, background: WHITE });

    const variants: PreprocessedVariant[] = [
      await createAdaptiveRegionVariant(
        noBarcodeSource,
        'Region_01_Header_Adaptive',
        0,
        0.30,
        1,
        labelCrop.cropApplied
      ),
      await createAdaptiveRegionVariant(
        noBarcodeSource,
        'Region_02_Analysis_Adaptive',
        0.31,
        0.52,
        2,
        labelCrop.cropApplied
      ),
      await createAdaptiveRegionVariant(
        noBarcodeSource,
        'Region_03_Legal_Adaptive',
        0.53,
        0.78,
        3,
        labelCrop.cropApplied
      ),
      {
        name: 'Gray_Soft_Contrast',
        buffer: await baseImage.clone()
          .normalise()
          .sharpen({ sigma: 1.0, m1: 0.3, m2: 1.4 })
          .png()
          .toBuffer(),
        profileHint: 'food_label_default',
        recommendedPsms: ['11', '6'],
        diagnostics: {
          hardThreshold: false,
          inverted: false,
          cropApplied: labelCrop.cropApplied,
          contrastStrategy: shouldUpscale ? 'normalise_upscaled_soft' : 'normalise_soft'
        }
      },
      {
        name: 'Label_No_Barcode_Adaptive_Text',
        buffer: await adaptiveWhiteTextOnDark(noBarcodeSource),
        profileHint: 'ingredient_block',
        recommendedPsms: ['6', '11'],
        diagnostics: {
          hardThreshold: true,
          inverted: true,
          cropApplied: labelCrop.cropApplied,
          contrastStrategy: 'local_adaptive_white_text_no_barcode'
        }
      },
      {
        name: 'Label_No_Barcode_Soft',
        buffer: await noBarcodeBaseImage.clone()
          .normalise()
          .sharpen({ sigma: 1.1, m1: 0.35, m2: 1.5 })
          .png()
          .toBuffer(),
        profileHint: 'food_label_default',
        recommendedPsms: ['11', '6'],
        diagnostics: {
          hardThreshold: false,
          inverted: false,
          cropApplied: labelCrop.cropApplied,
          contrastStrategy: 'label_without_barcode_soft'
        }
      },
      {
        name: 'Label_No_Barcode_White_Text',
        buffer: await noBarcodeBaseImage.clone()
          .normalise()
          .threshold(138)
          .negate({ alpha: false })
          .png()
          .toBuffer(),
        profileHint: 'ingredient_block',
        recommendedPsms: ['6', '11'],
        diagnostics: {
          hardThreshold: true,
          inverted: true,
          cropApplied: labelCrop.cropApplied,
          contrastStrategy: 'label_without_barcode_threshold_invert'
        }
      },
      {
        name: 'Dark_Label_Adaptive_Text',
        buffer: await adaptiveWhiteTextOnDark(ocrSource),
        profileHint: 'ingredient_block',
        recommendedPsms: ['6', '11'],
        diagnostics: {
          hardThreshold: true,
          inverted: true,
          cropApplied: labelCrop.cropApplied,
          contrastStrategy: 'local_adaptive_white_text_full_label'
        }
      },
      {
        name: 'Dark_Label_White_Text',
        buffer: await baseImage.clone()
          .normalise()
          .threshold(132)
          .negate({ alpha: false })
          .sharpen({ sigma: 1.0, m1: 0.4, m2: 1.6 })
          .png()
          .toBuffer(),
        profileHint: 'ingredient_block',
        recommendedPsms: ['6', '11'],
        diagnostics: {
          hardThreshold: true,
          inverted: true,
          cropApplied: labelCrop.cropApplied,
          contrastStrategy: 'dark_label_threshold_then_invert'
        }
      },
      {
        name: 'Standard_BW_Ingredient',
        buffer: await baseImage.clone()
          .sharpen({ sigma: 1.5, m1: 0.5, m2: 2.0 })
          .normalise()
          .threshold(150)
          .png()
          .toBuffer(),
        profileHint: 'ingredient_block',
        recommendedPsms: ['6', '13'],
        diagnostics: {
          hardThreshold: true,
          inverted: false,
          cropApplied: labelCrop.cropApplied,
          contrastStrategy: 'normalise_threshold_150'
        }
      },
      {
        name: 'Negated_BW_Inverse_Text',
        buffer: await baseImage.clone()
          .sharpen({ sigma: 1.5, m1: 0.5, m2: 2.0 })
          .normalise()
          .negate({ alpha: false })
          .threshold(140)
          .png()
          .toBuffer(),
        profileHint: 'food_label_default',
        recommendedPsms: ['11', '6'],
        diagnostics: {
          hardThreshold: true,
          inverted: true,
          cropApplied: labelCrop.cropApplied,
          contrastStrategy: 'invert_threshold_140'
        }
      },
      {
        name: 'HighContrast_Glare_Soft',
        buffer: await baseImage.clone()
          .sharpen({ sigma: 1.5, m1: 0.5, m2: 2.0 })
          .linear(1.35, -42)
          .median(1)
          .png()
          .toBuffer(),
        profileHint: 'food_label_default',
        recommendedPsms: ['11', '4'],
        diagnostics: {
          hardThreshold: false,
          inverted: false,
          cropApplied: labelCrop.cropApplied,
          contrastStrategy: 'linear_soft_median'
        }
      },
      {
        name: 'Morph_Close_Table',
        buffer: await baseImage.clone()
          .normalise()
          .threshold(165)
          .dilate(1)
          .erode(1)
          .png()
          .toBuffer(),
        profileHint: 'nutrition_table',
        recommendedPsms: ['4', '6'],
        diagnostics: {
          hardThreshold: true,
          inverted: false,
          cropApplied: labelCrop.cropApplied,
          contrastStrategy: 'threshold_light_close'
        }
      },
      {
        name: 'Code_Digit_High_Contrast',
        buffer: await baseImage.clone()
          .normalise()
          .threshold(170)
          .png()
          .toBuffer(),
        profileHint: 'code_digit',
        recommendedPsms: ['7', '8', '10'],
        diagnostics: {
          hardThreshold: true,
          inverted: false,
          cropApplied: labelCrop.cropApplied,
          contrastStrategy: 'strict_code_threshold'
        }
      }
    ];

    console.log(
      `[OCR Preprocessor] Pipeline complete. Generated ${variants.length} variants. ` +
      `OpenCV.js ${opencvAvailable ? 'available' : 'warming in background; using Sharp transforms for this request'}.`
    );

    return variants;
  }

  /**
   * Backwards-compatible method for other OCR adapters that only expect one buffer.
   * Returns a full-label candidate, not a region crop, so external OCR
   * providers receive the most readable complete label image.
   */
  public static async processForOcr(imageBuffer: Buffer): Promise<Buffer> {
    const variants = await this.processForOcrVariants(imageBuffer);
    const preferred =
      variants.find((variant) => variant.name === 'Label_No_Barcode_Soft') ??
      variants.find((variant) => !variant.regionGroup && variant.name === 'Gray_Soft_Contrast') ??
      variants.find((variant) => !variant.regionGroup) ??
      variants[0];

    return preferred.buffer;
  }
}
