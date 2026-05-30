export type LabelBounds = {
  centerX: number;
  centerY: number;
  width: number;
  height: number;
};

export type FrameStats = {
  laplacianVariance: number;
  luminance: number;
  labelBounds?: LabelBounds;
};

export type LabelQualityStatus = 'unknown' | 'ready' | 'tooDark' | 'blurred' | 'tooSmall' | 'offCenter';

export type LabelQualityResult = {
  status: LabelQualityStatus;
  isClearToCapture: boolean;
  message: string;
  borderColor: string;
};

const READY_GREEN = '#2e7d32';
const WARNING_RED = '#ef233c';
const NEUTRAL_GRAY = '#8d99ae';

export function evaluateLabelQuality(stats?: FrameStats): LabelQualityResult {
  if (!stats) {
    return {
      status: 'unknown',
      isClearToCapture: false,
      message: 'FIND DOCUMENT',
      borderColor: NEUTRAL_GRAY
    };
  }

  if (stats.luminance < 0.2) {
    return {
      status: 'tooDark',
      isClearToCapture: false,
      message: 'MOVE CLOSER',
      borderColor: WARNING_RED
    };
  }

  if (stats.laplacianVariance < 50) {
    return {
      status: 'blurred',
      isClearToCapture: false,
      message: 'HOLD STEADY',
      borderColor: WARNING_RED
    };
  }

  if (stats.labelBounds) {
    const { centerX, centerY, width, height } = stats.labelBounds;
    const area = width * height;
    const isCentered = Math.abs(centerX - 0.5) <= 0.16 && Math.abs(centerY - 0.5) <= 0.18;

    if (area < 0.22) {
      return {
        status: 'tooSmall',
        isClearToCapture: false,
        message: 'MOVE CLOSER',
        borderColor: WARNING_RED
      };
    }

    if (!isCentered) {
      return {
        status: 'offCenter',
        isClearToCapture: false,
        message: 'CENTER LABEL',
        borderColor: WARNING_RED
      };
    }
  }

  return {
    status: 'ready',
    isClearToCapture: true,
    message: 'LABEL READY',
    borderColor: READY_GREEN
  };
}
