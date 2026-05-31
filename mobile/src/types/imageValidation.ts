/**
 * Modular image-validation result types.
 *
 * These provide a per-check breakdown on top of the lower-level
 * DocumentQualityResult from the existing engine, giving the UI
 * richer feedback about exactly *what* is wrong with a scanned image.
 */

/** Individual reason codes for image rejection. */
export type ImageValidationReason =
  | 'BLUR'
  | 'DARK'
  | 'OVEREXPOSED'
  | 'LOW_CONTRAST'
  | 'GLARE'
  | 'OCCLUDED'
  | 'TOO_SMALL'
  | 'BAD_FRAMING';

/** Normalised 0–100 scores per quality dimension. */
export type ImageQualityScores = {
  /** Higher = sharper. */
  sharpness: number;
  /** 0 = pitch-black, 100 = perfect brightness. */
  brightness: number;
  /** Higher = more contrast between text and background. */
  contrast: number;
  /** Higher = less glare (100 = no glare detected). */
  glare: number;
  /** How much of the label area is visible / not occluded. */
  coverage: number;
  /** Weighted composite of all dimensions. */
  overall: number;
};

/** Result of a single validation check. */
export type ImageValidationCheckResult = {
  check: ImageValidationReason;
  passed: boolean;
  /** 0–100 score for this specific dimension. */
  score: number;
  /** User-facing message (e.g. "Image is too blurry"). */
  message: string;
  /** User-facing recovery hint (e.g. "Hold the phone steady"). */
  hint?: string;
};

/** Aggregate result of the full validation pipeline. */
export type ImageValidationResult = {
  /** True when all checks pass. */
  isAccepted: boolean;
  /** 0–100 composite quality score. */
  overallScore: number;
  /** Per-check breakdown. */
  checks: ImageValidationCheckResult[];
  /** Normalised scores per dimension. */
  scores: ImageQualityScores;
  /** Reason codes for every failing check. */
  failedReasons: ImageValidationReason[];
  /** The most important user-facing message to display. */
  primaryMessage: string;
  /** Recovery hint for the primary failure. */
  primaryHint: string;
};
