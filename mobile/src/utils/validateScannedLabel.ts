/**
 * Post-scan validation facade.
 *
 * Wraps the lower-level `evaluateDocumentQuality()` engine and returns
 * a richer, per-check breakdown via `ImageValidationResult`.
 *
 * Usage:
 *   const result = validateScannedLabel({ base64: imageBase64 });
 *   if (!result.isAccepted) {
 *     showBanner(result.primaryMessage, result.primaryHint);
 *   }
 */

import { evaluateDocumentQuality } from './documentImageQuality';
import type { DocumentQualityInput, DocumentQualityMetrics } from '../types/documentScanner';
import type {
  ImageValidationResult,
  ImageValidationCheckResult,
  ImageQualityScores,
} from '../types/imageValidation';

// ─── Helpers: normalise raw metric → 0‒100 score ───────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Focus: raw `focus` ranges roughly 0‒40+; map linearly. */
function focusToScore(focus: number): number {
  return clamp(Math.round((focus / 30) * 100), 0, 100);
}

/**
 * Brightness: 0.5 is ideal. Penalise equally for too-dark and too-bright.
 * 0 → 0, 0.5 → 100, 1.0 → 0.
 */
function brightnessToScore(brightness: number): number {
  const deviation = Math.abs(brightness - 0.5);
  return clamp(Math.round((1 - deviation * 2) * 100), 0, 100);
}

/** Contrast: raw value 0‒0.5+; map 0.045 threshold region to ~50. */
function contrastToScore(contrast: number): number {
  return clamp(Math.round((contrast / 0.18) * 100), 0, 100);
}

/** Glare: 0 ratio → 100 (no glare), 0.12+ ratio → 0 (heavy glare). */
function glareToScore(glareRatio: number): number {
  return clamp(Math.round((1 - glareRatio / 0.15) * 100), 0, 100);
}

/** Coverage: based on foregroundFillRatio + edgeVoidRatio. */
function coverageToScore(foregroundFill: number, edgeVoidRatio: number): number {
  const fillScore = clamp(Math.round(foregroundFill * 120), 0, 100);
  const voidPenalty = edgeVoidRatio > 0.5 ? 40 : Math.round(edgeVoidRatio * 50);
  return clamp(fillScore - voidPenalty, 0, 100);
}

// ─── Per-check builders ─────────────────────────────────────────────

function buildBlurCheck(m: DocumentQualityMetrics): ImageValidationCheckResult {
  const score = focusToScore(m.focus);
  const passed = m.focus >= 8.5 && m.edgeDensity >= 0.018;
  return {
    check: 'BLUR',
    passed,
    score,
    message: passed ? 'Imagen nitida' : 'Imagen borrosa',
    hint: passed ? undefined : 'Sujeta el movil con firmeza y vuelve a escanear.',
  };
}

function buildBrightnessCheck(m: DocumentQualityMetrics): ImageValidationCheckResult {
  const score = brightnessToScore(m.brightness);
  const tooDark = m.brightness > 0 && m.brightness < 0.18;
  const tooOverexposed = m.overexposed;
  const passed = !tooDark && !tooOverexposed;
  let message = 'Buena luz';
  let hint: string | undefined;
  if (tooDark) {
    message = 'Falta luz';
    hint = 'Evita sombras y asegúrate de que la etiqueta tenga luz.';
  } else if (tooOverexposed) {
    message = 'Demasiada luz';
    hint = 'Aleja el producto de la luz directa o inclinalo un poco.';
  }
  return { check: tooOverexposed ? 'OVEREXPOSED' : 'DARK', passed, score, message, hint };
}

function buildContrastCheck(m: DocumentQualityMetrics): ImageValidationCheckResult {
  const score = contrastToScore(m.contrast);
  const passed = m.contrast >= 0.045;
  return {
    check: 'LOW_CONTRAST',
    passed,
    score,
    message: passed ? 'Buen contraste' : 'Poco contraste',
    hint: passed ? undefined : 'Busca mejor luz para que el texto destaque.',
  };
}

function buildGlareCheck(m: DocumentQualityMetrics): ImageValidationCheckResult {
  const score = glareToScore(m.glareRatio);
  const passed = m.glareRatio <= 0.12;
  return {
    check: 'GLARE',
    passed,
    score,
    message: passed ? 'Sin reflejos' : 'Hay reflejos',
    hint: passed ? undefined : 'Inclina el producto para quitar el brillo.',
  };
}

function buildCoverageCheck(m: DocumentQualityMetrics): ImageValidationCheckResult {
  const score = coverageToScore(m.foregroundFillRatio, m.edgeVoidRatio);
  const occluded = m.edgeVoidRatio > 0.5;
  const passed = !occluded;
  return {
    check: 'OCCLUDED',
    passed,
    score,
    message: passed ? 'Etiqueta visible' : 'Texto tapado',
    hint: passed ? undefined : 'Asegura que nada cubra el texto.',
  };
}

function buildFramingCheck(m: DocumentQualityMetrics): ImageValidationCheckResult {
  const tooSmall =
    (m.shortSide > 0 && (m.shortSide < 640 || m.megapixels < 0.45)) ||
    (m.foregroundFillRatio > 0 && m.foregroundFillRatio < 0.42 && m.edgeDensity < 0.08) ||
    (m.fillRatio !== undefined && m.fillRatio < 0.32);

  const badPerspective =
    m.maxPerspectiveError !== undefined && m.maxPerspectiveError > 24;

  const passed = !tooSmall && !badPerspective;
  const score = passed ? 95 : tooSmall ? 30 : 50;

  let message = 'Buen encuadre';
  let hint: string | undefined;
  if (tooSmall) {
    message = 'Acerca la camara';
    hint = 'La etiqueta completa debe verse y ocupar mas espacio.';
  } else if (badPerspective) {
    message = 'Alinea la etiqueta';
    hint = 'Mantén el movil paralelo a la etiqueta.';
  }

  return {
    check: tooSmall ? 'TOO_SMALL' : 'BAD_FRAMING',
    passed,
    score,
    message,
    hint,
  };
}

// ─── Composite scores ───────────────────────────────────────────────

function computeScores(m: DocumentQualityMetrics): ImageQualityScores {
  const sharpness = focusToScore(m.focus);
  const brightness = brightnessToScore(m.brightness);
  const contrast = contrastToScore(m.contrast);
  const glare = glareToScore(m.glareRatio);
  const coverage = coverageToScore(m.foregroundFillRatio, m.edgeVoidRatio);

  // Weighted composite: sharpness and glare matter most for OCR
  const overall = clamp(
    Math.round(
      sharpness * 0.30 +
      brightness * 0.20 +
      contrast * 0.15 +
      glare * 0.20 +
      coverage * 0.15
    ),
    0,
    100
  );

  return { sharpness, brightness, contrast, glare, coverage, overall };
}

// ─── Main entry point ───────────────────────────────────────────────

/**
 * Run the full validation pipeline on a scanned / cropped label image.
 *
 * Calls the existing `evaluateDocumentQuality()` engine internally and
 * maps its result into a richer per-check breakdown.
 */
export function validateScannedLabel(input: DocumentQualityInput): ImageValidationResult {
  const docResult = evaluateDocumentQuality(input);
  const m = docResult.metrics;

  const checks: ImageValidationCheckResult[] = [
    buildBlurCheck(m),
    buildBrightnessCheck(m),
    buildContrastCheck(m),
    buildGlareCheck(m),
    buildCoverageCheck(m),
    buildFramingCheck(m),
  ];

  const failedReasons = checks.filter((c) => !c.passed).map((c) => c.check);
  const scores = computeScores(m);
  const primaryPriority = ['DARK', 'OVEREXPOSED', 'TOO_SMALL', 'BAD_FRAMING', 'GLARE', 'OCCLUDED', 'LOW_CONTRAST', 'BLUR'];
  const failedChecks = checks.filter((c) => !c.passed);
  const primaryFail = failedChecks.sort(
    (a, b) => primaryPriority.indexOf(a.check) - primaryPriority.indexOf(b.check)
  )[0];

  return {
    isAccepted: failedReasons.length === 0,
    overallScore: scores.overall,
    checks,
    scores,
    failedReasons,
    primaryMessage: primaryFail?.message ?? docResult.message,
    primaryHint: primaryFail?.hint ?? docResult.hint,
  };
}
