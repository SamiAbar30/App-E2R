import {
  FacileViolation,
  FacileSuggestion,
  FacileReplacement,
  FacileResult,
  ComplexTermMapping
} from '../types';
import { env } from '../config/env';

const IDENTIFY_TIMEOUT_MS = 800;
const SUGGEST_TIMEOUT_MS = 800;

export class FacileTimeoutError extends Error {
  constructor(message: string = 'FACILE request timed out') {
    super(message);
    this.name = 'FacileTimeoutError';
  }
}

export class FacileParallelOrchestrator {
  private readonly identifyUrl = `${env.FACILE_HOST}:${env.FACILE_IDENTIFY_PORT}/facileRest/identification`;
  private readonly suggestUrl = `${env.FACILE_HOST}:${env.FACILE_SUGGEST_PORT}/facileRest/suggestion`;
  private readonly authHeader: string;

  private readonly targetGuidelines = [
    'guideline22Vocab', 'guideline19Vocab', 'guideline12Vocab', 'guideline13Vocab',
    'guideline10Vocab', 'guideline11Vocab', 'guideline6Orth', 'guideline8Orth',
    'guideline1Orac', 'guideline13Orac'
  ];

  constructor() {
    this.authHeader = `Basic ${Buffer.from(`${env.FACILE_USER}:${env.FACILE_PASS}`).toString('base64')}`;
  }

  async adapt(rawText: string): Promise<FacileResult> {
    const violations = await this.identify(rawText);
    if (violations.length === 0) {
      return {
        adaptedText: rawText,
        complexTermMappings: [],
        violations: [],
        status: 'full'
      };
    }

    const suggestions = await this.suggest(rawText, violations);
    const hasTimeout = suggestions.some(
      s => s.status === 'rejected' && (s as PromiseRejectedResult).reason instanceof FacileTimeoutError
    );
    if (hasTimeout) {
      throw new FacileTimeoutError('FACILE suggestion timed out');
    }

    const failedGuidelines = suggestions
      .filter(s => s.status === 'rejected')
      .map(s => (s as PromiseRejectedResult).reason?.guideline || 'unknown');

    const successfulSuggestions = suggestions
      .filter(s => s.status === 'fulfilled')
      .map(s => (s as PromiseFulfilledResult<FacileSuggestion[]>).value)
      .flat();

    const replacements: FacileReplacement[] = [];
    const complexTermMappings: ComplexTermMapping[] = [];

    for (const suggestion of successfulSuggestions) {
      if (suggestion.possibleTransformations && suggestion.possibleTransformations.length > 0) {
        const original = rawText.substring(suggestion.startIndex, suggestion.endIndex);
        const replacementText = suggestion.possibleTransformations[0];

        replacements.push({
          startIndex: suggestion.startIndex,
          endIndex: suggestion.endIndex,
          original,
          replacement: replacementText,
          guideline: suggestion.idGuideline
        });

        complexTermMappings.push({
          original,
          simplified: replacementText,
          category: 'FACILE Adaptation'
        });
      }
    }

    replacements.sort((a, b) => b.startIndex - a.startIndex);
    let adaptedText = rawText;
    for (const r of replacements) {
      adaptedText =
        adaptedText.slice(0, r.startIndex) +
        r.replacement +
        adaptedText.slice(r.endIndex);
    }

    return {
      adaptedText,
      complexTermMappings,
      violations,
      status: failedGuidelines.length > 0 ? 'partial' : 'full',
      failedGuidelines: failedGuidelines.length > 0 ? failedGuidelines : undefined
    };
  }

  private async identify(text: string): Promise<FacileViolation[]> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), IDENTIFY_TIMEOUT_MS);

    try {
      const response = await fetch(this.identifyUrl, {
        method: 'POST',
        headers: {
          'Authorization': this.authHeader,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text,
          idGuidelines: this.targetGuidelines
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`FACILE identify failed: ${response.status}`);
      }

      const data = await response.json() as FacileViolation[];
      return Array.isArray(data) ? data : [];
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        throw new FacileTimeoutError('FACILE identify timed out');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async suggest(
    text: string,
    violations: FacileViolation[]
  ): Promise<PromiseSettledResult<FacileSuggestion[]>[]> {
    const promises = violations.map(async (violation) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), SUGGEST_TIMEOUT_MS);

      try {
        const response = await fetch(this.suggestUrl, {
          method: 'POST',
          headers: {
            'Authorization': this.authHeader,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            text,
            violations: [violation]
          }),
          signal: controller.signal
        });

        if (!response.ok) {
          throw new Error(`FACILE suggest failed: ${response.status}`);
        }

        const data = await response.json() as FacileSuggestion[];
        return Array.isArray(data) ? data : [];
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          throw new FacileTimeoutError(`FACILE suggest timed out for ${violation.idGuideline}`);
        }
        const err = new Error(`Suggest failed for ${violation.idGuideline}: ${(error as Error).message}`);
        (err as { guideline?: string }).guideline = violation.idGuideline;
        throw err;
      } finally {
        clearTimeout(timeoutId);
      }
    });

    return Promise.allSettled(promises);
  }
}
