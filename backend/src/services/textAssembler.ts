import {
  AdditiveResult,
  AllergenResult,
  ComplexTermMapping,
  GraphicalElement,
  MineralResult
} from '../types';

export interface TextAssemblyInput {
  scanId?: string;
  originalText: string;
  adaptedText: string;
  productType: string;
  minerals?: MineralResult[];
  additives?: AdditiveResult[];
  allergens?: AllergenResult[];
  graphicalElements?: GraphicalElement[];
  complexTermMappings?: ComplexTermMapping[];
  processingMs?: number;
  degraded?: boolean;
}

/**
 * Assembles the final scan response from linguistic and structured data streams.
 *
 * @param input OCR, FACILE, and structured extraction outputs.
 * @returns API-ready response payload with empty arrays instead of nulls.
 */
export async function assemble(input: TextAssemblyInput) {
  return {
    ...(input.scanId ? { scanId: input.scanId } : {}),
    originalText: input.originalText,
    adaptedText: input.adaptedText,
    productType: input.productType,
    minerals: input.minerals || [],
    additives: input.additives || [],
    allergens: input.allergens || [],
    graphicalElements: input.graphicalElements || [],
    complexTermMappings: input.complexTermMappings || [],
    ...(typeof input.processingMs === 'number' ? { processingMs: input.processingMs } : {}),
    ...(typeof input.degraded === 'boolean' ? { degraded: input.degraded } : {})
  };
}
