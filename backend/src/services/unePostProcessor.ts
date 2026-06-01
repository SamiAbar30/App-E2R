/**
 * unePostProcessor.ts
 *
 * Local post-processor that applies UNE 153101:2018 EX Easy-to-Read rules
 * that FACILE systematically returns as "not-adapted".
 *
 * Each function maps to a specific UNE guideline section.
 * Runs AFTER FACILE on the adapted text to fill gaps.
 */

import { ComplexTermMapping } from '../types';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface UnePostProcessResult {
  text: string;
  mappings: ComplexTermMapping[];
}

// ═══════════════════════════════════════════════════════════════════════════
// UNE §6.2.11 — Expand abbreviations (unit abbreviations)
// "Abbreviations shall be avoided."
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Map of measurement unit abbreviations to their full Spanish words.
 * Only matched when preceded by a digit (e.g., "1,0 g" → "1,0 gramos").
 */
const UNIT_EXPANSIONS: Record<string, string> = {
  'g':    'gramos',
  'mg':   'miligramos',
  'kg':   'kilogramos',
  'ml':   'mililitros',
  'cl':   'centilitros',
  'l':    'litros',
  'kcal': 'kilocalorías',
  'kj':   'kilojulios',
  'kJ':   'kilojulios',
};

/**
 * Common abbreviations found on food labels (non-unit).
 */
const ABBREVIATION_EXPANSIONS: Record<string, string> = {
  'aprox.':  'aproximadamente',
  'Aprox.':  'Aproximadamente',
  'mín.':    'mínimo',
  'Mín.':    'Mínimo',
  'máx.':    'máximo',
  'Máx.':    'Máximo',
  'min.':    'minutos',
  'Ref.':    'Referencia',
  'ref.':    'referencia',
  'Temp.':   'Temperatura',
  'temp.':   'temperatura',
  'Conserv.':'Conservación',
  'Ing.':    'Ingredientes',
  'Nº':      'Número',
  'nº':      'número',
  'N.º':     'Número',
  'n.º':     'número',
};

/**
 * Expand measurement unit abbreviations that follow a number.
 * Examples: "1,0 g" → "1,0 gramos", "383 kcal" → "383 kilocalorías"
 *
 * Uses negative lookahead to avoid expanding inside E-numbers (E-300)
 * and negative lookbehind to require a preceding digit.
 */
function expandUnitAbbreviations(text: string): UnePostProcessResult {
  const mappings: ComplexTermMapping[] = [];
  let result = text;

  // Sort by length descending so "kcal" is matched before "l"
  const sortedUnits = Object.entries(UNIT_EXPANSIONS)
    .sort(([a], [b]) => b.length - a.length);

  for (const [abbr, full] of sortedUnits) {
    // Match: digit(s) + optional decimal + optional space + unit abbreviation
    // Negative lookahead: not followed by a letter (avoid "gramos" → "gramosramos")
    // Case-insensitive for the unit itself
    const pattern = new RegExp(
      `(\\d+(?:[,.]\\d+)?)\\s*(${abbr})(?![a-záéíóúñ])`,
      abbr === abbr.toLowerCase() ? 'gi' : 'g'
    );

    result = result.replace(pattern, (match, num, unit) => {
      const replacement = `${num} ${full}`;
      if (match.trim() !== replacement.trim()) {
        mappings.push({
          original: unit,
          simplified: full,
          category: 'UNE §6.2.11 Abbreviation'
        });
      }
      return replacement;
    });
  }

  return { text: result, mappings };
}

/**
 * Expand common non-unit abbreviations.
 * UNE §6.2.11: "Abbreviations shall be avoided."
 */
function expandCommonAbbreviations(text: string): UnePostProcessResult {
  const mappings: ComplexTermMapping[] = [];
  let result = text;

  for (const [abbr, full] of Object.entries(ABBREVIATION_EXPANSIONS)) {
    if (result.includes(abbr)) {
      result = result.split(abbr).join(full);
      mappings.push({
        original: abbr,
        simplified: full,
        category: 'UNE §6.2.11 Abbreviation'
      });
    }
  }

  return { text: result, mappings };
}

// ═══════════════════════════════════════════════════════════════════════════
// UNE §6.1.7 — Replace semicolons
// "Semicolons (;) shall not be used."
// ═══════════════════════════════════════════════════════════════════════════

function replaceSemicolons(text: string): UnePostProcessResult {
  const mappings: ComplexTermMapping[] = [];

  if (text.includes(';')) {
    mappings.push({
      original: ';',
      simplified: '.',
      category: 'UNE §6.1.7 Semicolons'
    });
  }

  // Replace semicolons with periods and capitalize the next letter
  const result = text.replace(/;\s*/g, (match) => {
    return '. ';
  }).replace(/\.\s+([a-záéíóúñ])/g, (_match, letter: string) => {
    return `. ${letter.toUpperCase()}`;
  });

  return { text: result, mappings };
}

// ═══════════════════════════════════════════════════════════════════════════
// UNE §6.1.1 — Avoid ALL CAPS
// "Shall not write words or phrases with all their letters in capital
//  letters, except when they are acronyms."
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Known acronyms that should stay uppercase.
 */
const KNOWN_ACRONYMS = new Set([
  'VRN', 'UNE', 'UE', 'EU', 'ONU', 'RENFE', 'IVA', 'NIF', 'CIF',
  'ADN', 'ARN', 'OMS', 'FAO', 'ISO', 'AECOSAN', 'EFSA', 'FDA',
  'pH', 'UV', 'IR',
]);

/**
 * Convert ALL CAPS words (3+ letters) to title case, preserving acronyms.
 * Single words of 1-2 uppercase letters are left alone (likely abbreviations).
 */
function lowercaseAllCaps(text: string): UnePostProcessResult {
  const mappings: ComplexTermMapping[] = [];

  const result = text.replace(/\b([A-ZÁÉÍÓÚÑ]{3,})\b/g, (match) => {
    // Preserve known acronyms
    if (KNOWN_ACRONYMS.has(match)) return match;

    // Preserve E-numbers like E472e
    if (/^E-?\d/.test(match)) return match;

    // Convert to title case: INGREDIENTES → Ingredientes
    const titleCase = match.charAt(0) + match.slice(1).toLowerCase();
    mappings.push({
      original: match,
      simplified: titleCase,
      category: 'UNE §6.1.1 Capitalization'
    });
    return titleCase;
  });

  return { text: result, mappings };
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN EXPORT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Applies all local UNE 153101 post-processing rules to adapted text.
 *
 * @param text - The text after FACILE adaptation (or expanded text if FACILE skipped).
 * @returns Post-processed text with additional UNE rule compliance + mappings.
 */
export function applyUnePostProcessing(text: string): UnePostProcessResult {
  if (!text) return { text, mappings: [] };

  const allMappings: ComplexTermMapping[] = [];

  // 1. Expand unit abbreviations (must run before other text changes)
  let result = text;
  const unitResult = expandUnitAbbreviations(result);
  result = unitResult.text;
  allMappings.push(...unitResult.mappings);

  // 2. Expand common abbreviations
  const abbrResult = expandCommonAbbreviations(result);
  result = abbrResult.text;
  allMappings.push(...abbrResult.mappings);

  // 3. Replace semicolons with periods
  const semiResult = replaceSemicolons(result);
  result = semiResult.text;
  allMappings.push(...semiResult.mappings);

  // 4. Lowercase ALL CAPS words (run last to avoid interfering with unit patterns)
  const capsResult = lowercaseAllCaps(result);
  result = capsResult.text;
  allMappings.push(...capsResult.mappings);

  // 5. Clean up any double spaces introduced
  result = result.replace(/\s{2,}/g, ' ').trim();

  // Deduplicate mappings by original+simplified key
  const seen = new Set<string>();
  const uniqueMappings = allMappings.filter(m => {
    const key = `${m.original}→${m.simplified}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return { text: result, mappings: uniqueMappings };
}
