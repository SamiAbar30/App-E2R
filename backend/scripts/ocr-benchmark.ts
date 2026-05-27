import fs from 'node:fs/promises';
import path from 'node:path';
import { TesseractOcrAdapter } from '../src/services/tesseractOcrAdapter.service';

interface BenchmarkCase {
  id: string;
  imagePath: string;
  groundTruth: string;
}

interface BenchmarkSummary {
  cases: number;
  averageCer: number;
  averageWer: number;
  p50LatencyMs: number;
  p90LatencyMs: number;
}

function normalizeForMetric(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

function levenshtein(a: string[], b: string[]): number {
  const dp = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));

  for (let i = 0; i <= a.length; i += 1) dp[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) dp[0][j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const substitutionCost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + substitutionCost
      );
    }
  }

  return dp[a.length][b.length];
}

function characterErrorRate(expected: string, actual: string): number {
  const expectedChars = Array.from(normalizeForMetric(expected));
  const actualChars = Array.from(normalizeForMetric(actual));
  if (expectedChars.length === 0) return actualChars.length === 0 ? 0 : 1;
  return levenshtein(expectedChars, actualChars) / expectedChars.length;
}

function wordErrorRate(expected: string, actual: string): number {
  const expectedWords = normalizeForMetric(expected).split(' ').filter(Boolean);
  const actualWords = normalizeForMetric(actual).split(' ').filter(Boolean);
  if (expectedWords.length === 0) return actualWords.length === 0 ? 0 : 1;
  return levenshtein(expectedWords, actualWords) / expectedWords.length;
}

function percentile(values: number[], percentileValue: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((percentileValue / 100) * sorted.length) - 1);
  return sorted[index];
}

async function loadCases(datasetPath: string): Promise<BenchmarkCase[]> {
  const raw = await fs.readFile(datasetPath, 'utf8');
  const parsed = JSON.parse(raw) as BenchmarkCase[];

  if (!Array.isArray(parsed)) {
    throw new Error('Benchmark dataset must be a JSON array.');
  }

  return parsed;
}

async function main(): Promise<void> {
  const datasetPath = process.argv[2];
  if (!datasetPath) {
    console.log('Usage: pnpm benchmark:ocr -- <dataset.json>');
    console.log('Dataset shape: [{"id":"label-1","imagePath":"fixtures/label.jpg","groundTruth":"Ingredients: ..."}]');
    return;
  }

  const absoluteDatasetPath = path.resolve(datasetPath);
  const datasetDir = path.dirname(absoluteDatasetPath);
  const cases = await loadCases(absoluteDatasetPath);
  const adapter = new TesseractOcrAdapter();
  const latencies: number[] = [];
  const cerValues: number[] = [];
  const werValues: number[] = [];

  for (const testCase of cases) {
    const absoluteImagePath = path.resolve(datasetDir, testCase.imagePath);
    const image = await fs.readFile(absoluteImagePath);
    const started = Date.now();
    const result = await adapter.extract(image.toString('base64'));
    const latencyMs = Date.now() - started;
    const cer = characterErrorRate(testCase.groundTruth, result.rawText);
    const wer = wordErrorRate(testCase.groundTruth, result.rawText);

    latencies.push(latencyMs);
    cerValues.push(cer);
    werValues.push(wer);

    console.log(JSON.stringify({
      id: testCase.id,
      cer,
      wer,
      latencyMs,
      confidence: result.confidence,
      extractedChars: result.rawText.length
    }));
  }

  const summary: BenchmarkSummary = {
    cases: cases.length,
    averageCer: cerValues.reduce((sum, value) => sum + value, 0) / Math.max(cerValues.length, 1),
    averageWer: werValues.reduce((sum, value) => sum + value, 0) / Math.max(werValues.length, 1),
    p50LatencyMs: percentile(latencies, 50),
    p90LatencyMs: percentile(latencies, 90)
  };

  console.log(JSON.stringify({ summary }, null, 2));
  await TesseractOcrAdapter.shutdownWorkerPool();
}

main().catch(async (error) => {
  await TesseractOcrAdapter.shutdownWorkerPool();
  console.error(error);
  process.exitCode = 1;
});
