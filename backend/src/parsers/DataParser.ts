import {
  ParsedIngredient,
  GraphicalElement,
  ComplexTermMapping,
} from '../types';
import { lookupAdditive } from './additiveMap';

export interface DataParserResult {
  ingredients: ParsedIngredient[];
  graphicalElements: GraphicalElement[];
  complexTermMappings: ComplexTermMapping[];
}

export async function parseIngredientText(text: string): Promise<DataParserResult> {
  const timeoutPromise = new Promise<DataParserResult>((_, reject) => {
    setTimeout(() => reject(new Error('DataParser timeout exceeded (50ms)')), 50);
  });

  const parsePromise = new Promise<DataParserResult>((resolve) => {
    resolve(runDfaParser(text));
  });

  return Promise.race([parsePromise, timeoutPromise]);
}

function runDfaParser(text: string): DataParserResult {
  const result: DataParserResult = {
    ingredients: [],
    graphicalElements: [],
    complexTermMappings: [],
  };

  if (!text) return result;

  const cleanText = text.replace(/^(ingredientes|ingredientes\s*:|ingredients\s*:)\s*/i, '');
  const tokens = splitIngredients(cleanText);

  for (const token of tokens) {
    const parsed = parseToken(token);
    if (parsed) {
      result.ingredients.push({
        ingredient: parsed.ingredient,
        value: parsed.value,
        unit: parsed.unit,
        raw: token
      });

      if (parsed.value !== null && parsed.unit !== null) {
        result.graphicalElements.push({
          type: parsed.unit === '%' ? 'percentage' : 'quantity',
          ingredient: parsed.ingredient,
          value: parsed.value,
          unit: parsed.unit as '%' | 'g/100g' | 'mg/100g' | 'g' | 'mg' | 'kg' | 'ml' | 'l'
        });
      }
    }
  }

  const eNumberRegex = /E[\s-]?(\d{3,4}[a-zA-Z]?)/gi;
  let match;
  const seenAdditives = new Set<string>();

  while ((match = eNumberRegex.exec(cleanText)) !== null) {
    const rawMatch = match[0];
    const eNumber = `E${match[1]}`;
    const normalized = eNumber.toUpperCase();

    if (!seenAdditives.has(normalized)) {
      seenAdditives.add(normalized);
      const additiveInfo = lookupAdditive(normalized);

      if (additiveInfo) {
        result.complexTermMappings.push({
          original: rawMatch,
          simplified: normalized,
          category: additiveInfo.category
        });
      }
    }
  }

  return result;
}

function splitIngredients(text: string): string[] {
  const result: string[] = [];
  let current = '';
  let parenDepth = 0;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '(') parenDepth++;
    else if (char === ')') parenDepth--;

    const isDecimalComma = char === ',' && i > 0 && i < text.length - 1 && /\d/.test(text[i - 1]) && /\d/.test(text[i + 1]);

    if (char === ',' && parenDepth === 0 && !isDecimalComma) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  if (current.trim()) {
    result.push(current.trim().replace(/\.$/, ''));
  }

  return result;
}

function parseToken(token: string): { ingredient: string; value: number | null; unit: string | null } | null {
  if (!token) return null;

  const quantityRegex = /(.*?)(\d+(?:[.,]\d+)?)\s*(%|g|mg|kg|ml|l|g\/100g|mg\/100g)\b\s*(\(.*\))?$/i;
  const match = quantityRegex.exec(token);

  if (match) {
    let name = match[1].trim();
    name = name.replace(/[-:]$/, '').trim();
    
    let valStr = match[2].replace(',', '.');
    const value = parseFloat(valStr);
    const unit = match[3].toLowerCase();

    return { ingredient: name || token, value, unit };
  }

  return { ingredient: token, value: null, unit: null };
}
