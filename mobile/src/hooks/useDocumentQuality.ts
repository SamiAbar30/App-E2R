import { useCallback, useMemo, useState } from 'react';
import {
  DocumentQualityHistoryEntry,
  DocumentQualityInput,
  DocumentQualityResult,
} from '../types/documentScanner';
import { evaluateDocumentQuality } from '../utils/documentImageQuality';

const INITIAL_QUALITY: DocumentQualityResult = {
  state: 'UNKNOWN',
  score: 0,
  shouldAccept: false,
  message: 'Scan quality unknown',
  hint: 'Start the scanner and place the document inside the frame.',
  metrics: {
    focus: 0,
    brightness: 0,
    contrast: 0,
    edgeDensity: 0,
    saturatedRatio: 0,
    foregroundFillRatio: 0,
    megapixels: 0,
    shortSide: 0,
  },
  reasons: [],
};

export function useDocumentQuality() {
  const [quality, setQuality] = useState<DocumentQualityResult>(INITIAL_QUALITY);
  const [history, setHistory] = useState<DocumentQualityHistoryEntry[]>([]);
  const [isEvaluating, setIsEvaluating] = useState(false);

  const evaluateScannedDocument = useCallback(
    async (input: Omit<DocumentQualityInput, 'history'>) => {
      setIsEvaluating(true);
      try {
        const result = evaluateDocumentQuality({ ...input, history });
        setQuality(result);

        if (input.quad) {
          setHistory((previous) => [
            ...previous.slice(-5),
            { quad: input.quad!, timestamp: Date.now() },
          ]);
        }

        return result;
      } finally {
        setIsEvaluating(false);
      }
    },
    [history]
  );

  const resetQuality = useCallback(() => {
    setHistory([]);
    setQuality(INITIAL_QUALITY);
  }, []);

  return useMemo(
    () => ({
      quality,
      isEvaluating,
      evaluateScannedDocument,
      resetQuality,
    }),
    [evaluateScannedDocument, isEvaluating, quality, resetQuality]
  );
}
