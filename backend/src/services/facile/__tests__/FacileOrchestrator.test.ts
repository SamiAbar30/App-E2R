import dotenv from 'dotenv';
dotenv.config();

import nock from 'nock';
import { FacileParallelOrchestrator } from '../../facileOrchestrator.service';
import { env } from '../../../config/env';

describe('FacileOrchestrator (COMP-003 NLP Orchestrator)', () => {
  let orchestrator: FacileParallelOrchestrator;

  const identifyPath = `/${env.FACILE_IDENTIFY_PORT}/facileRest/identification`;
  const suggestPath = `/${env.FACILE_SUGGEST_PORT}/facileRest/suggestion`;

  const buildViolation = (rawText: string, problematicClause: string, guideline = 'guideline22Vocab') => {
    const startIndex = rawText.indexOf(problematicClause);
    if (startIndex < 0) {
      throw new Error(`Test fixture does not contain "${problematicClause}"`);
    }

    return {
      guideline,
      startIndex,
      endIndex: startIndex + problematicClause.length,
      problematicClause,
      explanation: `Fixture violation for ${problematicClause}`
    };
  };

  const buildWrappedSuggestion = (
    violation: ReturnType<typeof buildViolation>,
    possibleTransformations: string[]
  ) => ({
    suggestions: [
      {
        guidelines: [{ guideline: violation.guideline }],
        startIndex: violation.startIndex,
        endIndex: violation.endIndex,
        problematicClause: violation.problematicClause,
        possibleTransformations
      }
    ]
  });

  const mockFacileCall = (
    label: 'IDENTIFY' | 'SUGGEST',
    path: string,
    responseBody: unknown,
    options: {
      status?: number;
      delayMs?: number;
      assertBody?: (body: unknown) => void;
    } = {}
  ) => {
    const scope = nock(`${env.FACILE_HOST}`)
      .post(path, body => {
        options.assertBody?.(body);
        return true;
      });

    if (options.delayMs) {
      scope.delay(options.delayMs);
    }

    return scope.reply(options.status || 200, (_uri, requestBody) => {
      console.log(`\n[FACILE TEST] ${label} request:`);
      console.log(JSON.stringify(requestBody, null, 2));
      console.log(`[FACILE TEST] ${label} response (${options.status || 200}):`);
      console.log(typeof responseBody === 'string' ? responseBody : JSON.stringify(responseBody, null, 2));
      return responseBody;
    });
  };

  beforeEach(() => {
    orchestrator = new FacileParallelOrchestrator();
    nock.cleanAll();
  });

  it('should run clause suggestions concurrently via Promise.allSettled()', async () => {
    const rawText = 'Este es un texto muy complicado con varias cosas.';

    mockFacileCall('IDENTIFY', identifyPath, [
        { idGuideline: 'guideline22Vocab', startIndex: 21, endIndex: 31, subtext: 'complicado' },
        { idGuideline: 'guideline12Vocab', startIndex: 36, endIndex: 42, subtext: 'varias' }
      ]);

    mockFacileCall('SUGGEST', suggestPath, [
        { idGuideline: 'guideline22Vocab', startIndex: 21, endIndex: 31, possibleTransformations: ['dificil'] }
      ], { delayMs: 100 });

    mockFacileCall('SUGGEST', suggestPath, [
        { idGuideline: 'guideline12Vocab', startIndex: 36, endIndex: 42, possibleTransformations: ['muchas'] }
      ], { delayMs: 100 });

    const startTime = Date.now();
    const result = await orchestrator.adapt(rawText);
    const duration = Date.now() - startTime;

    expect(duration).toBeLessThan(5000);
    expect(result.status).toBe('full');
    expect(result.adaptedText).toContain('dificil');
    expect(result.adaptedText).toContain('muchas');
  });

  it('should sort replacements right-to-left descending to prevent substring shift corruption', async () => {
    const rawText = 'A is a letter, and B is too.';

    mockFacileCall('IDENTIFY', identifyPath, [
        { idGuideline: 'g1', startIndex: 0, endIndex: 1, subtext: 'A' },
        { idGuideline: 'g2', startIndex: 19, endIndex: 20, subtext: 'B' }
      ]);

    mockFacileCall('SUGGEST', suggestPath, [
        { idGuideline: 'g1', startIndex: 0, endIndex: 1, possibleTransformations: ['Alpha-Long'] }
      ]);

    mockFacileCall('SUGGEST', suggestPath, [
        { idGuideline: 'g2', startIndex: 19, endIndex: 20, possibleTransformations: ['Beta'] }
      ]);

    const result = await orchestrator.adapt(rawText);

    expect(result.adaptedText).toBe('Alpha-Long is a letter, and Beta is too.');
  });

  it('should use the notebook FACILE payload and normalize wrapped responses', async () => {
    const rawText = 'Hoy voy a comer r\u00e1pidamente.';

    mockFacileCall('IDENTIFY', identifyPath, {
      guidelines: [
        {
          guideline: 'guideline7Vocab',
          startIndex: 16,
          endIndex: 27,
          problematicClause: 'r\u00e1pidamente',
          explanation: 'Evitar el uso de adverbios terminados en -mente.'
        }
      ]
    }, {
      assertBody: body => {
        expect(body).toMatchObject({
          originalText: rawText,
          formatInformation: [],
          guidelines: expect.arrayContaining(['guideline22Vocab'])
        });
        expect(body).not.toHaveProperty('text');
        expect(body).not.toHaveProperty('idGuidelines');
      }
    });

    mockFacileCall('SUGGEST', suggestPath, {
      suggestions: [
        {
          guidelines: [{ guideline: 'guideline7Vocab', t_startIndex: 0, t_endIndex: 16 }],
          startIndex: 16,
          endIndex: 27,
          problematicClause: 'r\u00e1pidamente',
          possibleTransformations: ['de manera r\u00e1pida']
        }
      ]
    }, {
      assertBody: body => {
        expect(body).toMatchObject({
          originalText: rawText,
          formatInformation: [],
          guidelines: [
            expect.objectContaining({
              idGuideline: 'guideline7Vocab',
              subtext: 'r\u00e1pidamente'
            })
          ]
        });
      }
    });

    const result = await orchestrator.adapt(rawText);

    expect(result.adaptedText).toBe('Hoy voy a comer de manera r\u00e1pida.');
    expect(result.violations[0]).toMatchObject({
      idGuideline: 'guideline7Vocab',
      subtext: 'r\u00e1pidamente'
    });
  });

  it('should keep clean water-label text unchanged when FACILE returns no guidelines', async () => {
    const rawText = 'Conservar en lugar fresco y seco. Agua mineral natural de mineralizaci\u00f3n d\u00e9bil';

    mockFacileCall('IDENTIFY', identifyPath, { guidelines: [] }, {
      assertBody: body => {
        expect(body).toMatchObject({
          originalText: rawText,
          formatInformation: [],
          guidelines: expect.any(Array)
        });
      }
    });

    const result = await orchestrator.adapt(rawText);

    expect(result.status).toBe('full');
    expect(result.adaptedText).toBe(rawText);
    expect(result.violations).toEqual([]);
    expect(result.complexTermMappings).toEqual([]);
  });

  it.each([
    {
      name: 'adverb ending in mente',
      rawText: 'Hoy voy a comer r\u00e1pidamente.',
      problematicClause: 'r\u00e1pidamente',
      replacement: 'de manera r\u00e1pida',
      guideline: 'guideline7Vocab',
      expected: 'Hoy voy a comer de manera r\u00e1pida.'
    },
    {
      name: 'technical ingredient term',
      rawText: 'El producto contiene sacarosa y aceite vegetal.',
      problematicClause: 'sacarosa',
      replacement: 'az\u00facar',
      guideline: 'guideline22Vocab',
      expected: 'El producto contiene az\u00facar y aceite vegetal.'
    },
    {
      name: 'long expression',
      rawText: 'Se recomienda efectuar una verificaci\u00f3n antes de consumir.',
      problematicClause: 'efectuar una verificaci\u00f3n',
      replacement: 'comprobar',
      guideline: 'guideline19Vocab',
      expected: 'Se recomienda comprobar antes de consumir.'
    }
  ])('should adapt FACILE fixture text: $name', async ({ rawText, problematicClause, replacement, guideline, expected }) => {
    const violation = buildViolation(rawText, problematicClause, guideline);

    mockFacileCall('IDENTIFY', identifyPath, { guidelines: [violation] });

    mockFacileCall('SUGGEST', suggestPath, buildWrappedSuggestion(violation, [replacement]));

    const result = await orchestrator.adapt(rawText);

    expect(result.status).toBe('full');
    expect(result.adaptedText).toBe(expected);
    expect(result.complexTermMappings).toContainEqual({
      original: problematicClause,
      simplified: replacement,
      category: 'FACILE Adaptation'
    });
  });

  it('should return partial status when one FACILE suggestion fails but another succeeds', async () => {
    const rawText = 'El producto contiene sacarosa y una composici\u00f3n complicada.';
    const sugarViolation = buildViolation(rawText, 'sacarosa', 'guideline22Vocab');
    const complexViolation = buildViolation(rawText, 'composici\u00f3n complicada', 'guideline19Vocab');

    mockFacileCall('IDENTIFY', identifyPath, { guidelines: [sugarViolation, complexViolation] });

    mockFacileCall('SUGGEST', suggestPath, buildWrappedSuggestion(sugarViolation, ['az\u00facar']));

    mockFacileCall('SUGGEST', suggestPath, 'Service Unavailable', { status: 503 });

    const result = await orchestrator.adapt(rawText);

    expect(result.status).toBe('partial');
    expect(result.failedGuidelines).toEqual(['guideline19Vocab']);
    expect(result.adaptedText).toBe('El producto contiene az\u00facar y una composici\u00f3n complicada.');
    expect(result.complexTermMappings).toContainEqual({
      original: 'sacarosa',
      simplified: 'az\u00facar',
      category: 'FACILE Adaptation'
    });
  });
});
