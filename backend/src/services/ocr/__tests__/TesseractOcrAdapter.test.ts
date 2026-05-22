import { TesseractOcrAdapter } from '../../tesseractOcrAdapter.service';
import { OcrUnavailableError } from '../../../types';
import { createWorker } from 'tesseract.js';

// Mock tesseract.js to avoid real heavy compilation and network downloads during tests
jest.mock('tesseract.js', () => ({
  createWorker: jest.fn()
}));

// Mock the preprocessor — this test focuses on Tesseract worker interaction,
// not image processing. Pass buffer through unchanged.
jest.mock('../../ocrPreprocessor.service', () => ({
  OcrImagePreprocessor: {
    processForOcr: jest.fn().mockImplementation((buf: Buffer) => Promise.resolve(buf))
  }
}));

describe('TesseractOcrAdapter (COMP-002 Pluggable Adapter)', () => {
  let adapter: TesseractOcrAdapter;
  let mockWorker: any;
  const mockBase64 = Buffer.from('mocked-image-data').toString('base64');

  beforeEach(() => {
    adapter = new TesseractOcrAdapter();
    jest.clearAllMocks();

    mockWorker = {
      recognize: jest.fn(),
      terminate: jest.fn().mockResolvedValue(undefined)
    };

    (createWorker as jest.Mock).mockResolvedValue(mockWorker);
  });

  it('should extract text successfully and normalize confidence/lines', async () => {
    mockWorker.recognize.mockResolvedValue({
      data: {
        text: 'Ingredients: Water, Sugar\r\nCitric Acid (E330)\nPeanuts\n',
        confidence: 87.5
      }
    });

    const result = await adapter.extract(mockBase64);

    // Assert worker creation and usage
    expect(createWorker).toHaveBeenCalledWith('spa+eng');
    expect(mockWorker.recognize).toHaveBeenCalled();
    expect(mockWorker.terminate).toHaveBeenCalled();

    // Assert output normalization
    expect(result.rawText).toBe('Ingredients: Water, Sugar Citric Acid (E330) Peanuts');
    expect(result.confidence).toBe(0.875);
    expect(result.lines).toEqual([
      'Ingredients: Water, Sugar',
      'Citric Acid (E330)',
      'Peanuts'
    ]);
  });

  it('should strip data URL headers correctly and still recognize', async () => {
    mockWorker.recognize.mockResolvedValue({
      data: {
        text: 'Ingredients: Apple',
        confidence: 90
      }
    });

    const result = await adapter.extract(`data:image/png;base64,${mockBase64}`);

    expect(mockWorker.recognize).toHaveBeenCalled();
    expect(result.rawText).toBe('Ingredients: Apple');
  });

  it('should throw OcrUnavailableError and clean up worker on tesseract failure', async () => {
    mockWorker.recognize.mockRejectedValue(new Error('Tesseract internal engine crash'));

    await expect(adapter.extract(mockBase64)).rejects.toThrow(OcrUnavailableError);

    // Verification of worker cleanup to prevent resource leaks
    expect(mockWorker.terminate).toHaveBeenCalled();
  });

  it('should throw OcrUnavailableError when returning an empty or whitespace-only result', async () => {
    mockWorker.recognize.mockResolvedValue({
      data: {
        text: '    \n   ',
        confidence: 10
      }
    });

    await expect(adapter.extract(mockBase64)).rejects.toThrow(OcrUnavailableError);
    expect(mockWorker.terminate).toHaveBeenCalled();
  });
});
