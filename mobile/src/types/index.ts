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
  productType?: string;
  originalText?: string;
  minerals?: MineralResult[];
  additives?: AdditiveResult[];
  allergens?: AllergenResult[];
  graphicalElements?: unknown[];
  difficultyLevel: number;
};

export type Additive = {
  code: string;
  name: string;
  dangerLevel: number;
};

export type MineralResult = {
  label: string;
  value: number;
  unit: string;
};

export type AdditiveResult = {
  code: string;
  name: string;
  category: string;
  safe: boolean;
  warning?: string;
};

export type AllergenResult = {
  name: string;
  severity: 'high' | 'medium' | 'low';
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
