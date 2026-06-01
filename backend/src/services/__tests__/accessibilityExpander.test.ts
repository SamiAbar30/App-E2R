import { expandCognitiveAccessibility } from '../accessibilityExpander';

describe('expandCognitiveAccessibility', () => {
  it('explains VRN percentages following UNE guideline 22', () => {
    const result = expandCognitiveAccessibility('Calcio: 120 mg 15% VRN');

    expect(result).toContain('120 mg');
    expect(result).toContain('15 de cada 100 partes del valor de referencia de nutrientes');
    expect(result).not.toContain('15 por ciento');
  });

  it('explains common percentages as equivalences instead of por ciento', () => {
    const result = expandCognitiveAccessibility('El 25% de la poblacion.');

    expect(result).toBe('Una de cada cuatro personas.');
  });

  it('keeps measurement units without expanding mg as Magnesio', () => {
    const result = expandCognitiveAccessibility('Calcio: 120 mg. Valor energetico: 192 kj 46 kcal.');

    expect(result).toContain('120 mg');
    expect(result).toContain('192 kj');
    expect(result).toContain('46 kcal');
    expect(result).not.toContain('120 Magnesio');
  });

  it('expands fraction symbols to readable Spanish words', () => {
    expect(expandCognitiveAccessibility('Usar ½ vaso.')).toBe('Usar la mitad vaso.');
  });
});
