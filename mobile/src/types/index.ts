export type ApiResponse<T> = {
  status: 'ok' | 'error';
  data: T | null;
  code: number;
  message?: string;
};

export type ScanResult = {
  id: string;
  timestamp: number;
  date?: string;
  extractedText: string;
  adaptedText: string;
  allergensDetected: string[];
  additivesDetected: string[];
  difficultyLevel: number;
};

export type Additive = {
  code: string;
  name: string;
  dangerLevel: number;
};

export type AppState = {
  history: ScanResult[];
  imageUri: string | null;
  isProcessing: boolean;
  result: ScanResult | null;
  addScanToHistory: (scan: ScanResult) => void;
  setImageUri: (uri: string | null) => void;
  setIsProcessing: (isProcessing: boolean) => void;
  setResult: (result: ScanResult | null) => void;
  clearCurrentScan: () => void;
};
