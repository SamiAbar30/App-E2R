import { OcrResult } from '../types';

function normalizeUnicodePunctuation(text: string): string {
  return text
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/[\u2010\u2011\u2012\u2013\u2014]/g, '-')
    .replace(/\u00A0/g, ' ');
}

function removeControlCharacters(text: string): string {
  return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ' ');
}

function repairValidatedFoodPatterns(text: string): string {
  return text
    .replace(/\bE\s+(\d{3,4}[a-z]?)\b/gi, 'E$1')
    .replace(/\b(\d+)\s*,\s*(\d+)\b/g, '$1,$2')
    .replace(/\b(\d+)\s*\.\s*(\d+)\b/g, '$1.$2')
    .replace(/\b(\d+)\s+(mg|g|kg|ml|l|cl|kcal|kj)\b/gi, '$1 $2')
    .replace(/\bN\s*[oº]\s*/gi, 'Nº ');
}

export function cleanOcrText(text: string): string {
  return repairValidatedFoodPatterns(
    normalizeUnicodePunctuation(removeControlCharacters(text))
  )
    .split(/\r?\n/)
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function postProcessOcrResult(result: OcrResult): OcrResult {
  const rawText = cleanOcrText(result.rawText);
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  return {
    ...result,
    rawText,
    lines
  };
}
