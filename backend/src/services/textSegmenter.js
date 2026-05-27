const loggerModule = require('../config/logger');
const { extractComposition } = require('./compositionParser');
const { filterRelevant } = require('./relevanceFilter');
const { filterToSpanish } = require('./languageFilter');
const { detectProductType } = require('./productTypeDetector');

const logger = loggerModule.logger || loggerModule.default || loggerModule;

function logInfo(message, metadata) {
  if (logger && typeof logger.info === 'function') {
    logger.info(message, metadata);
  }
}

function sentenceCount(text) {
  return String(text || '').split(/[.!\n]+/).map((sentence) => sentence.trim()).filter(Boolean).length;
}

/**
 * Runs the OCR text pre-processing pipeline before FACILE adaptation.
 *
 * @param {string} rawText Raw OCR output.
 * @returns {Promise<{ cleanText: string, minerals: Array<{label: string, value: number, unit: string}>, productType: string }>}
 */
async function preprocessOcrText(rawText) {
  const originalLength = String(rawText || '').length;
  const productType = detectProductType(rawText);

  const { minerals, remainingText } = extractComposition(rawText);
  logInfo('OCR preprocessing composition extraction complete', {
    originalLength,
    mineralsFound: minerals.length
  });

  const filteredText = filterRelevant(remainingText);
  logInfo('OCR preprocessing relevance filtering complete', {
    charsRemoved: remainingText.length - filteredText.length
  });

  const beforeLanguageSentences = sentenceCount(filteredText);
  let cleanText = await filterToSpanish(filteredText);
  // Remove leftover address fragments (postal codes + city names)
  cleanText = cleanText.replace(/\d{5}\s+[\wÁÉÍÓÚáéíóúñÑ\s]+España[^.]*\./gi, '');
  // Remove orphaned registry fragments
  cleanText = cleanText.replace(/\d{2}\.\d{5}\/[A-Z]{2}/g, '');
  // Collapse multiple spaces and leading punctuation
  cleanText = cleanText.replace(/\s{2,}/g, ' ').replace(/^[.,;\s]+/, '').trim();
  const afterLanguageSentences = sentenceCount(cleanText);
  logInfo('OCR preprocessing language filtering complete', {
    finalLength: cleanText.length,
    sentencesRemoved: Math.max(0, beforeLanguageSentences - afterLanguageSentences)
  });

  return { cleanText, minerals, productType };
}

module.exports = { preprocessOcrText };
