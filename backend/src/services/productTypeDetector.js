const SIGNALS = {
  water: [/agua\s+mineral/i, /mineralización/i, /manantial/i, /composici[oó]n\s+anal[ií]tica/i],
  food: [/ingredientes?\s*:/i, /contiene\s*:/i, /harina|azúcar|aceite|sal\b/i],
  supplement: [/complemento\s+alimenticio/i, /valor\s+energético/i]
};

/**
 * Detects the product family from raw OCR text using local regex signals.
 *
 * @param {string} rawText Raw OCR output.
 * @returns {'water' | 'food' | 'supplement' | 'unknown'} Detected product type.
 */
function detectProductType(rawText) {
  const text = String(rawText || '');

  for (const [type, patterns] of Object.entries(SIGNALS)) {
    if (patterns.some((pattern) => pattern.test(text))) {
      return type;
    }
  }

  return 'unknown';
}

module.exports = { detectProductType };
