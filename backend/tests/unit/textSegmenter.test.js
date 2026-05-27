const { extractComposition } = require('../../src/services/compositionParser');
const { filterRelevant } = require('../../src/services/relevanceFilter');
const { filterToSpanish } = require('../../src/services/languageFilter');
const { preprocessOcrText } = require('../../src/services/textSegmenter');
const { extractAdditives } = require('../../src/services/additiveExtractor');
const { extractAllergenBlock } = require('../../src/services/allergenDetector');

const CABREIROA_OCR = `CABREIROA 65 PROYECTO ORIGEN BOTELLA HECHA CON MATERIAL 100% RECICLADO. MÁS INFO EN CABREIROA.ES/ORIGEN Composición Analítica / Composição Analitica (mg/l): 174 (Residuo seco/resíduo fixo), 189,7 (HCO3), 57,9 (Na), 24,6 (SiO2), 6,7 (Cl), 4,9 (Ca), 34 (Mg), 3,2 (K), 0,88 (F"), 0,19 (Li). pH: 7,1 Lab. Dr. Oliver Rodés, Septiembre/ Setembro 2022. Conservar en lugar fresco y seco. Sin luz solar ni olores agresivos. Conservar em local fresco e seco. Sem luz solar ou odores agressivos. Agua mineral natural de mineralización débil. Água mineral natural pouco mineralizada. MANANTIAL CABREIROA Envasada por / Embalado por: Aguas de Cabreiroá, S.A. Manantial de Cabreiroá, Estrada de Cabreiro s/n. 32600 VeríNº urense Galicia España / Espanha. Nº RGSEAA 27.01078/OR. Consumir preferentemente antes del: Ver lote./Consumir de preferência antes de: Veja o lote. Importado por Justdrinks, Lda 289393757. +34 900 117 598 EXCLUSIVO HOSTELERÍA Amarillo 50cl ORIGEN ÚNICO POR SU SEGURIDAD Nº RELLENE 421194 Certified HR B D Corporation GALICIA CALIDADE 8 411902 004089`;

const CABREIROA_WITH_ADDITIVES = `${CABREIROA_OCR} aditivos y al\u00e9rgenos: E330, E102, E120, cacahuete, soja, leche.`;

describe('compositionParser', () => {
  it('extracts exactly 10 mg/l minerals from CABREIROA_OCR', () => {
    const { minerals } = extractComposition(CABREIROA_OCR);

    expect(minerals.filter((mineral) => mineral.unit === 'mg/l')).toHaveLength(10);
  });

  it('converts HCO3 comma decimal value to 189.7', () => {
    const { minerals } = extractComposition(CABREIROA_OCR);

    expect(minerals.find((mineral) => mineral.label === 'HCO3')).toMatchObject({
      value: 189.7
    });
  });

  it('extracts pH as structured data', () => {
    const { minerals } = extractComposition(CABREIROA_OCR);

    expect(minerals).toContainEqual({ label: 'pH', value: 7.1, unit: 'pH' });
  });

  it('removes composition values from remaining text', () => {
    const { remainingText } = extractComposition(CABREIROA_OCR);

    expect(remainingText).not.toContain('HCO3');
  });

  it('removes the analytical composition header from remaining text', () => {
    const { remainingText } = extractComposition(CABREIROA_OCR);

    expect(remainingText).not.toContain('Composición Analítica');
  });
});

describe('relevanceFilter', () => {
  const output = filterRelevant(CABREIROA_OCR);

  it('drops registry codes', () => {
    expect(output).not.toContain('RGSEAA');
  });

  it('drops phone numbers', () => {
    expect(output).not.toContain('+34 900 117 598');
  });

  it('drops spaced barcode-like sequences', () => {
    expect(output).not.toContain('8 411902 004089');
  });

  it('drops marketing campaigns', () => {
    expect(output).not.toContain('PROYECTO ORIGEN');
  });

  it('drops certification text', () => {
    expect(output).not.toContain('Certified');
  });

  it('keeps relevant Spanish storage guidance', () => {
    expect(output).toContain('Conservar en lugar fresco');
  });
});

describe('languageFilter', () => {
  it('drops Portuguese storage guidance', async () => {
    const output = await filterToSpanish('Conservar em local fresco e seco');

    expect(output).not.toContain('Conservar em local fresco e seco');
  });

  it('drops Portuguese mineral-water statement', async () => {
    const output = await filterToSpanish('Água mineral natural pouco mineralizada');

    expect(output).not.toContain('Água mineral natural pouco mineralizada');
  });

  it('keeps Spanish storage guidance', async () => {
    const output = await filterToSpanish('Conservar en lugar fresco y seco');

    expect(output).toContain('Conservar en lugar fresco y seco');
  });

  it('keeps Spanish mineral-water statement', async () => {
    const output = await filterToSpanish('Agua mineral natural de mineralización débil');

    expect(output).toContain('Agua mineral natural de mineralización débil');
  });

  it('keeps short strings below the detection threshold', async () => {
    const output = await filterToSpanish('pH: 7,1');

    expect(output).toBe('pH: 7,1');
  });
});

describe('textSegmenter integration', () => {
  it('keeps relevant Spanish text', async () => {
    const { cleanText } = await preprocessOcrText(CABREIROA_OCR);

    expect(cleanText).toContain('Conservar en lugar fresco');
  });

  it('drops Portuguese text', async () => {
    const { cleanText } = await preprocessOcrText(CABREIROA_OCR);

    expect(cleanText).not.toContain('Conservar em local');
  });

  it('drops registry text', async () => {
    const { cleanText } = await preprocessOcrText(CABREIROA_OCR);

    expect(cleanText).not.toContain('RGSEAA');
  });

  it('extracts 10 mg/l entries plus pH', async () => {
    const { minerals } = await preprocessOcrText(CABREIROA_OCR);

    expect(minerals).toHaveLength(11);
  });

  it('keeps HCO3 as structured mineral data', async () => {
    const { minerals } = await preprocessOcrText(CABREIROA_OCR);

    expect(minerals).toContainEqual({ label: 'HCO3', value: 189.7, unit: 'mg/l' });
  });

  it('detects the Cabreiroa OCR as water', async () => {
    const { productType } = await preprocessOcrText(CABREIROA_OCR);

    expect(productType).toBe('water');
  });

  it('removes orphaned registry fragments from clean text', async () => {
    const { cleanText } = await preprocessOcrText(CABREIROA_OCR);

    expect(cleanText).not.toContain('01078/OR');
  });

  it('removes abbreviation fragments from clean text', async () => {
    const { cleanText } = await preprocessOcrText(CABREIROA_OCR);

    expect(cleanText).not.toContain('A.');
  });

  it('keeps Spanish storage guidance after cleanup', async () => {
    const { cleanText } = await preprocessOcrText(CABREIROA_OCR);

    expect(cleanText).toContain('Conservar en lugar fresco');
  });

  it('keeps Spanish mineralization description after cleanup', async () => {
    const { cleanText } = await preprocessOcrText(CABREIROA_OCR);

    expect(cleanText).toContain('mineralización débil');
  });
});

describe('additive extraction', () => {
  it('extracts three additives from CABREIROA_WITH_ADDITIVES', async () => {
    const additives = await extractAdditives(CABREIROA_WITH_ADDITIVES);

    expect(additives).toHaveLength(3);
  });

  it('contains E330', async () => {
    const additives = await extractAdditives(CABREIROA_WITH_ADDITIVES);

    expect(additives).toContainEqual(expect.objectContaining({ code: 'E330' }));
  });

  it('marks E102 as unsafe', async () => {
    const additives = await extractAdditives(CABREIROA_WITH_ADDITIVES);

    expect(additives).toContainEqual(expect.objectContaining({ code: 'E102', safe: false }));
  });

  it('contains E120', async () => {
    const additives = await extractAdditives(CABREIROA_WITH_ADDITIVES);

    expect(additives).toContainEqual(expect.objectContaining({ code: 'E120' }));
  });

  it('adds the EFSA warning for E102', async () => {
    const additives = await extractAdditives(CABREIROA_WITH_ADDITIVES);
    const e102 = additives.find((additive) => additive.code === 'E102');

    expect(e102.warning).toContain('ni\u00f1os');
  });
});

describe('allergen extraction', () => {
  it('extracts three declared allergens from CABREIROA_WITH_ADDITIVES', () => {
    const allergens = extractAllergenBlock(CABREIROA_WITH_ADDITIVES);

    expect(allergens).toHaveLength(3);
  });

  it('contains cacahuete as high severity', () => {
    const allergens = extractAllergenBlock(CABREIROA_WITH_ADDITIVES);

    expect(allergens).toContainEqual({ name: 'cacahuete', severity: 'high' });
  });

  it('contains soja as high severity', () => {
    const allergens = extractAllergenBlock(CABREIROA_WITH_ADDITIVES);

    expect(allergens).toContainEqual({ name: 'soja', severity: 'high' });
  });

  it('contains leche as high severity', () => {
    const allergens = extractAllergenBlock(CABREIROA_WITH_ADDITIVES);

    expect(allergens).toContainEqual({ name: 'leche', severity: 'high' });
  });
});

describe('full pipeline with additives', () => {
  it('preserves the raw additive declaration line', async () => {
    const { rawAdditives } = await preprocessOcrText(CABREIROA_WITH_ADDITIVES);

    expect(rawAdditives).toContain('E330');
  });

  it('does not return an empty rawAdditives string', async () => {
    const { rawAdditives } = await preprocessOcrText(CABREIROA_WITH_ADDITIVES);

    expect(rawAdditives).not.toBe('');
  });
});
