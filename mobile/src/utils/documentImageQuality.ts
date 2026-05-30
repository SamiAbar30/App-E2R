import { toByteArray } from 'base64-js';
import jpeg from 'jpeg-js';
import type {
  DocumentFrameSize,
  DocumentPoint,
  DocumentQuad,
  DocumentQualityHistoryEntry,
  DocumentQualityInput,
  DocumentQualityMetrics,
  DocumentQualityResult,
  DocumentQualityState,
} from '../types/documentScanner';

type DecodedJpeg = {
  width: number;
  height: number;
  data: Uint8Array;
};

const DEFAULT_METRICS: DocumentQualityMetrics = {
  focus: 0,
  brightness: 0,
  contrast: 0,
  edgeDensity: 0,
  saturatedRatio: 0,
  foregroundFillRatio: 0,
  megapixels: 0,
  shortSide: 0,
};

const STATE_MESSAGES: Record<DocumentQualityState, { message: string; hint: string }> = {
  GOOD: {
    message: 'Document ready',
    hint: 'The scan is clear enough to analyze.',
  },
  BAD_BLUR: {
    message: 'Too blurry, hold still',
    hint: 'Place the document on a flat surface and keep the phone steady.',
  },
  BAD_LIGHT: {
    message: 'Too dark, move to better light',
    hint: 'Avoid shadows and glare before scanning again.',
  },
  LOW_CONTRAST: {
    message: 'Low contrast',
    hint: 'Use a brighter background or better light.',
  },
  TOO_SMALL: {
    message: 'Move closer',
    hint: 'The document should fill more of the frame.',
  },
  BAD_PERSPECTIVE: {
    message: 'Align document in frame',
    hint: 'Hold the phone parallel to the document.',
  },
  UNSTABLE: {
    message: 'Hold steady',
    hint: 'Wait until the outline stops moving.',
  },
  UNKNOWN: {
    message: 'Scan quality unknown',
    hint: 'Try scanning again if the text looks unclear.',
  },
};

function stripBase64Header(value: string): string {
  return value.includes(',') ? value.split(',').pop() ?? '' : value;
}

function distance(a: DocumentPoint, b: DocumentPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function polygonArea(points: DocumentPoint[]): number {
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    area += current.x * next.y - next.x * current.y;
  }
  return Math.abs(area) / 2;
}

function angleAt(previous: DocumentPoint, current: DocumentPoint, next: DocumentPoint): number {
  const vectorA = { x: previous.x - current.x, y: previous.y - current.y };
  const vectorB = { x: next.x - current.x, y: next.y - current.y };
  const dot = vectorA.x * vectorB.x + vectorA.y * vectorB.y;
  const magA = Math.hypot(vectorA.x, vectorA.y);
  const magB = Math.hypot(vectorB.x, vectorB.y);
  if (magA === 0 || magB === 0) return 180;
  const cosine = Math.max(-1, Math.min(1, dot / (magA * magB)));
  return Math.acos(cosine) * (180 / Math.PI);
}

function computeQuadMetrics(
  quad?: DocumentQuad,
  frameSize?: DocumentFrameSize,
  history: DocumentQualityHistoryEntry[] = []
): Pick<DocumentQualityMetrics, 'fillRatio' | 'maxPerspectiveError' | 'stabilityDelta'> {
  if (!quad) return {};

  const points = [quad.topLeft, quad.topRight, quad.bottomRight, quad.bottomLeft];
  const top = distance(quad.topLeft, quad.topRight);
  const bottom = distance(quad.bottomLeft, quad.bottomRight);
  const left = distance(quad.topLeft, quad.bottomLeft);
  const right = distance(quad.topRight, quad.bottomRight);
  const horizontal = (top + bottom) / 2;
  const vertical = (left + right) / 2;
  const aspectRatio = vertical === 0 ? 0 : horizontal / vertical;

  const angles = [
    angleAt(quad.bottomLeft, quad.topLeft, quad.topRight),
    angleAt(quad.topLeft, quad.topRight, quad.bottomRight),
    angleAt(quad.topRight, quad.bottomRight, quad.bottomLeft),
    angleAt(quad.bottomRight, quad.bottomLeft, quad.topLeft),
  ];

  const maxAngleError = Math.max(...angles.map((angle) => Math.abs(90 - angle)));
  const aspectError = aspectRatio < 0.45 || aspectRatio > 2.4 ? 35 : 0;
  const maxPerspectiveError = Math.max(maxAngleError, aspectError);
  const fillRatio = frameSize
    ? polygonArea(points) / Math.max(1, frameSize.width * frameSize.height)
    : undefined;

  const recentHistory = history.slice(-4);
  const stabilityDelta =
    recentHistory.length === 0
      ? undefined
      : Math.max(
          ...recentHistory.map((entry) => {
            const previousArea = polygonArea([
              entry.quad.topLeft,
              entry.quad.topRight,
              entry.quad.bottomRight,
              entry.quad.bottomLeft,
            ]);
            const currentArea = polygonArea(points);
            const areaDelta = Math.abs(currentArea - previousArea) / Math.max(1, currentArea);
            const centerDelta = distance(
              {
                x: (entry.quad.topLeft.x + entry.quad.bottomRight.x) / 2,
                y: (entry.quad.topLeft.y + entry.quad.bottomRight.y) / 2,
              },
              {
                x: (quad.topLeft.x + quad.bottomRight.x) / 2,
                y: (quad.topLeft.y + quad.bottomRight.y) / 2,
              }
            );
            const frameDiagonal = frameSize ? Math.hypot(frameSize.width, frameSize.height) : 1;
            return areaDelta + centerDelta / frameDiagonal;
          })
        );

  return { fillRatio, maxPerspectiveError, stabilityDelta };
}

function decodeJpegBase64(base64: string): DecodedJpeg | null {
  try {
    const bytes = toByteArray(stripBase64Header(base64));
    return jpeg.decode(bytes, {
      useTArray: true,
      tolerantDecoding: true,
      maxMemoryUsageInMB: 96,
    }) as DecodedJpeg;
  } catch {
    return null;
  }
}

function luminanceAt(data: Uint8Array, offset: number): number {
  return 0.2126 * data[offset] + 0.7152 * data[offset + 1] + 0.0722 * data[offset + 2];
}

function computeImageMetrics(base64?: string, fallbackWidth = 0, fallbackHeight = 0): DocumentQualityMetrics {
  if (!base64) {
    return {
      ...DEFAULT_METRICS,
      megapixels: (fallbackWidth * fallbackHeight) / 1_000_000,
      shortSide: Math.min(fallbackWidth, fallbackHeight),
    };
  }

  const decoded = decodeJpegBase64(base64);
  if (!decoded) return DEFAULT_METRICS;

  const { width, height, data } = decoded;
  const targetSamples = 90_000;
  const sampleStep = Math.max(2, Math.floor(Math.sqrt((width * height) / targetSamples)));
  const luminances: number[] = [];
  const borderColors: Array<[number, number, number]> = [];
  let edgeEnergy = 0;
  let edgeSamples = 0;
  let edgePixels = 0;
  let saturatedPixels = 0;
  let foregroundPixels = 0;
  let sampledPixels = 0;

  for (let y = 0; y < height; y += sampleStep) {
    for (let x = 0; x < width; x += sampleStep) {
      const isBorder =
        x < width * 0.08 ||
        x > width * 0.92 ||
        y < height * 0.08 ||
        y > height * 0.92;
      if (!isBorder) continue;
      const offset = (y * width + x) * 4;
      borderColors.push([data[offset], data[offset + 1], data[offset + 2]]);
    }
  }

  const borderMean = borderColors.length
    ? borderColors.reduce(
        (sum, color) => [sum[0] + color[0], sum[1] + color[1], sum[2] + color[2]],
        [0, 0, 0]
      ).map((value) => value / borderColors.length)
    : [128, 128, 128];

  for (let y = sampleStep; y < height - sampleStep; y += sampleStep) {
    for (let x = sampleStep; x < width - sampleStep; x += sampleStep) {
      const offset = (y * width + x) * 4;
      const r = data[offset];
      const g = data[offset + 1];
      const b = data[offset + 2];
      const lum = luminanceAt(data, offset);
      luminances.push(lum);
      sampledPixels += 1;

      const backgroundDistance = Math.hypot(
        r - borderMean[0],
        g - borderMean[1],
        b - borderMean[2]
      );
      if (backgroundDistance > 52) foregroundPixels += 1;
      if (lum > 238 && Math.max(r, g, b) - Math.min(r, g, b) < 42) saturatedPixels += 1;

      const left = luminanceAt(data, (y * width + (x - sampleStep)) * 4);
      const right = luminanceAt(data, (y * width + (x + sampleStep)) * 4);
      const up = luminanceAt(data, ((y - sampleStep) * width + x) * 4);
      const down = luminanceAt(data, ((y + sampleStep) * width + x) * 4);
      const laplacian = Math.abs(4 * lum - left - right - up - down);
      edgeEnergy += laplacian * laplacian;
      edgeSamples += 1;
      if (laplacian > 22) edgePixels += 1;
    }
  }

  if (luminances.length === 0) {
    return {
      ...DEFAULT_METRICS,
      megapixels: (width * height) / 1_000_000,
      shortSide: Math.min(width, height),
    };
  }

  const mean = luminances.reduce((sum, value) => sum + value, 0) / luminances.length;
  const variance =
    luminances.reduce((sum, value) => sum + (value - mean) ** 2, 0) / luminances.length;

  return {
    focus: edgeSamples === 0 ? 0 : edgeEnergy / edgeSamples / 255,
    brightness: mean / 255,
    contrast: Math.sqrt(variance) / 255,
    edgeDensity: edgeSamples === 0 ? 0 : edgePixels / edgeSamples,
    saturatedRatio: sampledPixels === 0 ? 0 : saturatedPixels / sampledPixels,
    foregroundFillRatio: sampledPixels === 0 ? 0 : foregroundPixels / sampledPixels,
    megapixels: (width * height) / 1_000_000,
    shortSide: Math.min(width, height),
  };
}

function chooseState(metrics: DocumentQualityMetrics): DocumentQualityState {
  if (metrics.shortSide > 0 && (metrics.shortSide < 640 || metrics.megapixels < 0.45)) {
    return 'TOO_SMALL';
  }
  if (
    metrics.foregroundFillRatio > 0 &&
    metrics.foregroundFillRatio < 0.42 &&
    metrics.edgeDensity < 0.08
  ) {
    return 'TOO_SMALL';
  }
  if (metrics.saturatedRatio > 0.14 && metrics.edgeDensity < 0.1) return 'BAD_LIGHT';
  if (metrics.brightness > 0 && metrics.brightness < 0.18) return 'BAD_LIGHT';
  if (metrics.contrast > 0 && metrics.contrast < 0.045) return 'LOW_CONTRAST';
  if (metrics.edgeDensity > 0 && metrics.edgeDensity < 0.018) return 'BAD_BLUR';
  if (metrics.focus > 0 && metrics.focus < 8.5) return 'BAD_BLUR';
  if (metrics.fillRatio !== undefined && metrics.fillRatio < 0.32) return 'TOO_SMALL';
  if (metrics.maxPerspectiveError !== undefined && metrics.maxPerspectiveError > 24) {
    return 'BAD_PERSPECTIVE';
  }
  if (metrics.stabilityDelta !== undefined && metrics.stabilityDelta > 0.08) return 'UNSTABLE';
  return 'GOOD';
}

function scoreMetrics(metrics: DocumentQualityMetrics, state: DocumentQualityState): number {
  if (state !== 'GOOD') {
    return Math.max(0, Math.min(74, Math.round(metrics.focus + metrics.contrast * 120)));
  }

  const focusScore = Math.min(35, metrics.focus * 2.8);
  const brightnessScore = Math.max(0, 25 - Math.abs(metrics.brightness - 0.55) * 70);
  const contrastScore = Math.min(25, metrics.contrast * 180);
  const sizeScore = Math.min(15, metrics.megapixels * 10);
  return Math.round(Math.max(80, Math.min(100, focusScore + brightnessScore + contrastScore + sizeScore)));
}

export function createImageDataUri(base64: string): string {
  return `data:image/jpeg;base64,${stripBase64Header(base64)}`;
}

export function evaluateDocumentQuality(input: DocumentQualityInput): DocumentQualityResult {
  const imageMetrics = computeImageMetrics(input.base64, input.width, input.height);
  const quadMetrics = computeQuadMetrics(input.quad, input.frameSize, input.history);
  const metrics = { ...imageMetrics, ...quadMetrics };
  const state = chooseState(metrics);
  const copy = STATE_MESSAGES[state];
  const reasons = state === 'GOOD' ? [] : [state];

  return {
    state,
    score: scoreMetrics(metrics, state),
    shouldAccept: state === 'GOOD',
    message: copy.message,
    hint: copy.hint,
    metrics,
    reasons,
  };
}
