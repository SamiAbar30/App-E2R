import dotenv from 'dotenv';
dotenv.config();

import nock from 'nock';
import { GcpVisionAdapter } from '../../ocrAdapter.service';
import { OcrUnavailableError } from '../../../types';

const defaultUrl = 'http://localhost/v1/images:annotate';
const fullUrl = process.env.GCP_VISION_URL || defaultUrl;
const parsedUrl = new URL(fullUrl);
const mockOrigin = parsedUrl.origin;
const mockPath = parsedUrl.pathname;

jest.mock('../../../config/env', () => ({
  env: {
    GCP_VISION_KEY: 'test-key',
    GCP_VISION_URL: process.env.GCP_VISION_URL || 'http://localhost/v1/images:annotate'
  }
}));

// Mock the preprocessor — this test focuses on GCP API interaction and retry logic,
// not image processing. Pass buffer through unchanged.
jest.mock('../../ocrPreprocessor.service', () => ({
  OcrImagePreprocessor: {
    processForOcr: jest.fn().mockImplementation((buf: Buffer) => Promise.resolve(buf))
  }
}));

describe('GcpVisionAdapter (COMP-002 Pluggable Adapter)', () => {
  let adapter: GcpVisionAdapter;
  const mockImage = Buffer.from('mocked-image');

  beforeEach(() => {
    adapter = new GcpVisionAdapter();
    nock.cleanAll();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should return rawText correctly on successful OCR', async () => {
    nock(mockOrigin)
      .post(`${mockPath}?key=test-key`)
      .reply(200, {
        responses: [
          {
            fullTextAnnotation: { text: 'Test Line 1\nTest Line 2' }
          }
        ]
      });

    const result = await adapter.extract(mockImage.toString('base64'));

    expect(result.rawText).toBe('Test Line 1 Test Line 2');
    expect(result.lines).toEqual(['Test Line 1', 'Test Line 2']);
  });

  it('should execute exactly two sequential retries with exponential backoff on 5xx', async () => {
    // We will spy on global.setTimeout to verify backoff timeline
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

    // Nock will return 503 exactly 3 times (initial + 2 retries)
    nock(mockOrigin)
      .post(`${mockPath}?key=test-key`)
      .times(3)
      .reply(503, 'Service Unavailable');

    const startTime = Date.now();

    await expect(adapter.extract(mockImage.toString('base64'))).rejects.toThrow(OcrUnavailableError);

    const endTime = Date.now();
    const duration = endTime - startTime;

    // Retries happen at 200ms and 400ms = ~600ms total wait time
    // Allowing a generous buffer for execution and CPU scheduling overhead under load
    expect(duration).toBeGreaterThanOrEqual(600);
    expect(duration).toBeLessThan(6000);

    // setTimeout is called for retries (and maybe internally for other things like abort controller)
    // we just want to know it was invoked to wait
    expect(setTimeoutSpy).toHaveBeenCalled();
  });
});
