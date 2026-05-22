/**
 * @fileoverview Typed environment configuration with fail-fast validation.
 *
 * Loads environment variables from `.env` via dotenv, validates that all
 * required variables are present, and exports a frozen, fully-typed
 * configuration object. The process exits immediately if any required
 * variable is missing, preventing silent misconfiguration in production.
 *
 * IEEE 29148 trace: NFR-SEC-001 (no credentials in source code),
 * NFR-CFG-001 (centralized configuration).
 */

import dotenv from 'dotenv';

dotenv.config();

/**
 * Fully-typed representation of all environment variables consumed
 * by the backend. Every field has an explicit type — no ambient `string | undefined`.
 */
interface EnvConfig {
  /** HTTP listen port. Default: 3000. */
  PORT: number;
  /** Runtime environment selector. Default: 'development'. */
  NODE_ENV: 'development' | 'production' | 'test';
  /** MongoDB connection URI (required). */
  MONGODB_URI: string;
  /** Secret key for JWT signing/verification (required). */
  JWT_SECRET: string;
  /** Google Cloud Vision API key. Empty string when using mock OCR. */
  GCP_VISION_KEY: string;
  /** Active OCR provider. Default: 'mock'. */
  OCR_PROVIDER: 'gcp' | 'mock' | 'tesseract';
  /** FACILE NLP service base host URL. */
  FACILE_HOST: string;
  /** FACILE HTTP basic-auth username. */
  FACILE_USER: string;
  /** FACILE HTTP basic-auth password. */
  FACILE_PASS: string;
  /** FACILE identify endpoint port. Default: 5008. */
  FACILE_IDENTIFY_PORT: number;
  /** FACILE suggest endpoint port. Default: 5010. */
  FACILE_SUGGEST_PORT: number;
  /** FACILE status endpoint port. Default: 5009. */
  FACILE_STATUS_PORT: number;
  /** Maximum allowed image payload size in bytes. Default: 2 097 152 (2 MB). */
  MAX_IMAGE_BYTES: number;
}

/**
 * Environment variables that MUST be set. The server will refuse to start
 * if any of these are missing or empty.
 */
const requiredVars = ['MONGODB_URI', 'JWT_SECRET'] as const;

/**
 * Loads and validates environment variables, returning a typed config object.
 *
 * @returns Frozen {@link EnvConfig} with all fields populated.
 * @throws {Error} If any variable listed in {@link requiredVars} is missing.
 */
function loadEnv(): EnvConfig {
  const missing = requiredVars.filter((v) => !process.env[v]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`
    );
  }

  return Object.freeze({
    PORT: parseInt(process.env.PORT || '3000', 10),
    NODE_ENV:
      (process.env.NODE_ENV as EnvConfig['NODE_ENV']) || 'development',
    MONGODB_URI: process.env.MONGODB_URI!,
    JWT_SECRET: process.env.JWT_SECRET!,
    GCP_VISION_KEY: process.env.GCP_VISION_KEY || '',
    OCR_PROVIDER:
      (process.env.OCR_PROVIDER as EnvConfig['OCR_PROVIDER']) || 'mock',
    FACILE_HOST:
      process.env.FACILE_HOST || 'https://facile-test.linkeddata.es',
    FACILE_USER: process.env.FACILE_USER || '',
    FACILE_PASS: process.env.FACILE_PASS || '',
    FACILE_IDENTIFY_PORT: parseInt(
      process.env.FACILE_IDENTIFY_PORT || '5008',
      10
    ),
    FACILE_SUGGEST_PORT: parseInt(
      process.env.FACILE_SUGGEST_PORT || '5010',
      10
    ),
    FACILE_STATUS_PORT: parseInt(
      process.env.FACILE_STATUS_PORT || '5009',
      10
    ),
    MAX_IMAGE_BYTES: parseInt(
      process.env.MAX_IMAGE_BYTES || '2097152',
      10
    ),
  });
}

/** Validated, frozen environment configuration singleton. */
export const env: EnvConfig = loadEnv();
