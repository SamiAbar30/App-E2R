import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  AnalyzeRequest,
  AnalyzeResponseData,
  ApiEnvelope,
  AnalyzeState,
  OcrUnavailableError,
  GraphicalElement,
  ComplexTermMapping,
  AllergenResult,
  AdditiveResult,
  MineralResult
} from '../types';
import { GcpVisionAdapter, IOcrProvider } from '../services/ocrAdapter.service';
import { MockOcrAdapter } from '../services/mockOcrAdapter.service';
import { TesseractOcrAdapter } from '../services/tesseractOcrAdapter.service';
import { PaddleOcrAdapter } from '../services/paddleOcrAdapter.service';
import { OpenRouterOcrAdapter } from '../services/openRouterOcrAdapter.service';
import { NvidiaOcrAdapter } from '../services/nvidiaOcrAdapter.service';
import { env } from '../config/env';
import { FacileParallelOrchestrator, FacileTimeoutError } from '../services/facileOrchestrator.service';
import { parseIngredientText } from '../parsers/DataParser';
import { detectAllergens, detectAllergensFromIngredients, extractAllergenBlock } from '../services/allergenDetector';
import { extractAdditives } from '../services/additiveExtractor';
import { UserScan } from '../models/UserScan';
import { ApiLog } from '../models/ApiLog';
import { postProcessOcrResult } from '../services/ocrPostProcessor.service';
import { assemble } from '../services/textAssembler';
import { expandCognitiveAccessibility } from '../services/accessibilityExpander';
const { preprocessOcrText } = require('../services/textSegmenter');

interface ScanDocument {
  userId: string;
  deviceOS: 'iOS' | 'Android';
  productType: string;
  originalText: string;
  adaptedText: string;
  minerals: MineralResult[];
  additives: AdditiveResult[];
  allergens: AllergenResult[];
  graphicalElements: GraphicalElement[];
  complexTermMappings: ComplexTermMapping[];
  processingMs: number;
  facileStatus: 'full' | 'partial' | 'failed';
}

const scanRepository = {
  create: (scanDocument: ScanDocument) => UserScan.create(scanDocument)
};

type AnalyzeResponseWithProductType = AnalyzeResponseData & {
  productType: string;
  minerals: MineralResult[];
  additives: AdditiveResult[];
};

function mergeUniqueAllergens(...groups: AllergenResult[][]): AllergenResult[] {
  const byName = new Map<string, AllergenResult>();

  for (const group of groups) {
    for (const allergen of group) {
      byName.set(allergen.name.toLowerCase(), allergen);
    }
  }

  return Array.from(byName.values());
}

function isLikelyProductLabel({
  rawText,
  cleanText,
  productType,
  minerals,
  rawAdditives,
  rawAllergens
}: {
  rawText: string;
  cleanText: string;
  productType: string;
  minerals: MineralResult[];
  rawAdditives?: string;
  rawAllergens?: string;
}): boolean {
  if (productType && productType !== 'unknown') return true;
  if (minerals.length > 0) return true;
  if ((rawAdditives || rawAllergens)?.trim()) return true;

  const text = `${rawText || ''} ${cleanText || ''}`;
  return /ingredientes?|al[eé]rgenos?|contiene|aditivos?|conservantes?|colorantes?|valor\s+energ[eé]tico|informaci[oó]n\s+nutricional|agua\s+mineral|composici[oó]n\s+anal[ií]tica|manantial|conservar|consumir\s+preferentemente|e-?\d{3}/i.test(text);
}

export async function analyzeHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  const startTime = Date.now();
  let state: AnalyzeState = 'RECEIVED';
  const scanId = uuidv4();

  console.log(`\n[Analyze API] Received scan request (ID: ${scanId})`);

  try {
    const payload = req.body as Partial<AnalyzeRequest>;
    if (!payload.userId || !payload.deviceOS || !payload.imagePayload || !payload.timestamp) {
      res.status(400).json({
        status: 'error',
        errorCode: 'INVALID_REQUEST',
        message: 'Missing required fields: userId, deviceOS, imagePayload, timestamp'
      });
      return;
    }

    const { userId, deviceOS, imagePayload } = payload as AnalyzeRequest;
    state = 'VALIDATED';

    state = 'OCR_EXEC';
    let ocrProvider: IOcrProvider;
    try {
      if (env.OCR_PROVIDER === 'mock') {
        console.log(`[Analyze API - ${scanId}] Initializing Mock OCR Adapter...`);
        ocrProvider = new MockOcrAdapter();
      } else if (env.OCR_PROVIDER === 'tesseract') {
        console.log(`[Analyze API - ${scanId}] Initializing Tesseract OCR Adapter...`);
        ocrProvider = new TesseractOcrAdapter();
      } else if (env.OCR_PROVIDER === 'paddle') {
        console.log(`[Analyze API - ${scanId}] Initializing PaddleOCR Sidecar Adapter...`);
        ocrProvider = new PaddleOcrAdapter();
      } else if (env.OCR_PROVIDER === 'openrouter') {
        console.log(`[Analyze API - ${scanId}] Initializing OpenRouter OCR Adapter...`);
        ocrProvider = new OpenRouterOcrAdapter();
      } else if (env.OCR_PROVIDER === 'nvidia') {
        console.log(`[Analyze API - ${scanId}] Initializing NVIDIA API OCR Adapter...`);
        ocrProvider = new NvidiaOcrAdapter();
      } else {
        console.log(`[Analyze API - ${scanId}] Initializing GCP Vision OCR Adapter...`);
        ocrProvider = new GcpVisionAdapter();
      }
    } catch (error) {
      console.error(`[Analyze API - ${scanId}] OCR Provider Error:`, error);
      throw new OcrUnavailableError((error as Error).message);
    }
    console.log(`[Analyze API - ${scanId}] Executing OCR extraction...`);
    const ocrResult = postProcessOcrResult(await ocrProvider.extract(imagePayload));
    console.log(`[Analyze API - ${scanId}] OCR Success. Extracted ${ocrResult.rawText.length} characters with confidence ${ocrResult.confidence.toFixed(2)}.`);
    console.log(`\n=================== OCR EXTRACTED TEXT ===================\n${ocrResult.rawText}\n==========================================================\n`);
    const rawText = ocrResult.rawText;
    const { cleanText, minerals, productType, rawAdditives, rawAllergens } = await preprocessOcrText(rawText);
    const additivesPromise = extractAdditives(rawAdditives || rawText);
    const declaredAllergens = extractAllergenBlock(rawAllergens || rawText);
    state = 'OCR_DONE';

    if (!isLikelyProductLabel({ rawText, cleanText, productType, minerals, rawAdditives, rawAllergens })) {
      const processingMs = Date.now() - startTime;
      const envelope: ApiEnvelope<AnalyzeResponseData> = {
        status: 'error',
        data: null,
        code: 'INVALID_PRODUCT_LABEL',
        message: 'La imagen no parece una etiqueta de producto. Intenta escanear la lista de ingredientes o la etiqueta del envase.'
      };

      res.status(422).json(envelope);

      void ApiLog.create({
        endpoint: '/api/v1/ingredients/analyze',
        method: 'POST',
        userId,
        statusCode: 422,
        responseCode: envelope.code,
        latencyMs: processingMs,
        requestSize: imagePayload.length,
        state: 'OCR_DONE'
      }).catch(err => console.error('[DB Save Error] ApiLog:', err));

      return;
    }

    console.log(`[Analyze API - ${scanId}] Sending text to FACILE NLP adapter...`);

    state = 'ADAPT_EXEC';
    const facileOrchestrator = new FacileParallelOrchestrator();
    let facileResult;
    const expandedText = expandCognitiveAccessibility(cleanText);

    try {
      facileResult = await facileOrchestrator.adapt(expandedText);
      console.log(`[Analyze API - ${scanId}] FACILE Success. Status: ${facileResult.status}. Found ${facileResult.violations.length} violations.`);
      state = 'ADAPTED';
    } catch (error) {
      console.warn(`[Analyze API - ${scanId}] FACILE Failed or Timed Out. Falling back to un-adapted text.`, (error as Error).message);
      // Graceful degradation for any FACILE error (503, timeout, etc.)
      const [parsedData, additives] = await Promise.all([
        parseIngredientText(cleanText),
        additivesPromise
      ]);
      const textAllergens = detectAllergens(cleanText);
      const parsedAllergens = detectAllergensFromIngredients(parsedData.ingredients);
      const allAllergens = mergeUniqueAllergens(declaredAllergens, textAllergens, parsedAllergens);
      const processingMs = Date.now() - startTime;
      const graphicalElements = parsedData.graphicalElements;

      const responseData = await assemble({
        scanId,
        originalText: rawText,
        adaptedText: expandedText,
        productType,
        minerals,
        additives,
        allergens: allAllergens,
        graphicalElements,
        complexTermMappings: parsedData.complexTermMappings,
        processingMs,
        degraded: true
      }) as AnalyzeResponseWithProductType;

      const envelope: ApiEnvelope<AnalyzeResponseData> = {
        status: 'partial',
        data: responseData,
        code: 'UPM_DEGRADED',
        message: 'FACILE service error: returning un-adapted text'
      };

      res.status(207).json(envelope);

      const scanDocument: ScanDocument = {
        userId,
        deviceOS,
        productType,
        originalText: rawText,
        adaptedText: expandedText,
        minerals,
        additives,
        allergens: allAllergens,
        graphicalElements,
        complexTermMappings: parsedData.complexTermMappings,
        processingMs,
        facileStatus: 'failed'
      };

      void scanRepository.create(scanDocument).catch(err => {
        console.error('[DB Save Error] UserScan:', err);
      });

      void ApiLog.create({
        endpoint: '/api/v1/ingredients/analyze',
        method: 'POST',
        userId,
        statusCode: 207,
        responseCode: envelope.code,
        latencyMs: processingMs,
        requestSize: imagePayload.length,
        state: 'ADAPT_EXEC'
      }).catch(err => console.error('[DB Save Error] ApiLog:', err));

      return;
    }

    const [parsedData, additives] = await Promise.all([
      parseIngredientText(cleanText),
      additivesPromise
    ]);
    const textAllergens = detectAllergens(cleanText);
    const parsedAllergens = detectAllergensFromIngredients(parsedData.ingredients);
    const allAllergens = mergeUniqueAllergens(declaredAllergens, textAllergens, parsedAllergens);
    const graphicalElements = parsedData.graphicalElements;
    const allMappings = [
      ...facileResult.complexTermMappings,
      ...parsedData.complexTermMappings
    ];

    state = 'PARSED';
    const processingMs = Date.now() - startTime;
    state = 'DONE';

    console.log(`[Analyze API - ${scanId}] Processing complete in ${processingMs}ms.`);
    console.log(`[Analyze API - ${scanId}] Detected ${allAllergens.length} allergens and mapped ${allMappings.length} complex terms.`);

    const responseData = await assemble({
      scanId,
      originalText: rawText,
      adaptedText: facileResult.adaptedText,
      productType,
      minerals,
      additives,
      allergens: allAllergens,
      graphicalElements,
      complexTermMappings: allMappings,
      processingMs,
      degraded: facileResult.status !== 'full'
    }) as AnalyzeResponseWithProductType;

    const envelope: ApiEnvelope<AnalyzeResponseData> = {
      status: facileResult.status === 'full' ? 'success' : 'partial',
      data: responseData,
      code: facileResult.status === 'full' ? 'SUCCESS' : 'UPM_DEGRADED'
    };

    res.status(200).json(envelope);

    const scanDocument: ScanDocument = {
      userId,
      deviceOS,
      productType,
      originalText: rawText,
      adaptedText: facileResult.adaptedText,
      minerals,
      additives,
      allergens: allAllergens,
      graphicalElements,
      complexTermMappings: allMappings,
      processingMs,
      facileStatus: facileResult.status
    };

    void scanRepository.create(scanDocument).catch(err => {
      console.error('[DB Save Error] UserScan:', err);
    });

    void ApiLog.create({
      endpoint: '/api/v1/ingredients/analyze',
      method: 'POST',
      userId,
      statusCode: 200,
      responseCode: envelope.code,
      latencyMs: processingMs,
      requestSize: imagePayload.length,
      state: 'DONE'
    }).catch(err => console.error('[DB Save Error] ApiLog:', err));
  } catch (error) {
    if (error instanceof OcrUnavailableError) {
      console.error(`[Analyze API - ${scanId}] Returning 503 OCR_UNAVAILABLE to client.`);
      res.status(503).json({
        status: 'error',
        errorCode: 'OCR_UNAVAILABLE',
        message: 'OCR service unavailable'
      });
      return;
    }

    void ApiLog.create({
      endpoint: '/api/v1/ingredients/analyze',
      method: 'POST',
      statusCode: 500,
      responseCode: 'INTERNAL_ERROR',
      latencyMs: Date.now() - startTime,
      errorMessage: (error as Error).message,
      state
    }).catch(() => {});

    next(error as Error);
  }
}
