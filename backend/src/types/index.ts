/**
 * @fileoverview Central type definitions for the TFM Easy-to-Read backend.
 *
 * Contains all shared interfaces, types, and custom error classes used
 * across the API layer, services, and controllers.
 *
 * IEEE 29148 trace: SRS §4.1 (API contract), §4.3 (OCR pipeline),
 * §4.4 (FACILE integration), §4.5 (ingredient parsing).
 */

// ---------------------------------------------------------------------------
// API Envelope
// ---------------------------------------------------------------------------

/**
 * Standard API response envelope used by every endpoint.
 * Enforces consistent structure for mobile client consumption.
 *
 * @template T - The shape of the `data` payload.
 */
export interface ApiEnvelope<T = unknown> {
  status: 'success' | 'error' | 'partial';
  data: T | null;
  code: string;
  message?: string;
}

// ---------------------------------------------------------------------------
// Request / Response
// ---------------------------------------------------------------------------

/**
 * Incoming payload for the `/analyze` endpoint.
 * IEEE 29148 trace: FR-SCAN-001
 */
export interface AnalyzeRequest {
  /** Unique user identifier (UUID v4). */
  userId: string;
  /** Client operating system. */
  deviceOS: 'iOS' | 'Android';
  /** Base64-encoded image of the food label. */
  imagePayload: string;
  /** ISO 8601 UTC timestamp of capture. */
  timestamp: string;
}

/**
 * Successful response payload from the `/analyze` endpoint.
 * IEEE 29148 trace: FR-SCAN-001, FR-FAC-001
 */
export interface AnalyzeResponseData {
  /** Unique scan identifier (UUID v4). */
  scanId: string;
  /** Product class detected from OCR text. */
  productType?: 'food' | 'water' | 'supplement' | 'unknown' | string;
  /** Raw text extracted by OCR. */
  originalText: string;
  /** Text adapted to Easy-to-Read format by FACILE. */
  adaptedText: string;
  /** Detected allergen names. */
  allergens: AllergenResult[];
  /** Structured mineral composition values extracted from water labels. */
  minerals?: MineralResult[];
  /** Structured additive/E-number values extracted from raw OCR text. */
  additives?: AdditiveResult[];
  /** Parsed graphical elements (percentages, quantities). */
  graphicalElements: GraphicalElement[];
  /** Mappings from complex terms to simplified equivalents. */
  complexTermMappings: ComplexTermMapping[];
  /** Total pipeline processing time in milliseconds. */
  processingMs: number;
  /** Whether the response used a degraded fallback path. */
  degraded?: boolean;
}

/**
 * A numeric graphical element extracted from ingredient text.
 * IEEE 29148 trace: FR-PARSE-002
 */
export interface GraphicalElement {
  /** Kind of measurement. */
  type: 'percentage' | 'quantity';
  /** Ingredient name this measurement belongs to. */
  ingredient: string;
  /** Numeric value of the measurement. */
  value: number;
  /** Unit of measurement. */
  unit: '%' | 'g/100g' | 'mg/100g' | 'g' | 'mg' | 'kg' | 'ml' | 'l';
}

export interface MineralResult {
  label: string;
  value: number;
  unit: 'mg/l' | 'pH' | string;
}

export interface AdditiveResult {
  code: string;
  name: string;
  category: string;
  safe: boolean;
  warning?: string;
}

export interface AllergenResult {
  name: string;
  severity: 'high' | 'medium' | 'low';
}

/**
 * A mapping between a complex term and its simplified counterpart.
 * IEEE 29148 trace: FR-FAC-001
 */
export interface ComplexTermMapping {
  /** Original complex term. */
  original: string;
  /** Simplified replacement. */
  simplified: string;
  /** Semantic category (e.g., "additive", "chemical"). */
  category: string;
}

// ---------------------------------------------------------------------------
// OCR
// ---------------------------------------------------------------------------

/**
 * Result returned by an OCR provider after text extraction.
 * IEEE 29148 trace: FR-OCR-001
 */
export interface OcrResult {
  /** Full raw text extracted from the image. */
  rawText: string;
  /** Confidence score from 0.0 to 1.0. */
  confidence: number;
  /** Individual text lines detected. */
  lines: string[];
}

/**
 * Contract that every OCR provider (GCP Vision, mock, etc.) must implement.
 * IEEE 29148 trace: NFR-EXT-001 (provider swappability)
 */
export interface IOcrProvider {
  /**
   * Extract text from a raw image buffer.
   * @param imageBuffer - The image file contents.
   * @returns Extracted OCR result.
   */
  extractText(imageBuffer: Buffer): Promise<OcrResult>;
}

// ---------------------------------------------------------------------------
// FACILE NLP Service
// ---------------------------------------------------------------------------

/**
 * A guideline violation identified by FACILE's identify endpoint.
 * IEEE 29148 trace: FR-FAC-001
 */
export interface FacileViolation {
  /** FACILE guideline identifier (e.g., "G1", "G2"). */
  idGuideline: string;
  /** Violation category. */
  category: string;
  /** The violating text fragment. */
  subtext: string;
  /** Start character index in the original text. */
  startIndex: number;
  /** End character index in the original text. */
  endIndex: number;
}

/**
 * A suggestion returned by FACILE's suggest endpoint.
 * IEEE 29148 trace: FR-FAC-001
 */
export interface FacileSuggestion {
  /** FACILE guideline identifier. */
  idGuideline: string;
  /** The text fragment to be transformed. */
  subtext: string;
  /** Start character index in the original text. */
  startIndex: number;
  /** End character index in the original text. */
  endIndex: number;
  /** Possible transformation alternatives. */
  possibleTransformations: string[];
}

/**
 * A concrete replacement to apply to the original text.
 * IEEE 29148 trace: FR-FAC-001
 */
export interface FacileReplacement {
  /** Start character index of the original fragment. */
  startIndex: number;
  /** End character index of the original fragment. */
  endIndex: number;
  /** Original text fragment. */
  original: string;
  /** Replacement text. */
  replacement: string;
  /** Guideline that triggered this replacement. */
  guideline: string;
}

/**
 * Aggregated result of the full FACILE adaptation pipeline.
 * IEEE 29148 trace: FR-FAC-001
 */
export interface FacileResult {
  /** The fully adapted Easy-to-Read text. */
  adaptedText: string;
  /** Complex-to-simple term mappings produced during adaptation. */
  complexTermMappings: ComplexTermMapping[];
  /** All violations found by the identify step. */
  violations: FacileViolation[];
  /** Overall adaptation status. */
  status: 'full' | 'partial' | 'failed';
  /** Guideline IDs that could not be resolved (partial/failed). */
  failedGuidelines?: string[];
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

/**
 * A single parsed ingredient with optional quantity information.
 * IEEE 29148 trace: FR-PARSE-001
 */
export interface ParsedIngredient {
  /** Normalized ingredient name. */
  ingredient: string;
  /** Numeric value, or null if not present. */
  value: number | null;
  /** Unit string, or null if not present. */
  unit: string | null;
  /** Original raw text before normalization. */
  raw: string;
}

/**
 * Entry in the EU food additive dictionary (E-numbers).
 * IEEE 29148 trace: FR-ADD-001
 */
export interface AdditiveEntry {
  /** EU E-number code (e.g., "E621"). */
  eNumber: string;
  /** Common name of the additive. */
  name: string;
  /** Additive category (e.g., "preservative", "colorant"). */
  category: string;
  /** Functional description. */
  function: string;
}

// ---------------------------------------------------------------------------
// Controller State Machine
// ---------------------------------------------------------------------------

/**
 * Finite states of the `/analyze` pipeline controller.
 * Tracks progress through the scan processing stages.
 * IEEE 29148 trace: FR-SCAN-001
 */
export type AnalyzeState =
  | 'RECEIVED'
  | 'VALIDATED'
  | 'OCR_EXEC'
  | 'OCR_DONE'
  | 'ADAPT_EXEC'
  | 'ADAPTED'
  | 'PARSED'
  | 'DONE';

// ---------------------------------------------------------------------------
// Custom Errors
// ---------------------------------------------------------------------------

/**
 * Base application error with HTTP status code and machine-readable error code.
 * All domain-specific errors extend this class.
 */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly errorCode: string
  ) {
    super(message);
    this.name = 'AppError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when the OCR service is unavailable after exhausting retries.
 * HTTP 503 — Service Unavailable.
 */
export class OcrUnavailableError extends AppError {
  constructor(message: string = 'OCR service unavailable after retries') {
    super(message, 503, 'OCR_UNAVAILABLE');
    this.name = 'OcrUnavailableError';
  }
}

/**
 * Thrown when the submitted image payload is invalid or exceeds size limits.
 * HTTP 400 — Bad Request.
 */
export class InvalidImageError extends AppError {
  constructor(message: string = 'Invalid or oversized image payload') {
    super(message, 400, 'INVALID_IMAGE');
    this.name = 'InvalidImageError';
  }
}

/**
 * Thrown when JWT authentication fails (missing, malformed, or expired token).
 * HTTP 401 — Unauthorized.
 */
export class UnauthorizedError extends AppError {
  constructor(message: string = 'Invalid or expired JWT') {
    super(message, 401, 'UNAUTHORIZED');
    this.name = 'UnauthorizedError';
  }
}
