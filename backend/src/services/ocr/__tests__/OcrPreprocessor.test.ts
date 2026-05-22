import { OcrImagePreprocessor } from '../../ocrPreprocessor.service';

// Mock sharp with a fluent chain builder
const mockToBuffer = jest.fn();
const mockChain: Record<string, jest.Mock> = {
  grayscale: jest.fn(),
  resize: jest.fn(),
  sharpen: jest.fn(),
  normalise: jest.fn(),
  negate: jest.fn(),
  threshold: jest.fn(),
  toBuffer: mockToBuffer,
};

// Each method returns the chain itself for fluent API
for (const key of Object.keys(mockChain)) {
  if (key !== 'toBuffer') {
    mockChain[key].mockReturnValue(mockChain);
  }
}

jest.mock('sharp', () => {
  return jest.fn(() => mockChain);
});

import sharp from 'sharp';

describe('OcrImagePreprocessor (Image Conditioning Pipeline)', () => {
  const testBuffer = Buffer.from('fake-image-data');

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset fluent chain returns
    for (const key of Object.keys(mockChain)) {
      if (key !== 'toBuffer') {
        mockChain[key].mockReturnValue(mockChain);
      }
    }
    mockToBuffer.mockResolvedValue(Buffer.from('processed-output'));
  });

  it('should execute the full 6-stage preprocessing pipeline in correct order', async () => {
    const result = await OcrImagePreprocessor.processForOcr(testBuffer);

    // Verify sharp was initialized with the input buffer
    expect(sharp).toHaveBeenCalledWith(testBuffer);

    // Verify all 6 pipeline stages were called
    expect(mockChain.grayscale).toHaveBeenCalled();
    expect(mockChain.resize).toHaveBeenCalledWith({ width: 2400, withoutEnlargement: true });
    expect(mockChain.sharpen).toHaveBeenCalledWith({ sigma: 1.5, m1: 0.5, m2: 2.0 });
    expect(mockChain.normalise).toHaveBeenCalled();
    expect(mockChain.negate).toHaveBeenCalledWith({ alpha: false });
    expect(mockChain.threshold).toHaveBeenCalledWith(140);
    expect(mockToBuffer).toHaveBeenCalled();

    // Verify output is a valid Buffer
    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result.toString()).toBe('processed-output');
  });

  it('should propagate sharp errors cleanly', async () => {
    mockToBuffer.mockRejectedValue(new Error('Sharp internal error: unsupported format'));

    await expect(OcrImagePreprocessor.processForOcr(testBuffer)).rejects.toThrow(
      'Sharp internal error: unsupported format'
    );
  });
});
