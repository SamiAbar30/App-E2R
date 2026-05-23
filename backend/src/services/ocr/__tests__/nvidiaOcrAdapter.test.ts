import { NvidiaOcrAdapter } from '../../nvidiaOcrAdapter.service';
import { env } from '../../../config/env';
import { OcrUnavailableError } from '../../../types';

jest.mock('../../../config/env', () => ({
  env: {
    NVIDIA_API_KEY: 'test-key',
    NVIDIA_MODEL: 'test-model',
  }
}));

// Mock the preprocessor to just return the buffer
jest.mock('../../ocrPreprocessor.service', () => ({
  OcrImagePreprocessor: {
    processForOcr: jest.fn().mockImplementation((buffer) => Promise.resolve(buffer))
  }
}));

describe('NvidiaOcrAdapter', () => {
  let adapter: NvidiaOcrAdapter;
  let globalFetch: jest.Mock;

  beforeEach(() => {
    globalFetch = jest.fn();
    global.fetch = globalFetch;
    adapter = new NvidiaOcrAdapter();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should extract text successfully using NVIDIA API', async () => {
    const mockResponse = {
      choices: [{
        message: {
          content: 'Harina de trigo, agua, sal.'
        }
      }]
    };

    globalFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockResponse)
    });

    const result = await adapter.extract('fake-base64');
    expect(result.rawText).toBe('Harina de trigo, agua, sal.');
    expect(result.confidence).toBe(1.0);
    expect(result.lines).toHaveLength(1);
    expect(globalFetch).toHaveBeenCalledTimes(1);
  });

  it('should retry on 5xx errors and eventually succeed', async () => {
    const mockResponse = {
      choices: [{
        message: { content: 'Azúcar' }
      }]
    };

    globalFetch
      .mockResolvedValueOnce({ ok: false, status: 503, text: () => Promise.resolve('Service Unavailable') })
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve(mockResponse) });

    const result = await adapter.extract('fake-base64');
    expect(result.rawText).toBe('Azúcar');
    expect(globalFetch).toHaveBeenCalledTimes(2);
  });

  it('should throw OcrUnavailableError after max retries on 5xx', async () => {
    globalFetch.mockResolvedValue({
      ok: false,
      status: 502,
      text: () => Promise.resolve('Bad Gateway')
    });

    await expect(adapter.extract('fake-base64')).rejects.toThrow(OcrUnavailableError);
    expect(globalFetch).toHaveBeenCalledTimes(3); // Initial + 2 retries
  });
});
