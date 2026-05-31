import { expandCognitiveAccessibility } from '../accessibilityExpander';

describe('AccessibilityExpander', () => {
  it('expands percentages with and without spaces', () => {
    expect(expandCognitiveAccessibility('10%')).toBe('10 por ciento');
    expect(expandCognitiveAccessibility('15 % de agua')).toBe('15 por ciento de agua');
    expect(expandCognitiveAccessibility('% diario')).toBe('por ciento diario');
  });

  it('expands safe chemical abbreviations case-insensitively', () => {
    expect(expandCognitiveAccessibility('contiene cl y ca')).toBe('contiene Cloruro y Calcio');
    expect(expandCognitiveAccessibility('mg: 10, fe: 5')).toBe('Magnesio: 10, Hierro: 5');
    expect(expandCognitiveAccessibility('NA y K')).toBe('Sodio y Potasio');
  });

  it('does not expand partial word matches', () => {
    const text = 'la clara casa tiene carne y maca';
    expect(expandCognitiveAccessibility(text)).toBe(text);
  });

  it('handles empty or null text gracefully', () => {
    expect(expandCognitiveAccessibility('')).toBe('');
    expect(expandCognitiveAccessibility(null as any)).toBe(null);
  });

  it('cleans up multiple spaces introduced by replacement', () => {
    expect(expandCognitiveAccessibility('10  %  ')).toBe('10 por ciento');
  });

  it('expands a combination of percentage and symbols', () => {
    const input = 'Ingredientes: agua, ca 10%, cl 5mg.';
    const expected = 'Ingredientes: agua, Calcio 10 por ciento, Cloruro 5mg.';
    expect(expandCognitiveAccessibility(input)).toBe(expected);
  });
});
