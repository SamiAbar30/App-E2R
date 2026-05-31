export type DocumentPoint = {
  x: number;
  y: number;
};

export type DocumentQuad = {
  topLeft: DocumentPoint;
  topRight: DocumentPoint;
  bottomRight: DocumentPoint;
  bottomLeft: DocumentPoint;
};

export type DocumentFrameSize = {
  width: number;
  height: number;
};

export type DocumentQualityState =
  | 'GOOD'
  | 'BAD_BLUR'
  | 'BAD_LIGHT'
  | 'LOW_CONTRAST'
  | 'GLARE'
  | 'OCCLUDED'
  | 'TOO_SMALL'
  | 'BAD_PERSPECTIVE'
  | 'UNSTABLE'
  | 'UNKNOWN';

export type DocumentQualityHistoryEntry = {
  quad: DocumentQuad;
  timestamp: number;
};

export type DocumentQualityInput = {
  uri?: string;
  base64?: string;
  width?: number;
  height?: number;
  quad?: DocumentQuad;
  frameSize?: DocumentFrameSize;
  history?: DocumentQualityHistoryEntry[];
};

export type DocumentQualityMetrics = {
  focus: number;
  brightness: number;
  contrast: number;
  edgeDensity: number;
  saturatedRatio: number;
  foregroundFillRatio: number;
  megapixels: number;
  shortSide: number;
  glareRatio: number;
  overexposed: boolean;
  edgeVoidRatio: number;
  fillRatio?: number;
  maxPerspectiveError?: number;
  stabilityDelta?: number;
};

export type DocumentQualityResult = {
  state: DocumentQualityState;
  score: number;
  shouldAccept: boolean;
  message: string;
  hint: string;
  metrics: DocumentQualityMetrics;
  reasons: DocumentQualityState[];
};

export type AcceptedDocumentImage = {
  uri: string;
  base64: string;
  width?: number;
  height?: number;
  quality: DocumentQualityResult;
};
