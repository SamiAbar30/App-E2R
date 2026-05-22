import { type ParsedIngredient } from '../types';

const ALLERGEN_KEYWORDS: ReadonlyMap<string, string> = new Map([
  ['gluten', 'Gluten'], ['trigo', 'Trigo'], ['centeno', 'Centeno'],
  ['cebada', 'Cebada'], ['avena', 'Avena'], ['espelta', 'Espelta'],
  ['crustáceos', 'Crustáceos'], ['huevo', 'Huevo'], ['huevos', 'Huevo'],
  ['pescado', 'Pescado'], ['cacahuete', 'Cacahuete'], ['cacahuetes', 'Cacahuete'],
  ['soja', 'Soja'], ['leche', 'Leche'], ['lácteo', 'Leche'], ['lactosa', 'Leche'],
  ['frutos de cáscara', 'Frutos de cáscara'],
  ['almendra', 'Almendra'], ['almendras', 'Almendra'],
  ['avellana', 'Avellana'], ['avellanas', 'Avellana'],
  ['nuez', 'Nuez'], ['nueces', 'Nuez'],
  ['anacardo', 'Anacardo'], ['pistacho', 'Pistacho'],
  ['apio', 'Apio'], ['mostaza', 'Mostaza'],
  ['sésamo', 'Sésamo'], ['sesamo', 'Sésamo'],
  ['sulfito', 'Sulfitos'], ['sulfitos', 'Sulfitos'], ['dióxido de azufre', 'Sulfitos'],
  ['altramuz', 'Altramuz'], ['altramuces', 'Altramuz'],
  ['molusco', 'Moluscos'], ['moluscos', 'Moluscos'],
  ['peanut', 'Cacahuete'], ['peanuts', 'Cacahuete'],
  ['milk', 'Leche'], ['egg', 'Huevo'], ['eggs', 'Huevo'],
  ['wheat', 'Trigo'], ['soy', 'Soja'], ['soybean', 'Soja'],
  ['fish', 'Pescado'], ['shellfish', 'Crustáceos'],
  ['tree nuts', 'Frutos de cáscara'], ['sesame', 'Sésamo'],
  ['celery', 'Apio'], ['mustard', 'Mostaza'],
  ['lupin', 'Altramuz'], ['mollusc', 'Moluscos'], ['molluscs', 'Moluscos'],
]);

export function detectAllergens(text: string): string[] {
  if (!text) return [];
  const lowerText = text.toLowerCase();
  const detected = new Set<string>();
  
  for (const [keyword, canonical] of ALLERGEN_KEYWORDS) {
    if (lowerText.includes(keyword)) {
      detected.add(canonical);
    }
  }
  
  return Array.from(detected);
}

export function detectAllergensFromIngredients(ingredients: ParsedIngredient[]): string[] {
  const combined = ingredients.map(i => i.ingredient).join(', ');
  return detectAllergens(combined);
}
