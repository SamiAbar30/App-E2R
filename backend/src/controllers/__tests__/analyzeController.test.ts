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
  rawText: 'mocked OCR text',
  confidence: 0.99,
  lines: ['mocked OCR text']
};

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

  afterEach(() => {
    nock.cleanAll();
    jest.clearAllMocks();
  });

  it('should successfully execute full state machine and fire background promises (NFR-PERF-005)', async () => {
    // Mock FACILE identify
    nock(`${env.FACILE_HOST}:${env.FACILE_IDENTIFY_PORT}`)
      .post(`/facileRest/identification`)
      .reply(200, [
        { idGuideline: 'guideline22Vocab', startIndex: 0, endIndex: 4, subtext: 'test' }
      ]);

    // Mock FACILE suggest
    nock(`${env.FACILE_HOST}:${env.FACILE_SUGGEST_PORT}`)
      .post(`/facileRest/suggestion`)
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
    nock(`${env.FACILE_HOST}:${env.FACILE_IDENTIFY_PORT}`)
      .post(`/facileRest/identification`)
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

  it('should return 400 INVALID_REQUEST on missing required fields', async () => {
    const res = await request(app)
      .post('/api/v1/ingredients/analyze')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ userId: 'test-user', imagePayload: 'data:image/jpeg;base64,mock' }); // Missing deviceOS and timestamp

    expect(res.status).toBe(400);
    expect(res.body.errorCode).toBe('INVALID_REQUEST');
  });
});
