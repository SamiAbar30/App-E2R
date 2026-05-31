import dotenv from 'dotenv';
dotenv.config();

import request from 'supertest';
import express from 'express';
import nock from 'nock';
import { createApp } from '../../app';
import { UserScan } from '../../models/UserScan';
import { ApiLog } from '../../models/ApiLog';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';

// Mock DB saves
jest.mock('../../models/UserScan', () => ({
  UserScan: {
    create: jest.fn().mockResolvedValue({})
  }
}));

jest.mock('../../models/ApiLog', () => ({
  ApiLog: {
    create: jest.fn().mockResolvedValue({})
  }
}));

const mockOcrResult = {
  rawText: 'Ingredientes: agua, azucar, aceite y sal.',
  confidence: 0.99,
  lines: ['Ingredientes: agua, azucar, aceite y sal.']
};

const CABREIROA_WITH_ADDITIVES = `CABREIROA PROYECTO ORIGEN. Composición Analítica / Composição Analitica (mg/l): 174 (Residuo seco/resíduo fixo), 189,7 (HCO3), 57,9 (Na), 24,6 (SiO2), 6,7 (Cl), 4,9 (Ca), 34 (Mg), 3,2 (K), 0,88 (F"), 0,19 (Li). pH: 7,1 Lab. Dr. Oliver Rodés, Septiembre/ Setembro 2022. Conservar en lugar fresco y seco. Sin luz solar ni olores agresivos. Agua mineral natural de mineralización débil. Nº RGSEAA 27.01078/OR. aditivos y alérgenos: E330, E102, E120, cacahuete, soja, leche.`;

jest.mock('../../services/ocrAdapter.service', () => ({
  GcpVisionAdapter: jest.fn().mockImplementation(() => ({
    extract: jest.fn().mockResolvedValue(mockOcrResult)
  }))
}));

jest.mock('../../services/mockOcrAdapter.service', () => ({
  MockOcrAdapter: jest.fn().mockImplementation(() => ({
    extract: jest.fn().mockResolvedValue(mockOcrResult)
  }))
}));

jest.mock('../../services/tesseractOcrAdapter.service', () => ({
  TesseractOcrAdapter: jest.fn().mockImplementation(() => ({
    extract: jest.fn().mockResolvedValue(mockOcrResult)
  }))
}));

jest.mock('../../services/paddleOcrAdapter.service', () => ({
  PaddleOcrAdapter: jest.fn().mockImplementation(() => ({
    extract: jest.fn().mockResolvedValue(mockOcrResult)
  }))
}));

// Mock the preprocessor — since all OCR adapters are fully mocked above,
// this prevents sharp from being invoked on fake image data.
jest.mock('../../services/ocrPreprocessor.service', () => ({
  OcrImagePreprocessor: {
    processForOcr: jest.fn().mockImplementation((buf: Buffer) => Promise.resolve(buf))
  }
}));

describe('Analyze Controller (COMP-001 State Machine)', () => {
  let app: express.Application;
  let validToken: string;

  beforeAll(() => {
    app = createApp();
    validToken = jwt.sign({ userId: 'test-user', role: 'user' }, env.JWT_SECRET);
  });

  beforeEach(() => {
    mockOcrResult.rawText = 'Ingredientes: agua, azucar, aceite y sal.';
    mockOcrResult.lines = ['Ingredientes: agua, azucar, aceite y sal.'];
  });

  afterEach(() => {
    nock.cleanAll();
    jest.clearAllMocks();
  });

  it('should successfully execute full state machine and fire background promises (NFR-PERF-005)', async () => {
    // Mock FACILE identify
    nock(`${env.FACILE_HOST}`)
      .post(`/${env.FACILE_IDENTIFY_PORT}/facileRest/identification`)
      .reply(200, [
        { idGuideline: 'guideline22Vocab', startIndex: 0, endIndex: 4, subtext: 'test' }
      ]);

    // Mock FACILE suggest
    nock(`${env.FACILE_HOST}`)
      .post(`/${env.FACILE_SUGGEST_PORT}/facileRest/suggestion`)
      .reply(200, [
        { idGuideline: 'guideline22Vocab', startIndex: 0, endIndex: 4, possibleTransformations: ['fácil'] }
      ]);

    const payload = {
      userId: 'test-user',
      deviceOS: 'iOS',
      imagePayload: 'data:image/jpeg;base64,mockedbase64string',
      timestamp: new Date().toISOString()
    };

    const res = await request(app)
      .post('/api/v1/ingredients/analyze')
      .set('Authorization', `Bearer ${validToken}`)
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.code).toBe('SUCCESS');
    expect(res.body.data).toHaveProperty('scanId');
    expect(res.body.data.adaptedText).toContain('fácil');

    // Verify NFR-PERF-005: Promises were fired after response
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(UserScan.create).toHaveBeenCalled();
    expect(ApiLog.create).toHaveBeenCalled();
  });

  it('should gracefully degrade on FACILE 503 error (NFR-REL-001)', async () => {
    // Simulate 503 from FACILE
    nock(`${env.FACILE_HOST}`)
      .post(`/${env.FACILE_IDENTIFY_PORT}/facileRest/identification`)
      .reply(503, 'Service Unavailable');

    const payload = {
      userId: 'test-user',
      deviceOS: 'Android',
      imagePayload: 'data:image/jpeg;base64,short',
      timestamp: new Date().toISOString()
    };

    const res = await request(app)
      .post('/api/v1/ingredients/analyze')
      .set('Authorization', `Bearer ${validToken}`)
      .send(payload);

    // Should return HTTP 207 for partial success
    expect(res.status).toBe(207);
    expect(res.body.status).toBe('partial');
    expect(res.body.code).toBe('UPM_DEGRADED');
    expect(res.body.data.adaptedText).toBeTruthy(); 
  });

  it('should keep adaptedText unchanged when FACILE identifies no guideline violations', async () => {
    nock(`${env.FACILE_HOST}`)
      .post(`/${env.FACILE_IDENTIFY_PORT}/facileRest/identification`, body => {
        expect(body).toMatchObject({
          originalText: mockOcrResult.rawText,
          formatInformation: [],
          guidelines: expect.any(Array)
        });
        return true;
      })
      .reply(200, { guidelines: [] });

    const payload = {
      userId: 'test-user',
      deviceOS: 'iOS',
      imagePayload: 'data:image/jpeg;base64,mockedbase64string',
      timestamp: new Date().toISOString()
    };

    const res = await request(app)
      .post('/api/v1/ingredients/analyze')
      .set('Authorization', `Bearer ${validToken}`)
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.code).toBe('SUCCESS');
    expect(res.body.data.adaptedText).toBe(mockOcrResult.rawText);
    expect(res.body.data.complexTermMappings).toEqual([]);

    await new Promise(resolve => setTimeout(resolve, 10));
    expect(UserScan.create).toHaveBeenCalledWith(expect.objectContaining({
      originalText: mockOcrResult.rawText,
      adaptedText: mockOcrResult.rawText,
      facileStatus: 'full'
    }));
  });

  it('should return minerals, additives, allergens, and productType from raw OCR data', async () => {
    mockOcrResult.rawText = CABREIROA_WITH_ADDITIVES;
    mockOcrResult.lines = [CABREIROA_WITH_ADDITIVES];

    nock(`${env.FACILE_HOST}`)
      .post(`/${env.FACILE_IDENTIFY_PORT}/facileRest/identification`)
      .reply(200, { guidelines: [] });

    const payload = {
      userId: 'test-user',
      deviceOS: 'Android',
      imagePayload: 'data:image/jpeg;base64,mockedbase64string',
      timestamp: new Date().toISOString()
    };

    const res = await request(app)
      .post('/api/v1/ingredients/analyze')
      .set('Authorization', `Bearer ${validToken}`)
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.productType).toBe('water');
    expect(res.body.data.minerals).toHaveLength(11);
    expect(res.body.data.minerals).toContainEqual({ label: 'HCO3', value: 189.7, unit: 'mg/l' });
    expect(res.body.data.additives).toContainEqual(expect.objectContaining({ code: 'E330' }));
    expect(res.body.data.additives).toContainEqual(expect.objectContaining({ code: 'E102', safe: false }));
    expect(res.body.data.additives).toContainEqual(expect.objectContaining({ code: 'E120' }));
    expect(res.body.data.allergens).toContainEqual({ name: 'cacahuete', severity: 'high' });
    expect(res.body.data.allergens).toContainEqual({ name: 'soja', severity: 'high' });
    expect(res.body.data.allergens).toContainEqual({ name: 'leche', severity: 'high' });
    expect(res.body.data.graphicalElements).toEqual([]);

    await new Promise(resolve => setTimeout(resolve, 10));
    expect(UserScan.create).toHaveBeenCalledWith(expect.objectContaining({
      productType: 'water',
      minerals: expect.arrayContaining([expect.objectContaining({ label: 'HCO3' })]),
      additives: expect.arrayContaining([expect.objectContaining({ code: 'E102', safe: false })]),
      allergens: expect.arrayContaining([{ name: 'leche', severity: 'high' }])
    }));
  });

  it('should return 400 INVALID_REQUEST on missing required fields', async () => {
    const res = await request(app)
      .post('/api/v1/ingredients/analyze')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ userId: 'test-user', imagePayload: 'data:image/jpeg;base64,mock' }); // Missing deviceOS and timestamp

    expect(res.status).toBe(400);
    expect(res.body.errorCode).toBe('INVALID_REQUEST');
  });

  it('should reject OCR text that is not a product label', async () => {
    mockOcrResult.rawText = 'Permiso de residencia temporal y trabajo. Valido hasta 08 2000. Documento oficial.';
    mockOcrResult.lines = [mockOcrResult.rawText];

    const payload = {
      userId: 'test-user',
      deviceOS: 'Android',
      imagePayload: 'data:image/jpeg;base64,mockedbase64string',
      timestamp: new Date().toISOString()
    };

    const res = await request(app)
      .post('/api/v1/ingredients/analyze')
      .set('Authorization', `Bearer ${validToken}`)
      .send(payload);

    expect(res.status).toBe(422);
    expect(res.body.status).toBe('error');
    expect(res.body.code).toBe('INVALID_PRODUCT_LABEL');
    expect(res.body.message).toContain('etiqueta de producto');
    expect(res.body.data).toBeNull();
  });
});
