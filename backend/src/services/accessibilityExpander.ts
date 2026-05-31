/**
 * accessibilityExpander.ts
 * 
 * Provides utility functions to expand abbreviations and symbols into clear,
 * full-word text to aid cognitive accessibility.
 */

// A safe mapping of abbreviations to their full textual representation.
// We strictly avoid symbols that clash with common Spanish words (e.g. 'la', 'se', 'te').
const SAFE_CHEMICAL_MAP: Record<string, string> = {
  'cl': 'Cloruro',
  'ca': 'Calcio',
  'mg': 'Magnesio',
  'fe': 'Hierro',
  'zn': 'Zinc',
  'na': 'Sodio',
  'k':  'Potasio',
  'p':  'Fósforo',
  'cu': 'Cobre',
  'mn': 'Manganeso',
  'i':  'Yodo'
};

/**
 * Expands cognitive accessibility roadblocks in the text.
 * - Converts "%" to "por ciento".
 * - Expands safe chemical symbols (like "ca", "cl") into their full names.
 * 
 * @param text The clean OCR text before it is sent to FACILE.
 * @returns The cognitively expanded text.
 */
export function expandCognitiveAccessibility(text: string): string {
  if (!text) return text;

  let expanded = text;

  // 1. Expand % to "por ciento"
  // We match % optionally preceded by a space.
  expanded = expanded.replace(/\s*%\s*/g, ' por ciento ');

  // 2. Expand safe chemical abbreviations.
  // We use word boundaries \b to ensure we only match standalone symbols.
  // We also make it case-insensitive.
  for (const [symbol, fullName] of Object.entries(SAFE_CHEMICAL_MAP)) {
    const regex = new RegExp(`\\b${symbol}\\b`, 'gi');
    expanded = expanded.replace(regex, fullName);
  }

  // 3. Clean up any multiple spaces that might have been introduced
  expanded = expanded.replace(/\s{2,}/g, ' ').trim();

  // 4. Clean up spaces before punctuation (e.g. "por ciento ,")
  expanded = expanded.replace(/\s+([.,;:])/g, '$1');

  return expanded;
}
