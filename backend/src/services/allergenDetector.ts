import { type ParsedIngredient } from '../types';

export interface AllergenResult {
  name: string;
  severity: 'high' | 'medium' | 'low';
}

const EU_ALLERGENS: ReadonlyArray<{ name: string; terms: string[] }> = [
  { name: 'gluten', terms: ['gluten', 'trigo', 'centeno', 'cebada', 'avena', 'espelta', 'kamut', 'wheat', 'barley', 'rye', 'oats'] },
  { name: 'crustáceos', terms: ['crustaceos', 'crustáceos', 'crustaceo', 'crustáceo', 'shellfish', 'crustacean'] },
  { name: 'huevo', terms: ['huevo', 'huevos', 'egg', 'eggs'] },
  { name: 'pescado', terms: ['pescado', 'fish'] },
  { name: 'cacahuete', terms: ['cacahuete', 'cacahuetes', 'mani', 'maní', 'peanut', 'peanuts'] },
  { name: 'soja', terms: ['soja', 'soy', 'soybean'] },
  { name: 'leche', terms: ['leche', 'lacteo', 'lácteo', 'lacteos', 'lácteos', 'lactosa', 'milk', 'lactose'] },
  { name: 'frutos de cáscara', terms: ['frutos de cascara', 'frutos de cáscara', 'almendra', 'almendras', 'avellana', 'avellanas', 'nuez', 'nueces', 'anacardo', 'anacardos', 'pistacho', 'pistachos', 'tree nuts'] },
  { name: 'apio', terms: ['apio', 'celery'] },
  { name: 'mostaza', terms: ['mostaza', 'mustard'] },
  { name: 'sésamo', terms: ['sesamo', 'sésamo', 'sesame'] },
  { name: 'sulfitos', terms: ['sulfito', 'sulfitos', 'dioxido de azufre', 'dióxido de azufre', 'sulphites', 'sulfites'] },
  { name: 'altramuz', terms: ['altramuz', 'altramuces', 'lupin'] },
  { name: 'moluscos', terms: ['molusco', 'moluscos', 'mollusc', 'molluscs'] }
];

function normalizeText(value: string): string {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function hasAllergenTerm(text: string, term: string): boolean {
  const normalizedText = normalizeText(text);
  const normalizedTerm = normalizeText(term).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${normalizedTerm}([^a-z0-9]|$)`, 'i').test(normalizedText);
}

function addAllergenMatches(text: string, detected: Map<string, AllergenResult>): void {
  for (const allergen of EU_ALLERGENS) {
    if (allergen.terms.some(term => hasAllergenTerm(text, term))) {
      detected.set(allergen.name, { name: allergen.name, severity: 'high' });
    }
  }
}

/**
 * Detects EU 1169/2011 allergens mentioned anywhere in a text fragment.
 *
 * @param text Text to scan for inline allergen mentions.
 * @returns Deduplicated allergen objects, or an empty array when none are found.
 */
export function detectAllergens(text: string): AllergenResult[] {
  if (!text) return [];

  const detected = new Map<string, AllergenResult>();
  addAllergenMatches(text, detected);

  return Array.from(detected.values());
}

/**
 * Extracts allergens from an explicit declaration block in raw OCR text.
 *
 * @param rawText Raw OCR text before relevance/language filtering.
 * @returns Deduplicated declared allergens with high severity.
 */
export function extractAllergenBlock(rawText: string): AllergenResult[] {
  if (!rawText) return [];

  const detected = new Map<string, AllergenResult>();
  const blockRegex = /(?:al[eé]rgenos?|contiene)[^:]*:\s*([^.]+)/gi;

  for (const match of String(rawText).matchAll(blockRegex)) {
    const block = match[1] || '';
    for (const token of block.split(',')) {
      addAllergenMatches(token, detected);
    }
  }

  return Array.from(detected.values());
}

export function detectAllergensFromIngredients(ingredients: ParsedIngredient[]): AllergenResult[] {
  const combined = ingredients.map(i => i.ingredient).join(', ');
  return detectAllergens(combined);
}
