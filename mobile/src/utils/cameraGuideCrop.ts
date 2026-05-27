import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

export type Size = {
  width: number;
  height: number;
};

export type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type CroppedImage = {
  uri: string;
  base64?: string;
  width?: number;
  height?: number;
};

export const GUIDE_TOP_OFFSET = 72;
export const GUIDE_WIDTH_RATIO = 0.82;
export const GUIDE_ASPECT_RATIO = 0.58;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function getGuideFrameRect(previewSize: Size): Rect {
  const width = previewSize.width * GUIDE_WIDTH_RATIO;
  const height = width / GUIDE_ASPECT_RATIO;

  return {
    x: (previewSize.width - width) / 2,
    y: GUIDE_TOP_OFFSET,
    width,
    height
  };
}

export function mapPreviewRectToImageCrop(frame: Rect, previewSize: Size, imageSize: Size): Rect {
  const scale = Math.max(previewSize.width / imageSize.width, previewSize.height / imageSize.height);
  const displayedWidth = imageSize.width * scale;
  const displayedHeight = imageSize.height * scale;
  const clippedX = (displayedWidth - previewSize.width) / 2;
  const clippedY = (displayedHeight - previewSize.height) / 2;

  const originX = (frame.x + clippedX) / scale;
  const originY = (frame.y + clippedY) / scale;
  const width = frame.width / scale;
  const height = frame.height / scale;

  const x = clamp(Math.round(originX), 0, imageSize.width - 1);
  const y = clamp(Math.round(originY), 0, imageSize.height - 1);
  const right = clamp(Math.round(originX + width), x + 1, imageSize.width);
  const bottom = clamp(Math.round(originY + height), y + 1, imageSize.height);

  return {
    x,
    y,
    width: right - x,
    height: bottom - y
  };
}

export async function cropImageToGuideFrame(
  uri: string,
  imageSize: Size,
  previewSize?: Size
): Promise<CroppedImage> {
  if (!previewSize || previewSize.width <= 0 || previewSize.height <= 0) {
    return { uri };
  }

  const frame = getGuideFrameRect(previewSize);
  const crop = mapPreviewRectToImageCrop(frame, previewSize, imageSize);
  const result = await manipulateAsync(
    uri,
    [
      {
        crop: {
          originX: crop.x,
          originY: crop.y,
          width: crop.width,
          height: crop.height
        }
      }
    ],
    {
      base64: true,
      compress: 0.9,
      format: SaveFormat.JPEG
    }
  );

  return {
    uri: result.uri,
    base64: result.base64,
    width: result.width,
    height: result.height
  };
}
