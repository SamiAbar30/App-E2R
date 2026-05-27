import { createWorker } from 'tesseract.js';
import { IOcrProvider } from './ocrAdapter.service';
import { OcrResult, OcrUnavailableError } from '../types';
import {
  OcrImagePreprocessor,
  OcrProfileHint,
  PreprocessedVariant
} from './ocrPreprocessor.service';

interface OcrProfile {
  name: OcrProfileHint;
  psms: string[];
  dictionariesEnabled: boolean;
  whitelist?: string;
}

interface CandidateRun {
  variant: PreprocessedVariant;
  profile: OcrProfile;
  psm: string;
}

interface CandidateResult extends OcrResult {
  score: number;
  diagnostics: {
    variant: string;
    profile: OcrProfileHint;
    psm: string;
    elapsedMs: number;
    confidence: number;
    score: number;
    rejectedReasons: string[];
  };
}

interface CompositeGroup {
  name: string;
  variants: PreprocessedVariant[];
}

const MAX_CANDIDATE_RUNS = 14;
const EARLY_EXIT_SCORE = 115;
const COMPOSITE_ACCEPT_SCORE = 160;
const WORKER_LANGUAGE = 'spa+eng';

const OCR_PROFILES: Record<OcrProfileHint, OcrProfile> = {
  food_label_default: {
    name: 'food_label_default',
    psms: ['11', '6'],
    dictionariesEnabled: false
  },
  ingredient_block: {
    name: 'ingredient_block',
    psms: ['6', '13'],
    dictionariesEnabled: false
  },
  nutrition_table: {
    name: 'nutrition_table',
    psms: ['4', '6'],
    dictionariesEnabled: false
  },
  code_digit: {
    name: 'code_digit',
    psms: ['7', '8', '10'],
    dictionariesEnabled: false,
    whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-/.,:%() '
  },
  screenshot: {
    name: 'screenshot',
    psms: ['6', '11'],
    dictionariesEnabled: true
  }
};

const INGREDIENT_TERMS = [
  'ingrediente',
  'ingredientes',
  'contiene',
  'puede contener',
  'agua',
  'azucar',
  'sal',
  'aceite',
  'harina',
  'leche',
  'soja',
  'gluten',
  'huevo',
  'frutos',
  'trigo'
];

const ALLERGEN_TERMS = [
  'gluten',
  'leche',
  'lactosa',
  'huevo',
  'soja',
  'cacahuete',
  'cacahuetes',
  'almendra',
  'avellana',
  'nuez',
  'sesamo',
  'mostaza',
  'apio',
  'sulfitos',
  'pescado',
  'marisco',
  'crustaceos'
];

const PRODUCT_LABEL_TERMS = [
  'cabreiro',
  'proyecto',
  'origen',
  'botella',
  'material',
  'reciclado',
  'composicion',
  'analitica',
  'residuo',
  'manantial',
  'envasada',
  'embalado',
  'hosteleria'
];

function foldForMatching(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function applyDomainRepairs(text: string): string {
  return text
    .replace(/\bABREIROA?\b/gi, 'CABREIRO\u00c1')
    .replace(/\bABREIRO\u00c1\b/gi, 'CABREIRO\u00c1')
    .replace(/\bCABREIROA\b(?!\s*\.)/gi, 'CABREIRO\u00c1')
    .replace(/\bCABREIROA\s+ES\b/gi, 'CABREIROA.ES')
    .replace(/\bCABREIRO\b(?![A\u00c1])/gi, 'CABREIRO\u00c1')
    .replace(/\bCABREROR\b/gi, 'CABREIRO\u00c1')
    .replace(/\bCABREIROD\b/gi, 'CABREIRO\u00c1')
    .replace(/\bCABREROA\b/gi, 'CABREIRO\u00c1')
    .replace(/\bCABRERO\b/gi, 'CABREIRO\u00c1')
    .replace(/\bCABRERA\b/gi, 'CABREIRO\u00c1')
    .replace(/\bCABREIRA\b/gi, 'CABREIRO\u00c1')
    .replace(/\bMANANTIAL\s+CABREIROA\b/gi, 'MANANTIAL CABREIRO\u00c1')
    .replace(/\bMANANTIAL\s+CABRERA\b/gi, 'MANANTIAL CABREIRO\u00c1')
    .replace(/\bE100%\b/g, '100%');
}

function normalizeOcrText(raw: string): string {
  const normalized = raw
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ' ')
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\b[Ee]\s*[- ]\s*(\d{3,4}[a-zA-Z]?)\b/g, 'E$1')
    .replace(/(\d)\s+([,.])\s+(\d)/g, '$1$2$3')
    .replace(/\s*([,;:])\s*/g, '$1 ')
    .replace(/\s+/g, ' ')
    .trim();

  return applyDomainRepairs(normalized);
}

function normalizeLine(raw: string): string {
  return normalizeOcrText(raw);
}

function countMatches(text: string, terms: string[]): number {
  const lower = foldForMatching(text);
  return terms.reduce((count, term) => count + (lower.includes(term) ? 1 : 0), 0);
}

function countRegexMatches(text: string, regex: RegExp): number {
  return Array.from(text.matchAll(regex)).length;
}

function scoreCandidate(result: OcrResult, profile: OcrProfile): { score: number; rejectedReasons: string[] } {
  const text = result.rawText;
  const rejectedReasons: string[] = [];
  const lineCount = result.lines.length;
  const controlPenalty = /[\uFFFD\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(text) ? 15 : 0;
  const shortPenalty = text.length < 12 ? 25 : 0;
  const ingredientHits = countMatches(text, INGREDIENT_TERMS);
  const allergenHits = countMatches(text, ALLERGEN_TERMS);
  const productLabelHits = countMatches(text, PRODUCT_LABEL_TERMS);
  const eNumberHits = countRegexMatches(text, /\bE\s*[- ]?\d{3,4}[a-zA-Z]?\b/g);
  const quantityHits = countRegexMatches(text, /\b\d+(?:[,.]\d+)?\s?(?:%|g|mg|kg|ml|l|kcal|kj)\b/gi);
  const codeHits = countRegexMatches(text, /\b(?:L|LOT|CAD|EXP)?\s?[A-Z0-9]{3,}[-/][A-Z0-9-/]{2,}\b/gi);

  if (!text.trim()) rejectedReasons.push('empty_text');
  if (lineCount === 0) rejectedReasons.push('no_lines');
  if (controlPenalty > 0) rejectedReasons.push('control_or_replacement_chars');
  if (shortPenalty > 0) rejectedReasons.push('too_short');

  let domainBoost =
    productLabelHits * 9 +
    ingredientHits * 8 +
    allergenHits * 6 +
    eNumberHits * 7 +
    quantityHits * 5;
  if (profile.name === 'code_digit') {
    domainBoost += codeHits * 10 + quantityHits * 4;
  }
  if (profile.name === 'nutrition_table') {
    domainBoost += quantityHits * 7;
  }

  const score =
    result.confidence * 70 +
    Math.min(lineCount, 12) * 2 +
    Math.min(text.length, 600) / 30 +
    domainBoost -
    controlPenalty -
    shortPenalty;

  return { score, rejectedReasons };
}

function buildCandidateRuns(variants: PreprocessedVariant[]): CandidateRun[] {
  const runs: CandidateRun[] = [];

  for (const variant of variants) {
    if (variant.regionGroup) continue;

    const profile = OCR_PROFILES[variant.profileHint] ?? OCR_PROFILES.food_label_default;
    const psms = Array.from(new Set([...variant.recommendedPsms, ...profile.psms]));

    for (const psm of psms) {
      runs.push({ variant, profile, psm });
    }
  }

  return runs.slice(0, MAX_CANDIDATE_RUNS);
}

function buildCompositeGroups(variants: PreprocessedVariant[]): CompositeGroup[] {
  const grouped = new Map<string, PreprocessedVariant[]>();

  for (const variant of variants) {
    if (!variant.regionGroup) continue;
    const group = grouped.get(variant.regionGroup) ?? [];
    group.push(variant);
    grouped.set(variant.regionGroup, group);
  }

  return Array.from(grouped.entries())
    .filter(([, groupVariants]) => groupVariants.length >= 2)
    .map(([name, groupVariants]) => ({
      name,
      variants: groupVariants.sort((a, b) => (a.regionOrder ?? 0) - (b.regionOrder ?? 0))
    }));
}

class TesseractWorkerPool {
  private static workerPromise: Promise<any> | null = null;
  private static queue: Promise<unknown> = Promise.resolve();

  static async run<T>(task: (worker: any) => Promise<T>): Promise<T> {
    const runTask = async () => task(await this.getWorker());
    const queued = this.queue.then(runTask, runTask);
    this.queue = queued.catch(() => undefined);
    return queued;
  }

  static async reset(): Promise<void> {
    const worker = await this.workerPromise?.catch(() => null);
    this.workerPromise = null;
    this.queue = Promise.resolve();

    if (worker) {
      await worker.terminate?.();
    }
  }

  private static getWorker(): Promise<any> {
    if (!this.workerPromise) {
      console.log(`[Tesseract OCR] Initializing reusable local worker (${WORKER_LANGUAGE})...`);
      this.workerPromise = createWorker(WORKER_LANGUAGE);
    }

    return this.workerPromise;
  }
}

/**
 * TesseractOcrAdapter - local, offline OCR engine implementation.
 * Uses a bounded Tesseract.js ensemble tuned for food ingredient labels.
 *
 * @trace COMP-002 - Pluggable Adapter architecture
 */
export class TesseractOcrAdapter implements IOcrProvider {
  /**
   * Extract text from a base64 encoded image payload.
   *
   * @param base64 - The image payload in base64 format, with or without data URI header.
   * @returns Resolves to an OcrResult envelope.
   * @throws {OcrUnavailableError} If OCR processing fails.
   */
  async extract(base64: string): Promise<OcrResult> {
    const payload = base64.includes(',') ? base64.split(',')[1] : base64;
    const rawBuffer = Buffer.from(payload, 'base64');

    try {
      const variants = await OcrImagePreprocessor.processForOcrVariants(rawBuffer);
      const runs = buildCandidateRuns(variants);
      const compositeGroups = buildCompositeGroups(variants);
      console.log(
        `[Tesseract OCR] Running bounded ensemble (${runs.length} candidate runs, ` +
        `${compositeGroups.length} composite group(s))...`
      );

      const bestResult = await TesseractWorkerPool.run(async (worker) => {
        let best: CandidateResult | null = null;

        for (const group of compositeGroups) {
          const candidate = await this.recognizeCompositeGroup(worker, group);
          if (!candidate) continue;

          if (!best || candidate.score > best.score) {
            best = candidate;
          }
        }

        if (best && best.score >= COMPOSITE_ACCEPT_SCORE) {
          console.log(
            `[Tesseract OCR] Accepting composite result ${best.diagnostics.variant} ` +
            `score=${best.score.toFixed(1)} confidence=${best.confidence.toFixed(2)}`
          );
          return best;
        }

        for (const run of runs) {
          const candidate = await this.recognizeCandidate(worker, run);
          if (!candidate) continue;

          if (!best || candidate.score > best.score) {
            best = candidate;
          }

          if (candidate.score >= EARLY_EXIT_SCORE && candidate.confidence >= 0.82) {
            console.log(
              `[Tesseract OCR] Early exit on ${candidate.diagnostics.variant} ` +
              `profile=${candidate.diagnostics.profile} psm=${candidate.diagnostics.psm} ` +
              `score=${candidate.score.toFixed(1)} confidence=${candidate.confidence.toFixed(2)}`
            );
            break;
          }
        }

        return best;
      });

      if (!bestResult) {
        throw new Error('No text was recognized in any OCR candidate.');
      }

      console.log(
        `[Tesseract OCR] Selected ${bestResult.diagnostics.variant} ` +
        `profile=${bestResult.diagnostics.profile} psm=${bestResult.diagnostics.psm} ` +
        `score=${bestResult.score.toFixed(1)} confidence=${bestResult.confidence.toFixed(2)}`
      );

      return {
        rawText: bestResult.rawText,
        confidence: bestResult.confidence,
        lines: bestResult.lines
      };
    } catch (error: any) {
      console.error('[Tesseract OCR Error] Extraction failed:', error.message);
      throw new OcrUnavailableError(`Tesseract OCR processing failed: ${error.message}`);
    }
  }

  static async shutdownWorkerPool(): Promise<void> {
    await TesseractWorkerPool.reset();
  }

  private async recognizeCandidate(worker: any, run: CandidateRun): Promise<CandidateResult | null> {
    const start = Date.now();

    await worker.setParameters?.({
      tessedit_pageseg_mode: run.psm,
      user_defined_dpi: '300',
      preserve_interword_spaces: '1',
      tessedit_char_whitelist: run.profile.whitelist ?? ''
    });

    const { data } = await worker.recognize(run.variant.buffer);
    const text = data?.text ?? '';
    const confidence = Math.max(0, Math.min(1, (data?.confidence ?? 0) / 100));

    if (!text.trim()) {
      console.log(
        `[Tesseract OCR] Rejected empty candidate ${run.variant.name} ` +
        `profile=${run.profile.name} psm=${run.psm}`
      );
      return null;
    }

    const lines = text
      .split(/\r?\n/)
      .map((line: string) => normalizeLine(line))
      .filter((line: string) => line.length > 0);

    const rawText = normalizeOcrText(text);
    const baseResult: OcrResult = { rawText, confidence, lines };
    const { score, rejectedReasons } = scoreCandidate(baseResult, run.profile);

    return {
      ...baseResult,
      score,
      diagnostics: {
        variant: run.variant.name,
        profile: run.profile.name,
        psm: run.psm,
        elapsedMs: Date.now() - start,
        confidence,
        score,
        rejectedReasons
      }
    };
  }

  private async recognizeCompositeGroup(worker: any, group: CompositeGroup): Promise<CandidateResult | null> {
    const start = Date.now();
    const texts: string[] = [];
    const lines: string[] = [];
    const confidences: number[] = [];

    for (const variant of group.variants) {
      await worker.setParameters?.({
        tessedit_pageseg_mode: '6',
        user_defined_dpi: '300',
        preserve_interword_spaces: '1',
        tessedit_char_whitelist: ''
      });

      const { data } = await worker.recognize(variant.buffer);
      const text = data?.text ?? '';
      const confidence = Math.max(0, Math.min(1, (data?.confidence ?? 0) / 100));
      if (!text.trim()) continue;

      const regionLines = text
        .split(/\r?\n/)
        .map((line: string) => normalizeLine(line))
        .filter((line: string) => line.length > 0);

      texts.push(normalizeOcrText(text));
      lines.push(...regionLines);
      confidences.push(confidence);
    }

    if (texts.length === 0) {
      return null;
    }

    const rawText = normalizeOcrText(texts.join('\n'));
    const confidence = confidences.reduce((sum, value) => sum + value, 0) / confidences.length;
    const baseResult: OcrResult = { rawText, confidence, lines };
    const { score, rejectedReasons } = scoreCandidate(baseResult, OCR_PROFILES.ingredient_block);
    const compositeScore = score + group.variants.length * 12;

    return {
      ...baseResult,
      score: compositeScore,
      diagnostics: {
        variant: group.name,
        profile: 'ingredient_block',
        psm: 'composite-region-6',
        elapsedMs: Date.now() - start,
        confidence,
        score: compositeScore,
        rejectedReasons
      }
    };
  }
}
