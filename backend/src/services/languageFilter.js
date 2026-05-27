const KEEP_LANGS = new Set(['spa', 'cat', 'glg', 'eus', 'und']);
const MIN_LENGTH = 20;

let francLoader;

async function loadFranc() {
  if (!francLoader) {
    francLoader = import('franc');
  }
  return francLoader;
}

function splitSentences(rawText) {
  const sentences = String(rawText || '')
    .split(/(?<![A-Z][a-z])\.\s+(?=[A-ZÁÉÍÓÚ])|[!\n]+/)
    .map(s => s.trim())
    .filter(s => s.length > 8)
    .filter(s => !/^\d+[\w\/]*$/.test(s))
    .filter(s => !/^[A-ZÁÉÍÓÚa-z]{1,3}\.$/.test(s));

  return sentences;
}

function stripDetectionNoise(sentence) {
  return sentence.replace(/[\d.,;:()\[\]+\-\/°%"']/g, ' ').replace(/\s+/g, ' ').trim();
}

// EU Regulation 1169/2011: labels must be in official language(s) of sale country.
// Spain official: Spanish (spa) + Catalan (cat) + Galician (glg) + Basque (eus)
// ADR-009: see _workspace/DECISIONS.md

/**
 * Keeps only Spanish and Spanish co-official regional-language sentences.
 *
 * @param {string} text Relevance-filtered OCR text.
 * @returns {Promise<string>} Text containing only kept language sentences.
 */
async function filterToSpanish(text) {
  const { franc } = await loadFranc();
  const kept = [];
  const rawText = String(text || '').trim();

  if (rawText.length > 0 && rawText.length < MIN_LENGTH) {
    return rawText;
  }

  for (const sentence of splitSentences(rawText)) {
    if (sentence.length < MIN_LENGTH) {
      kept.push(sentence);
      continue;
    }

    const textOnly = stripDetectionNoise(sentence);
    if (textOnly.length < MIN_LENGTH) {
      kept.push(sentence);
      continue;
    }

    const lang = franc(textOnly, { minLength: 10 });
    if (KEEP_LANGS.has(lang)) {
      kept.push(sentence);
    }
  }

  return kept.join('. ');
}

module.exports = {
  KEEP_LANGS,
  MIN_LENGTH,
  filterToSpanish
};
