import dotenv from 'dotenv';
dotenv.config();

import nock from 'nock';
import { FacileParallelOrchestrator } from '../../facileOrchestrator.service';
import { env } from '../../../config/env';

describe('FacileOrchestrator (COMP-003 NLP Orchestrator)', () => {
  let orchestrator: FacileParallelOrchestrator;

  beforeEach(() => {
    orchestrator = new FacileParallelOrchestrator();
    nock.cleanAll();
  });

  it('should run clause suggestions concurrently via Promise.allSettled()', async () => {
    const rawText = 'Este es un texto muy complicado con varias cosas.';
    const facadeHost = env.FACILE_HOST;

    // Mock identify returns 2 violations
    nock(`${env.FACILE_HOST}:${env.FACILE_IDENTIFY_PORT}`)
      .post(`/facileRest/identification`)
      .reply(200, [
        { idGuideline: 'guideline22Vocab', startIndex: 21, endIndex: 31, subtext: 'complicado' },
        { idGuideline: 'guideline12Vocab', startIndex: 36, endIndex: 42, subtext: 'varias' }
      ]);

    // Mock suggest for both violations with small delays to ensure concurrency works
    nock(`${env.FACILE_HOST}:${env.FACILE_SUGGEST_PORT}`)
      .post(`/facileRest/suggestion`)
      .delay(100)
      .reply(200, [
        { idGuideline: 'guideline22Vocab', startIndex: 21, endIndex: 31, possibleTransformations: ['difícil'] }
      ]);

    nock(`${env.FACILE_HOST}:${env.FACILE_SUGGEST_PORT}`)
      .post(`/facileRest/suggestion`)
      .delay(100)
      .reply(200, [
        { idGuideline: 'guideline12Vocab', startIndex: 36, endIndex: 42, possibleTransformations: ['muchas'] }
      ]);

    const startTime = Date.now();
    const result = await orchestrator.adapt(rawText);
    const duration = Date.now() - startTime;

    // Both requests take 100ms. Sequentially it would be ~200ms+. Concurrently ~100ms.
    expect(duration).toBeLessThan(500); 
    
    expect(result.status).toBe('full');
    expect(result.adaptedText).toContain('difícil');
    expect(result.adaptedText).toContain('muchas');
  });

  it('should sort replacements right-to-left descending to prevent substring shift corruption', async () => {
    // If we replace 'A' at index 0 before 'B' at index 10, index 10 is shifted!
    // Sorting descending fixes this. The orchestrator must do this.
    
    const rawText = 'A is a letter, and B is too.';
    const facadeHost = env.FACILE_HOST;

    nock(`${env.FACILE_HOST}:${env.FACILE_IDENTIFY_PORT}`)
      .post(`/facileRest/identification`)
      .reply(200, [
        { idGuideline: 'g1', startIndex: 0, endIndex: 1, subtext: 'A' },
        { idGuideline: 'g2', startIndex: 19, endIndex: 20, subtext: 'B' }
      ]);

    nock(`${env.FACILE_HOST}:${env.FACILE_SUGGEST_PORT}`)
      .post(`/facileRest/suggestion`)
      .reply(200, [
        { idGuideline: 'g1', startIndex: 0, endIndex: 1, possibleTransformations: ['Alpha-Long'] }
      ]);

    nock(`${env.FACILE_HOST}:${env.FACILE_SUGGEST_PORT}`)
      .post(`/facileRest/suggestion`)
      .reply(200, [
        { idGuideline: 'g2', startIndex: 19, endIndex: 20, possibleTransformations: ['Beta'] }
      ]);

    const result = await orchestrator.adapt(rawText);
    
    // If it substituted left-to-right, 'B' would be substituted at index 19, 
    // but 'Alpha-Long' pushed the string out by 9 chars!
    // If right-to-left works, both are placed correctly.
    expect(result.adaptedText).toBe('Alpha-Long is a letter, and Beta is too.');
  });
});
