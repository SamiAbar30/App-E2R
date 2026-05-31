import jpeg from 'jpeg-js';
import { fromByteArray } from 'base64-js';
import { validateScannedLabel } from '../utils/validateScannedLabel';

function makeJpegBase64(
  width: number,
  height: number,
  pixel: (x: number, y: number) => [number, number, number]
) {
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

describe('validateScannedLabel', () => {
  it('accepts a bright high-contrast image with all checks passing', () => {
    const image = makeJpegBase64(900, 900, (x, y) => {
      const stripe = (Math.floor(x / 16) + Math.floor(y / 16)) % 2 === 0 ? 40 : 245;
      return [stripe, stripe, stripe];
    });
    const result = validateScannedLabel({ base64: image });

    expect(result.isAccepted).toBe(true);
    expect(result.overallScore).toBeGreaterThanOrEqual(50);
    expect(result.failedReasons).toHaveLength(0);
    expect(result.checks.length).toBeGreaterThanOrEqual(5);
    expect(result.scores.sharpness).toBeGreaterThan(0);
    expect(result.scores.brightness).toBeGreaterThan(0);
    expect(result.scores.contrast).toBeGreaterThan(0);
    expect(result.scores.overall).toBeGreaterThanOrEqual(0);
    expect(result.scores.overall).toBeLessThanOrEqual(100);
  });

  it('rejects a dark image with DARK reason', () => {
    const image = makeJpegBase64(900, 900, (x, y) => {
      const stripe = (x + y) % 18 < 9 ? 20 : 45;
      return [stripe, stripe, stripe];
    });
    const result = validateScannedLabel({ base64: image });

    expect(result.isAccepted).toBe(false);
    expect(result.failedReasons).toContain('DARK');
    expect(result.primaryMessage).toMatch(/dark/i);
  });

  it('rejects a tiny image with TOO_SMALL reason', () => {
    const image = makeJpegBase64(120, 120, () => [240, 240, 240]);
    const result = validateScannedLabel({ base64: image });

    expect(result.isAccepted).toBe(false);
    expect(result.failedReasons).toContain('TOO_SMALL');
  });

  it('returns scores object with all expected fields', () => {
    const image = makeJpegBase64(900, 900, (x, y) => {
      const stripe = (Math.floor(x / 16) + Math.floor(y / 16)) % 2 === 0 ? 40 : 245;
      return [stripe, stripe, stripe];
    });
    const result = validateScannedLabel({ base64: image });

    expect(result.scores).toHaveProperty('sharpness');
    expect(result.scores).toHaveProperty('brightness');
    expect(result.scores).toHaveProperty('contrast');
    expect(result.scores).toHaveProperty('glare');
    expect(result.scores).toHaveProperty('coverage');
    expect(result.scores).toHaveProperty('overall');
  });

  it('checks array contains per-dimension results', () => {
    const image = makeJpegBase64(900, 900, (x, y) => {
      const stripe = (Math.floor(x / 16) + Math.floor(y / 16)) % 2 === 0 ? 40 : 245;
      return [stripe, stripe, stripe];
    });
    const result = validateScannedLabel({ base64: image });

    const checkNames = result.checks.map((c) => c.check);
    expect(checkNames).toContain('BLUR');
    expect(checkNames).toContain('GLARE');
    expect(checkNames).toContain('OCCLUDED');
  });

  it('each check has required fields', () => {
    const image = makeJpegBase64(900, 900, () => [128, 128, 128]);
    const result = validateScannedLabel({ base64: image });

    for (const check of result.checks) {
      expect(check).toHaveProperty('check');
      expect(check).toHaveProperty('passed');
      expect(check).toHaveProperty('score');
      expect(check).toHaveProperty('message');
      expect(typeof check.passed).toBe('boolean');
      expect(typeof check.score).toBe('number');
      expect(check.score).toBeGreaterThanOrEqual(0);
      expect(check.score).toBeLessThanOrEqual(100);
    }
  });
});
