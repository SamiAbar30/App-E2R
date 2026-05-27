import mongoose from 'mongoose';
import { AdditiveDictionary } from '../models/AdditiveDictionary';
import { lookupAdditive } from '../parsers/additiveMap';

export interface AdditiveResult {
  code: string;
  name: string;
  category: string;
  safe: boolean;
  warning?: string;
}

const CHILD_ACTIVITY_WARNING = 'Puede afectar a la actividad y atención en niños';
const NITRITE_WARNING = 'Los nitritos pueden ser perjudiciales en grandes cantidades';

const SAFETY_WARNINGS: Record<string, string> = {
  E102: CHILD_ACTIVITY_WARNING,
  E104: CHILD_ACTIVITY_WARNING,
  E110: CHILD_ACTIVITY_WARNING,
  E122: CHILD_ACTIVITY_WARNING,
  E124: CHILD_ACTIVITY_WARNING,
  E129: CHILD_ACTIVITY_WARNING,
  E250: NITRITE_WARNING,
  E251: NITRITE_WARNING
};

const EASY_TO_READ_OVERRIDES: Record<string, Partial<Pick<AdditiveResult, 'name' | 'category'>>> = {
  E120: { name: 'Cochinilla' },
  E330: { category: 'Corrector de acidez' }
};

function normalizeECode(value: string): string {
  return String(value || '')
    .toUpperCase()
    .replace(/[\s-]/g, '')
    .replace(/O/g, '0');
}

function collectECodes(rawText: string): string[] {
  const found = new Set<string>();
  const text = String(rawText || '');
  const additiveBlockRegex = /(?:aditivos?|conservantes?|colorantes?)[^:]*:\s*([^.]+)/gi;
  const eNumberRegex = /\bE[\s-]?\d{3,4}[a-z]?\b/gi;

  for (const match of text.matchAll(additiveBlockRegex)) {
    const block = match[1] || '';
    for (const eMatch of block.matchAll(eNumberRegex)) {
      found.add(normalizeECode(eMatch[0]));
    }
  }

  for (const match of text.matchAll(eNumberRegex)) {
    found.add(normalizeECode(match[0]));
  }

  return Array.from(found);
}

async function lookupDictionaryEntry(code: string): Promise<{ name: string; category: string } | null> {
  if (mongoose.connection.readyState !== 1) {
    return null;
  }

  const entry = await AdditiveDictionary.findByAlias(code);
  if (!entry) {
    return null;
  }

  return {
    name: entry.simplifiedName || entry.commonName || code,
    category: entry.category || 'Aditivo'
  };
}

async function buildAdditiveResult(code: string): Promise<AdditiveResult> {
  const dictionaryEntry = await lookupDictionaryEntry(code);
  const localEntry = lookupAdditive(code);
  const override = EASY_TO_READ_OVERRIDES[code] || {};
  const warning = SAFETY_WARNINGS[code];

  return {
    code,
    name: override.name || dictionaryEntry?.name || localEntry?.name || code,
    category: override.category || dictionaryEntry?.category || localEntry?.category || 'Aditivo',
    safe: !warning,
    ...(warning ? { warning } : {})
  };
}

/**
 * Extracts E-number additives from raw OCR text before relevance/language filtering.
 *
 * @param rawText Raw OCR text or preserved additive declaration line.
 * @returns Deduplicated additives with names, categories, and EFSA warning flags.
 */
export async function extractAdditives(rawText: string): Promise<AdditiveResult[]> {
  try {
    const codes = collectECodes(rawText);
    const additives: AdditiveResult[] = [];

    for (const code of codes) {
      additives.push(await buildAdditiveResult(code));
    }

    return additives;
  } catch {
    return [];
  }
}
