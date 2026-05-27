import { cleanOcrText, postProcessOcrResult } from '../../ocrPostProcessor.service';

describe('OCR post processor', () => {
  it('performs deterministic cleanup without replacing the scanned text', () => {
    const text = 'Ingredientes:\u0000 agua,  E 330,  3 , 2 g.\n\n\nN o RGSEAA 27.01078/OR';

    expect(cleanOcrText(text)).toBe('Ingredientes: agua, E330, 3,2 g.\n\nNº RGSEAA 27.01078/OR');
  });

  it('does not canonicalize a known product label to fixture text', () => {
    const noisyText = [
      'CABREIROA VERO YECTO ORIGEN BOTELLA HECHA CON MATERIAL 100% RECICLADO.',
      'Composicion Analitica / Composicao Analitica N 1/4 Residuo seco residuo fixo 189,7',
      'MANANTIAL CABREIROA Aguas de Cabreiroa Estrada de Cabreiroa Verin Ourense Galicia'
    ].join(' ');

    const refined = postProcessOcrResult({
      rawText: noisyText,
      lines: [noisyText],
      confidence: 0.6
    });

    expect(refined.rawText).toContain('VERO YECTO');
    expect(refined.rawText).not.toContain('MÁS INFO EN CABREIROA.ES/ORIGEN');
    expect(refined.confidence).toBe(0.6);
  });

  it('preserves empty model responses for upstream rejection logic', () => {
    const refined = postProcessOcrResult({
      rawText: '[]',
      lines: ['[]'],
      confidence: 1
    });

    expect(refined.rawText).toBe('[]');
  });
});
