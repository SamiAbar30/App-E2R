/**
 * accessibilityExpander.ts
 * 
 * Provides utility functions to expand abbreviations and symbols into clear,
 * full-word text to aid cognitive accessibility.
 */

// A safe mapping of abbreviations to their full textual representation.
// Units such as mg, ml, cl, g, kcal, and kJ are protected before this map runs.
const SAFE_CHEMICAL_MAP: Record<string, string> = {
  'ca': 'Calcio',
  'fe': 'Hierro',
  'zn': 'Zinc',
  'na': 'Sodio',
  'k':  'Potasio',
  'p':  'Fósforo',
  'cu': 'Cobre',
  'mn': 'Manganeso',
  'i':  'Yodo'
};

function decimalTextToNumber(value: string): number {
  return Number(value.replace(',', '.'));
}

function formatSpanishNumber(value: number): string {
  return Number.isInteger(value)
    ? String(value)
    : String(value).replace('.', ',');
}

function describePercentage(value: number): string {
  if (value === 50) return 'la mitad';
  if (value === 25) return 'una de cada cuatro partes';
  if (value === 75) return 'tres de cada cuatro partes';
  if (value === 20) return 'una de cada cinco partes';
  if (value === 10) return 'una de cada diez partes';
  if (value === 5) return 'cinco de cada 100 partes';

  return `${formatSpanishNumber(value)} de cada 100 partes`;
}

function protectMeasurementUnits(text: string): { text: string; restore: (expanded: string) => string } {
  const protectedValues: string[] = [];
  const protectedText = text.replace(
    /\b\d+(?:[,.]\d+)?\s*(?:mg|g|kg|ml|cl|l|kj|kcal)\b/gi,
    (match) => {
      const token = `__UNIT_${protectedValues.length}__`;
      protectedValues.push(match);
      return token;
    }
  );

  return {
    text: protectedText,
    restore: (expanded: string) => protectedValues.reduce(
      (current, original, index) => current.replace(`__UNIT_${index}__`, original),
      expanded
    )
  };
}

function expandUneGuideline22(text: string): string {
  return text
    .replace(/\b(?:el\s+)?25\s*%\s+de\s+la\s+poblaci[oó]n\b/gi, 'Una de cada cuatro personas')
    .replace(/\b(\d+(?:[,.]\d+)?)\s*%\s*VRN\*?/gi, (_match, rawValue: string) => {
      const value = decimalTextToNumber(rawValue);
      return `${describePercentage(value)} del valor de referencia de nutrientes`;
    })
    .replace(/\b(\d+(?:[,.]\d+)?)\s*%/g, (_match, rawValue: string) => {
      const value = decimalTextToNumber(rawValue);
      return describePercentage(value);
    })
    .replace(/½/g, 'la mitad')
    .replace(/¼/g, 'una de cada cuatro partes')
    .replace(/¾/g, 'tres de cada cuatro partes');
}

/**
 * Expands cognitive accessibility roadblocks in the text.
 * - Explains percentages using UNE 153101 EX guideline 22.
 * - Expands safe chemical symbols into their full names.
 * 
 * @param text The clean OCR text before it is sent to FACILE.
 * @returns The cognitively expanded text.
 */
export function expandCognitiveAccessibility(text: string): string {
  if (!text) return text;

  let expanded = text;

  // 1. Explain fractions and percentages instead of reading the symbol aloud.
  expanded = expandUneGuideline22(expanded);

  // 2. Protect units before expanding chemical symbols. Otherwise "120 mg"
  // becomes "120 Magnesio", which is wrong for nutrition tables.
  const unitProtection = protectMeasurementUnits(expanded);
  expanded = unitProtection.text;

  // 3. Expand safe chemical abbreviations.
  // We use word boundaries \b to ensure we only match standalone symbols.
  // We also make it case-insensitive.
  for (const [symbol, fullName] of Object.entries(SAFE_CHEMICAL_MAP)) {
    const regex = new RegExp(`\\b${symbol}\\b`, 'gi');
    expanded = expanded.replace(regex, fullName);
  }
  expanded = unitProtection.restore(expanded);

  // 4. Clean up any multiple spaces that might have been introduced
  expanded = expanded.replace(/\s{2,}/g, ' ').trim();

  // 5. Clean up spaces before punctuation.
  expanded = expanded.replace(/\s+([.,;:])/g, '$1');

  return expanded;
}
