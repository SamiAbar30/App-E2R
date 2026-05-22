import { AdditiveEntry } from '../types';
import additiveData from '../data/eu-additives.json';

/**
 * Process-memory cached Map of EU food additives.
 * Loaded once at startup from eu-additives.json.
 * Provides O(1) constant-time lookups by normalized E-number key.
 * @trace FR-ADD-001 — Additive mapping subsystem
 */

const additiveStore: Map<string, AdditiveEntry> = new Map();

// Normalize E-number keys: lowercase, no spaces, no hyphens
function normalizeENumber(eNum: string): string {
  return eNum.toLowerCase().replace(/[\s-]/g, '');
}

// Load at module initialization (startup)
for (const entry of (additiveData as AdditiveEntry[])) {
  const key = normalizeENumber(entry.eNumber);
  additiveStore.set(key, entry);
}

export function lookupAdditive(eNumber: string): AdditiveEntry | undefined {
  return additiveStore.get(normalizeENumber(eNumber));
}

export function getAllAdditives(): AdditiveEntry[] {
  return Array.from(additiveStore.values());
}

export function getAdditiveCount(): number {
  return additiveStore.size;
}

export { additiveStore };
