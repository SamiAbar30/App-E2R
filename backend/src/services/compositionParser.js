function parseNumber(value) {
  return Number.parseFloat(value.replace(',', '.'));
}

function cleanLabel(label) {
  return label.replace(/["'`´“”‘’]/g, '').trim();
}

function normalizeRemainingText(text) {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,;:])/g, '$1')
    .trim();
}

function findCompositionHeader(text) {
  return /Composici[oó]n\s+Anal[ií]tica(?:\s*\/\s*Composi[cç][aã]o\s+Anal[ií]tica)?\s*\(mg\/l\)\s*:\s*/i.exec(text);
}

function extractPairBlock(text) {
  const pairRegex = /(\d+(?:[,.]\d+)?)\s*\(([^)]+)\)/g;
  const pairs = [];
  let match;
  let firstIndex = -1;
  let lastEnd = -1;

  while ((match = pairRegex.exec(text)) !== null) {
    if (firstIndex === -1) firstIndex = match.index;
    lastEnd = pairRegex.lastIndex;
    pairs.push({
      label: cleanLabel(match[2]),
      value: parseNumber(match[1]),
      unit: 'mg/l'
    });
  }

  return { pairs, firstIndex, lastEnd };
}

/**
 * Extracts an analytical mg/l composition block from OCR text.
 *
 * @param {string} rawText Raw OCR output.
 * @returns {{ minerals: Array<{label: string, value: number, unit: string}>, remainingText: string }}
 */
function extractComposition(rawText) {
  const text = String(rawText || '');
  const minerals = [];
  let remainingText = text;

  const phRegex = /\bpH\s*[:=]?\s*(\d+(?:[,.]\d+)?)/i;
  const phMatch = phRegex.exec(text);
  if (phMatch) {
    minerals.push({
      label: 'pH',
      value: parseNumber(phMatch[1]),
      unit: 'pH'
    });
  }

  const header = findCompositionHeader(text);

  if (header) {
    const afterHeaderStart = header.index + header[0].length;
    const afterHeader = text.slice(afterHeaderStart);
    const phIndexInTail = phRegex.exec(afterHeader)?.index;
    const candidateBlock = phIndexInTail === undefined ? afterHeader : afterHeader.slice(0, phIndexInTail);
    const { pairs, lastEnd } = extractPairBlock(candidateBlock);

    if (pairs.length > 0) {
      minerals.unshift(...pairs);
      const removalEnd = afterHeaderStart + lastEnd;
      remainingText = text.slice(0, header.index) + ' ' + text.slice(removalEnd);
    } else {
      remainingText = text.replace(header[0], ' ');
    }
  } else {
    const { pairs, firstIndex, lastEnd } = extractPairBlock(text);
    if (pairs.length > 1) {
      minerals.unshift(...pairs);
      remainingText = text.slice(0, firstIndex) + ' ' + text.slice(lastEnd);
    }
  }

  remainingText = remainingText
    .replace(/Composici[oó]n\s+Anal[ií]tica(?:\s*\/\s*Composi[cç][aã]o\s+Anal[ií]tica)?\s*\(mg\/l\)\s*:\s*/gi, ' ')
    .replace(phRegex, ' ');

  return {
    minerals,
    remainingText: normalizeRemainingText(remainingText)
  };
}

module.exports = { extractComposition };
