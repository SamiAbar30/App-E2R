import { parseIngredientText } from '../DataParser';

describe('DataParser (COMP-004 DFA Engine)', () => {
  
  it('should execute tests against 10 real-world Spanish product anomalies', async () => {
    // 1. Percentage lookaheads
    const res1 = await parseIngredientText('Leche entera 80%');
    expect(res1.ingredients[0].value).toBe(80);
    expect(res1.ingredients[0].unit).toBe('%');

    // 2. Comma decimals
    const res2 = await parseIngredientText('sal 1,5g');
    expect(res2.ingredients[0].value).toBe(1.5);
    expect(res2.ingredients[0].unit).toBe('g');

    // 3. Chemical E-number mapping (needs eu-additives.json loaded)
    const res3 = await parseIngredientText('colorante E100');
    // E100 is Curcumina. Our DFA extracts it to complexTermMappings
    const mapping = res3.complexTermMappings.find((m: any) => m.simplified === 'E100');
    expect(mapping).toBeDefined();

    // 4. Nested parentheses ignoring commas
    const res4 = await parseIngredientText('azúcar, jarabe (fructosa, glucosa), sal');
    expect(res4.ingredients.length).toBe(3);
    expect(res4.ingredients[1].ingredient).toBe('jarabe (fructosa, glucosa)');

    // 5. "Ingredientes:" prefix
    const res5 = await parseIngredientText('Ingredientes: agua, malta');
    expect(res5.ingredients[0].ingredient).toBe('agua');

    // 6. mg/100g unit
    const res6 = await parseIngredientText('calcio 120mg/100g');
    expect(res6.ingredients[0].value).toBe(120);
    expect(res6.ingredients[0].unit).toBe('mg/100g');

    // 7. Trailing periods
    const res7 = await parseIngredientText('harina de trigo.');
    expect(res7.ingredients[0].ingredient).toBe('harina de trigo');

    // 8. E-number with dash/spaces
    const res8 = await parseIngredientText('conservante E-200');
    expect(res8.complexTermMappings.find((m: any) => m.simplified === 'E200')).toBeDefined();

    // 9. Decimal without leading zero (edge case format)
    const res9 = await parseIngredientText('fibra .5g');
    expect(res9.ingredients[0].value).toBe(0.5);

    // 10. Multiple E-numbers
    const res10 = await parseIngredientText('E100, E101');
    expect(res10.complexTermMappings.length).toBe(2);
  });

  it('should trigger the 50ms Promise.race processing cutoff for malicious payload', async () => {
    // Generate an extremely long, deeply nested string designed to slow regex/DFA
    // Note: JS engines are fast, so we need a really long string or infinite loop mock.
    // Our DFA is fast O(n), so to guarantee 50ms timeout we will mock setTimeout or just pass huge data.
    
    // Instead of freezing the actual event loop, we can jest.useFakeTimers to fast-forward the timeout
    jest.useFakeTimers();
    
    const promise = parseIngredientText('A'.repeat(5000000)); // Very long string
    
    // Fast forward exactly 51ms to trigger the timeout rejection
    jest.advanceTimersByTime(51);

    await expect(promise).rejects.toThrow('DataParser timeout exceeded (50ms)');
    
    jest.useRealTimers();
  });
});
