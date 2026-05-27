import {
  getGuideFrameRect,
  mapPreviewRectToImageCrop
} from '../utils/cameraGuideCrop';

describe('camera guide crop', () => {
  it('builds the crop frame from the visible guide geometry', () => {
    const frame = getGuideFrameRect({ width: 400, height: 800 });

    expect(frame.x).toBeCloseTo(36);
    expect(frame.y).toBe(72);
    expect(frame.width).toBeCloseTo(328);
    expect(frame.height).toBeCloseTo(565.52);
  });

  it('maps the center guide from a cover-scaled preview back to image pixels', () => {
    const frame = getGuideFrameRect({ width: 400, height: 800 });
    const crop = mapPreviewRectToImageCrop(
      frame,
      { width: 400, height: 800 },
      { width: 1200, height: 1600 }
    );

    expect(crop.x).toBeGreaterThanOrEqual(0);
    expect(crop.y).toBeGreaterThanOrEqual(0);
    expect(crop.width).toBeGreaterThan(600);
    expect(crop.height).toBeGreaterThan(1000);
    expect(crop.x + crop.width).toBeLessThanOrEqual(1200);
    expect(crop.y + crop.height).toBeLessThanOrEqual(1600);
  });
});
