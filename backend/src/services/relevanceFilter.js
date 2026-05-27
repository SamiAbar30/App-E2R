const DROP_PATTERNS = [
  /https?:\/\/\S+/i,
  /\S+\.(es|com|pt|eu|org)\/?\S*/i,
  /\+\d{2}[\s\d]{8,}/,
  /\d{3}\s?\d{3}\s?\d{3}/,
  /^\d{8,}$/,
  /^(?:\d\s*){8,}$/,
  /nº\s+r[a-z]+[\s\d.\/]+/i,
  /rgseaa/i,
  /lab\.\s+dr\./i,
  /certified|corporation|calidade|certificad/i,
  /proyecto\s+origen/i,
  /más\s+info\s+en/i,
  /exclusivo\s+hostelería/i,
  /importado\s+por/i,
  /envasada\s+por|embalado\s+por/i,
  /consumir\s+preferentemente|consumir\s+de\s+prefer/i,
  /ver\s+lote|veja\s+o\s+lote/i,
  /septiembre|setembro|enero|janeiro|febrero|fevereiro/i,
  /estrada\s+de|s\/n\.\s+\d{5}/i,
  /nº\s+rellene/i
];

function splitSentences(rawText) {
  const sentences = String(rawText || '')
    .split(/(?<![A-Z][a-z])\.\s+(?=[A-ZÁÉÍÓÚ])|[!\n]+/)
    .map(s => s.trim())
    .filter(s => s.length > 8)
    .filter(s => !/^\d+[\w\/]*$/.test(s))
    .filter(s => !/^[A-ZÁÉÍÓÚa-z]{1,3}\.$/.test(s));

  return sentences;
}

function isIrrelevant(sentence) {
  return DROP_PATTERNS.some((pattern) => pattern.test(sentence));
}

/**
 * Removes OCR sentences that are irrelevant to ingredient adaptation.
 *
 * @param {string} text Text after composition extraction.
 * @returns {string} Text with irrelevant sentences removed.
 */
function filterRelevant(text) {
  const kept = splitSentences(text).filter((sentence) => {
    if (isIrrelevant(sentence)) return false;
    if (sentence.length < 15) return true;
    return true;
  });

  return kept.join('. ');
}

module.exports = { filterRelevant };
