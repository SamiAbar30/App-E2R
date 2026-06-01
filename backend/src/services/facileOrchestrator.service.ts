import {
  FacileViolation,
  FacileSuggestion,
  FacileReplacement,
  FacileResult,
  ComplexTermMapping
} from '../types';
import { env } from '../config/env';

const IDENTIFY_TIMEOUT_MS = Number(process.env.FACILE_IDENTIFY_TIMEOUT_MS || 10000);
const SUGGEST_TIMEOUT_MS = Number(process.env.FACILE_SUGGEST_TIMEOUT_MS || 15000);

type FacileRawViolation = Partial<FacileViolation> & {
  guideline?: string;
  problematicClause?: string;
  explanation?: string;
  type?: string;
};

type FacileRawSuggestion = Partial<FacileSuggestion> & {
  guideline?: string;
  problematicClause?: string;
  guidelines?: Array<{ guideline?: string }>;
  suggestions?: FacileRawSuggestion[];
};

export class FacileTimeoutError extends Error {
  constructor(message: string = 'FACILE request timed out') {
    super(message);
    this.name = 'FacileTimeoutError';
  }
}

export class FacileParallelOrchestrator {
  private readonly facileHost = env.FACILE_HOST.replace(/\/+$/, '');
  private readonly identifyUrl = `${this.facileHost}/${env.FACILE_IDENTIFY_PORT}/facileRest/identification`;
  private readonly suggestUrl = `${this.facileHost}/${env.FACILE_SUGGEST_PORT}/facileRest/suggestion`;
  private readonly authHeader: string;

  private readonly targetGuidelines = [
    'guideline22Vocab', 'guideline19Vocab', 'guideline12Vocab', 'guideline13Vocab',
    'guideline10Vocab', 'guideline11Vocab', 'guideline6Orth', 'guideline8Orth',
    'guideline1Orac', 'guideline13Orac'
  ];

  constructor() {
    this.authHeader = `Basic ${Buffer.from(`${env.FACILE_USER}:${env.FACILE_PASS}`).toString('base64')}`;
  }

  private buildPayload(text: string, guidelines: unknown[]) {
    return {
      originalText: text,
      formatInformation: [],
      guidelines
    };
  }

  private normalizeViolation(raw: FacileRawViolation): FacileViolation {
    const idGuideline = raw.idGuideline || raw.guideline || '';
    const subtext = raw.subtext || raw.problematicClause || '';

    return {
      ...raw,
      idGuideline,
      subtext,
      startIndex: Number(raw.startIndex ?? 0),
      endIndex: Number(raw.endIndex ?? raw.startIndex ?? 0),
      category: raw.category || idGuideline
    };
  }

  private normalizeIdentifyResponse(data: unknown): FacileViolation[] {
    const rawViolations = Array.isArray(data)
      ? data
      : Array.isArray((data as { guidelines?: unknown[] })?.guidelines)
        ? (data as { guidelines: unknown[] }).guidelines
        : [];

    return rawViolations.map(raw => this.normalizeViolation(raw as FacileRawViolation));
  }

  private normalizeSuggestResponse(data: unknown): FacileSuggestion[] {
    const rawSuggestions = Array.isArray(data)
      ? data
      : Array.isArray((data as { suggestions?: unknown[] })?.suggestions)
        ? (data as { suggestions: unknown[] }).suggestions
        : [];

    return rawSuggestions.map((raw) => {
      const suggestion = raw as FacileRawSuggestion;
      const idGuideline = suggestion.idGuideline || suggestion.guideline || suggestion.guidelines?.[0]?.guideline || '';

      return {
        ...suggestion,
        idGuideline,
        subtext: suggestion.subtext || suggestion.problematicClause || '',
        startIndex: Number(suggestion.startIndex ?? 0),
        endIndex: Number(suggestion.endIndex ?? suggestion.startIndex ?? 0),
        possibleTransformations: suggestion.possibleTransformations || []
      };
    });
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

        // Skip no-op "not-adapted" suggestions where FACILE returns identical text
        if (original.trim() === replacementText.trim()) {
          console.log(`[FACILE SKIP] Guideline ${suggestion.idGuideline}: no real transformation (not-adapted)`);
          continue;
        }

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

  private async identify(text: string, retries = 3): Promise<FacileViolation[]> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), IDENTIFY_TIMEOUT_MS);
      const payload = this.buildPayload(text, this.targetGuidelines);

      console.log(`[FACILE API] Outgoing IDENTIFY request (Attempt ${attempt}) to: ${this.identifyUrl}`);
      if (attempt === 1) {
        console.log(`[FACILE API] IDENTIFY Payload:\n`, JSON.stringify(payload, null, 2));
      }

      try {
        const response = await fetch(this.identifyUrl, {
          method: 'POST',
          headers: {
            'Authorization': this.authHeader,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        });

        console.log(`[FACILE API] IDENTIFY Response Status: ${response.status}`);

        if (!response.ok) {
          throw new Error(`FACILE identify failed: ${response.status}`);
        }

        const data = await response.json();
        console.log(`[FACILE API] IDENTIFY Response Data:\n`, JSON.stringify(data, null, 2));
        return this.normalizeIdentifyResponse(data);
      } catch (error) {
        console.error(`[FACILE API] IDENTIFY request failed on attempt ${attempt}:`, error);
        if (attempt === retries) {
          if ((error as Error).name === 'AbortError') {
            throw new FacileTimeoutError('FACILE identify timed out');
          }
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      } finally {
        clearTimeout(timeoutId);
      }
    }
    throw new Error('Unreachable');
  }

  private async suggest(
    text: string,
    violations: FacileViolation[],
    retries = 3
  ): Promise<PromiseSettledResult<FacileSuggestion[]>[]> {
    const promises = violations.map(async (violation) => {
      for (let attempt = 1; attempt <= retries; attempt++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), SUGGEST_TIMEOUT_MS);
        const payload = this.buildPayload(text, [violation]);

        console.log(`[FACILE API] Outgoing SUGGEST request (Attempt ${attempt}) to: ${this.suggestUrl} for violation: ${violation.idGuideline}`);
        if (attempt === 1) {
          console.log(`[FACILE API] SUGGEST Payload:\n`, JSON.stringify(payload, null, 2));
        }

        try {
          const response = await fetch(this.suggestUrl, {
            method: 'POST',
            headers: {
              'Authorization': this.authHeader,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload),
            signal: controller.signal
          });

          console.log(`[FACILE API] SUGGEST Response Status: ${response.status} for violation: ${violation.idGuideline}`);

          if (!response.ok) {
            throw new Error(`FACILE suggest failed: ${response.status}`);
          }

          const data = await response.json();
          console.log(`[FACILE API] SUGGEST Response Data for violation ${violation.idGuideline}:\n`, JSON.stringify(data, null, 2));
          return this.normalizeSuggestResponse(data);
        } catch (error) {
          console.error(`[FACILE API] SUGGEST request failed for violation ${violation.idGuideline} on attempt ${attempt}:`, error);
          if (attempt === retries) {
            if ((error as Error).name === 'AbortError') {
              throw new FacileTimeoutError(`FACILE suggest timed out for ${violation.idGuideline}`);
            }
            const err = new Error(`Suggest failed for ${violation.idGuideline}: ${(error as Error).message}`);
            (err as { guideline?: string }).guideline = violation.idGuideline;
            throw err;
          }
          await new Promise(resolve => setTimeout(resolve, 1000));
        } finally {
          clearTimeout(timeoutId);
        }
      }
      throw new Error('Unreachable');
    });

    return Promise.allSettled(promises);
  }
}
