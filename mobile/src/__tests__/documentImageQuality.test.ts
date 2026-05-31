import jpeg from 'jpeg-js';
import { fromByteArray } from 'base64-js';
import { evaluateDocumentQuality } from '../utils/documentImageQuality';

function makeJpegBase64(width: number, height: number, pixel: (x: number, y: number) => [number, number, number]) {
  const data = Buffer.alloc(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const [r, g, b] = pixel(x, y);
      data[offset] = r;
      data[offset + 1] = g;
      data[offset + 2] = b;
      data[offset + 3] = 255;
    }
  }

  const encoded = jpeg.encode({ data, width, height }, 92);
  return fromByteArray(new Uint8Array(encoded.data));
}

describe('evaluateDocumentQuality', () => {
  it('rejects tiny normalized scans', () => {
    const image = makeJpegBase64(120, 120, () => [240, 240, 240]);
    const quality = evaluateDocumentQuality({ base64: image });

    expect(quality.shouldAccept).toBe(false);
    expect(quality.state).toBe('TOO_SMALL');
  });

  it('rejects dark scans', () => {
    const image = makeJpegBase64(900, 900, (x, y) => {
      const stripe = (x + y) % 18 < 9 ? 20 : 45;
      return [stripe, stripe, stripe];
    });
    const quality = evaluateDocumentQuality({ base64: image });

    expect(quality.shouldAccept).toBe(false);
    expect(quality.state).toBe('BAD_LIGHT');
  });

  it('accepts a bright high-contrast normalized scan', () => {
    const image = makeJpegBase64(900, 900, (x, y) => {
      const stripe = (Math.floor(x / 16) + Math.floor(y / 16)) % 2 === 0 ? 40 : 245;
      return [stripe, stripe, stripe];
    });
    const quality = evaluateDocumentQuality({ base64: image });

    expect(quality.shouldAccept).toBe(true);
    expect(quality.state).toBe('GOOD');
  });

  it('returns new metric fields in result', () => {
    const image = makeJpegBase64(900, 900, (x, y) => {
      const stripe = (Math.floor(x / 16) + Math.floor(y / 16)) % 2 === 0 ? 40 : 245;
      return [stripe, stripe, stripe];
    });
    const quality = evaluateDocumentQuality({ base64: image });

    expect(quality.metrics).toHaveProperty('glareRatio');
    expect(quality.metrics).toHaveProperty('overexposed');
    expect(quality.metrics).toHaveProperty('edgeVoidRatio');
    expect(typeof quality.metrics.glareRatio).toBe('number');
    expect(typeof quality.metrics.overexposed).toBe('boolean');
    expect(typeof quality.metrics.edgeVoidRatio).toBe('number');
  });

  it('detects glare from bright white hotspot in center', () => {
    // Image is mostly normal checkerboard but the central 60% is all white (255,255,255)
    const image = makeJpegBase64(900, 900, (x, y) => {
      const isCentral = x >= 180 && x <= 720 && y >= 180 && y <= 720;
      if (isCentral) return [255, 255, 255]; // white glare hotspot
      const stripe = (Math.floor(x / 16) + Math.floor(y / 16)) % 2 === 0 ? 40 : 200;
      return [stripe, stripe, stripe];
    });
    const quality = evaluateDocumentQuality({ base64: image });

    expect(quality.metrics.glareRatio).toBeGreaterThan(0.1);
    // Should be rejected (either GLARE or BAD_LIGHT depending on overall brightness)
    expect(quality.shouldAccept).toBe(false);
  });

  it('detects overexposure from uniformly bright image', () => {
    // Image is globally very bright with high saturation ratio
    const image = makeJpegBase64(900, 900, (x, y) => {
      // Mostly washed out white/near-white with minimal variation
      const val = 230 + (x % 20 < 10 ? 10 : 25);
      return [val, val, val];
    });
    const quality = evaluateDocumentQuality({ base64: image });

    expect(quality.metrics.overexposed).toBe(true);
    expect(quality.shouldAccept).toBe(false);
  });
});
