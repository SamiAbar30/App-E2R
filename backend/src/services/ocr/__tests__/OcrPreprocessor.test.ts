import { OcrImagePreprocessor } from '../../ocrPreprocessor.service';

// Mock sharp with a fluent chain builder
const mockToBuffer = jest.fn();
const mockChain: Record<string, jest.Mock> = {
  clone: jest.fn(),
  rotate: jest.fn(),
  flatten: jest.fn(),
  removeAlpha: jest.fn(),
  grayscale: jest.fn(),
  resize: jest.fn(),
  extend: jest.fn(),
  extract: jest.fn(),
  sharpen: jest.fn(),
  normalise: jest.fn(),
  negate: jest.fn(),
  threshold: jest.fn(),
  linear: jest.fn(),
  median: jest.fn(),
  dilate: jest.fn(),
  erode: jest.fn(),
  png: jest.fn(),
  raw: jest.fn(),
  metadata: jest.fn(),
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
    mockToBuffer.mockImplementation((options?: { resolveWithObject?: boolean }) => {
      if (options?.resolveWithObject) {
        return Promise.resolve({
          data: Buffer.from([
            20, 30, 90,
            25, 35, 95,
            240, 230, 80,
            250, 250, 250
          ]),
          info: { width: 2, height: 2, channels: 3 }
        });
      }

      return Promise.resolve(Buffer.from('processed-output'));
    });
    mockChain.metadata.mockResolvedValue({ width: 1200, height: 800 });
  });

  it('should execute the production preprocessing pipeline and return the default candidate', async () => {
    const result = await OcrImagePreprocessor.processForOcr(testBuffer);

    // Verify sharp was initialized with the input buffer
    expect(sharp).toHaveBeenCalledWith(testBuffer, { failOn: 'none' });

    // Verify normalization and candidate generation stages were called
    expect(mockChain.rotate).toHaveBeenCalled();
    expect(mockChain.flatten).toHaveBeenCalledWith({ background: { r: 255, g: 255, b: 255 } });
    expect(mockChain.removeAlpha).toHaveBeenCalled();
    expect(mockChain.raw).toHaveBeenCalled();
    expect(mockChain.extract).toHaveBeenCalled();
    expect(mockChain.grayscale).toHaveBeenCalled();
    expect(mockChain.resize).toHaveBeenCalledWith({ width: 3200, height: 3200, fit: 'inside', withoutEnlargement: true });
    expect(mockChain.resize).toHaveBeenCalledWith({ width: 2400, withoutEnlargement: false });
    expect(mockChain.extend).toHaveBeenCalledWith({ top: 16, bottom: 16, left: 16, right: 16, background: { r: 255, g: 255, b: 255 } });
    expect(mockChain.sharpen).toHaveBeenCalledWith({ sigma: 1.5, m1: 0.5, m2: 2.0 });
    expect(mockChain.normalise).toHaveBeenCalled();
    expect(mockChain.negate).toHaveBeenCalledWith({ alpha: false });
    expect(mockChain.threshold).toHaveBeenCalledWith(132);
    expect(mockChain.threshold).toHaveBeenCalledWith(140);
    expect(mockChain.dilate).toHaveBeenCalledWith(1);
    expect(mockChain.erode).toHaveBeenCalledWith(1);
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
