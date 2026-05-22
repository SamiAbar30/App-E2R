// ── nlpPruningEngine.ts ────────────────────────────────────────────────────
// Difficulty Slider — prunes parsed ingredient payloads before FACILE API call
// based on user preference: VERY_SIMPLE | SIMPLE | NORMAL
//
// Part of the Node.js/Express orchestration backend (TFM — UPM MUSS)
// ────────────────────────────────────────────────────────────────────────────

// ═══════════════════════════════════════════════════════════════════════════
// TYPES (strict — no implicit `any`)
// ═══════════════════════════════════════════════════════════════════════════

/** Raw ingredient entry produced by the OCR + parser layer */
export interface ParsedIngredient {
  /** Display name of the ingredient (e.g. "Citric Acid", "E-330") */
  name: string;
  /** Detected quantity value, if any (e.g. 12, 0.02) */
  quantity?: number;
  /** Unit of the quantity (e.g. "g/100g", "%", "mg") */
  unit?: string;
  /** E-number code if this is a known additive (e.g. "E330") */
  eNumber?: string;
  /** Functional category from the additive dictionary */
  category?:
    | 'preservative'
    | 'stabilizer'
    | 'emulsifier'
    | 'antioxidant'
    | 'colorant'
    | 'flavor_enhancer'
    | 'sweetener'
    | 'thickener'
    | 'acidity_regulator'
    | 'other';
  /** Whether this ingredient is a known allergen */
  isAllergen: boolean;
  /** Allergen type if applicable */
  allergenType?:
    | 'gluten'
    | 'nuts'
    | 'milk'
    | 'egg'
    | 'soy'
    | 'fish'
    | 'shellfish'
    | 'sesame'
    | 'sulfites';
  /** Original position in the ingredient list (preserved for ordering) */
  index: number;
}

/** User-facing difficulty levels */
export type DifficultyLevel = 'VERY_SIMPLE' | 'SIMPLE' | 'NORMAL';

/** Input payload to the pruning engine */
export interface PruningInput {
  /** Parsed ingredients from OCR + parser layer */
  ingredients: ParsedIngredient[];
  /** User-selected difficulty */
  difficultyLevel: DifficultyLevel;
}

/** Allergen warning entry for VERY_SIMPLE mode */
export interface AllergenWarning {
  /** Human-readable allergen name */
  name: string;
  /** Allergen type code */
  type: NonNullable<ParsedIngredient['allergenType']>;
}

/** Output payload returned by the pruning engine */
export interface PruningOutput {
  /** Pruned ingredient list ready for FACILE API */
  ingredients: ParsedIngredient[];
  /** Applied difficulty level (echoed back) */
  appliedLevel: DifficultyLevel;
  /** Number of ingredients before pruning */
  originalCount: number;
  /** Number of ingredients after pruning */
  prunedCount: number;
  /** IDs of pruned ingredients (for audit trail) */
  removedIndices: number[];
  /** Binary allergen summary (populated only in VERY_SIMPLE) */
  allergenWarnings?: AllergenWarning[];
  /** Human-readable summary for VERY_SIMPLE mode */
  summary?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Categories considered "non-essential chemical additives" for SIMPLE pruning.
 * These are stripped in SIMPLE mode, leaving main ingredients + primary allergens.
 */
const NON_ESSENTIAL_CATEGORIES: ReadonlySet<ParsedIngredient['category']> =
  new Set([
    'preservative',
    'stabilizer',
    'emulsifier',
    'antioxidant',
    'colorant',
    'flavor_enhancer',
    'thickener',
    'acidity_regulator',
  ]);

/** Maximum number of ingredients retained in VERY_SIMPLE mode */
const VERY_SIMPLE_MAX_INGREDIENTS = 3;

// ═══════════════════════════════════════════════════════════════════════════
// GUARDS (runtime type checking)
// ═══════════════════════════════════════════════════════════════════════════

const VALID_DIFFICULTY_LEVELS: ReadonlySet<string> = new Set([
  'VERY_SIMPLE',
  'SIMPLE',
  'NORMAL',
]);

function isDifficultyLevel(value: unknown): value is DifficultyLevel {
  return typeof value === 'string' && VALID_DIFFICULTY_LEVELS.has(value);
}

function isParsedIngredient(value: unknown): value is ParsedIngredient {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.name === 'string' &&
    typeof obj.isAllergen === 'boolean' &&
    typeof obj.index === 'number'
  );
}

function isParsedIngredientArray(value: unknown): value is ParsedIngredient[] {
  return Array.isArray(value) && value.every(isParsedIngredient);
}

// ═══════════════════════════════════════════════════════════════════════════
// PRUNING STRATEGIES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * NORMAL mode — pass-through.
 * All ingredients are forwarded to FACILE without modification.
 */
function pruneNormal(ingredients: ParsedIngredient[]): {
  kept: ParsedIngredient[];
  removedIndices: number[];
} {
  return {
    kept: [...ingredients],
    removedIndices: [],
  };
}

/**
 * SIMPLE mode — filter out non-essential chemical additives.
 *
 * Retention rules:
 * - KEEP: main ingredients (no category or category='other'/'sweetener')
 * - KEEP: known allergens (regardless of category)
 * - REMOVE: preservatives, stabilizers, emulsifiers, antioxidants,
 *   colorants, flavor enhancers, thickeners, acidity regulators
 *   (unless they are also allergens)
 */
function pruneSimple(ingredients: ParsedIngredient[]): {
  kept: ParsedIngredient[];
  removedIndices: number[];
} {
  const kept: ParsedIngredient[] = [];
  const removedIndices: number[] = [];

  for (const ingredient of ingredients) {
    // Always keep allergens — they are safety-critical
    if (ingredient.isAllergen) {
      kept.push(ingredient);
      continue;
    }

    // Remove non-essential chemical categories
    if (
      ingredient.category &&
      NON_ESSENTIAL_CATEGORIES.has(ingredient.category)
    ) {
      removedIndices.push(ingredient.index);
      continue;
    }

    // Keep everything else (main ingredients, sweeteners, uncategorized)
    kept.push(ingredient);
  }

  return { kept, removedIndices };
}

/**
 * VERY_SIMPLE mode — aggressive pruning.
 *
 * Algorithm:
 * 1. Separate allergens from non-allergens
 * 2. Sort non-allergens by quantity descending (higher quantity = more dominant)
 * 3. Take top N non-allergen ingredients (up to VERY_SIMPLE_MAX_INGREDIENTS)
 * 4. Build binary allergen warning array from all detected allergens
 * 5. Generate a human-readable summary string
 */
function pruneVerySimple(ingredients: ParsedIngredient[]): {
  kept: ParsedIngredient[];
  removedIndices: number[];
  allergenWarnings: AllergenWarning[];
  summary: string;
} {
  const allergens = ingredients.filter((i) => i.isAllergen);
  const nonAllergens = ingredients.filter((i) => !i.isAllergen);

  // Sort non-allergens by quantity descending (undefined quantities go last)
  const sortedNonAllergens = [...nonAllergens].sort((a, b) => {
    const qA = a.quantity ?? -1;
    const qB = b.quantity ?? -1;
    return qB - qA;
  });

  // Take top N dominant ingredients
  const topIngredients = sortedNonAllergens.slice(0, VERY_SIMPLE_MAX_INGREDIENTS);

  // Build allergen warnings (deduplicated by type)
  const seenTypes = new Set<string>();
  const allergenWarnings: AllergenWarning[] = [];

  for (const allergen of allergens) {
    if (allergen.allergenType && !seenTypes.has(allergen.allergenType)) {
      seenTypes.add(allergen.allergenType);
      allergenWarnings.push({
        name: allergen.name,
        type: allergen.allergenType,
      });
    }
  }

  // Merge kept ingredients (top ingredients first, then allergens)
  const kept = [...topIngredients, ...allergens];

  // Collect removed indices
  const keptIndices = new Set(kept.map((i) => i.index));
  const removedIndices = ingredients
    .filter((i) => !keptIndices.has(i.index))
    .map((i) => i.index);

  // Generate summary
  const topNames = topIngredients.map((i) => i.name).join(', ');
  const hasAllergens = allergenWarnings.length > 0;
  const allergenNames = allergenWarnings.map((w) => w.name).join(', ');

  const summary = hasAllergens
    ? `Contiene principalmente: ${topNames}. Alérgenos: ${allergenNames}.`
    : `Contiene principalmente: ${topNames}. Sin alérgenos detectados.`;

  return { kept, removedIndices, allergenWarnings, summary };
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN ENGINE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Prunes a parsed ingredient list based on the user's difficulty preference.
 *
 * Mechanics:
 * - **NORMAL**:  Pass-through — all ingredients forwarded to FACILE.
 * - **SIMPLE**:  Filters out non-essential chemical preservatives & stabilizers,
 *                retaining main ingredients and primary allergens.
 * - **VERY_SIMPLE**: Aggressively prunes to top 3 dominant ingredients
 *                    + binary allergen warning array + summary string.
 *
 * @param input — Raw parsed ingredients and difficulty level
 * @returns Pruned payload ready for the Express response stream
 * @throws {TypeError} If input fails runtime type validation
 *
 * @example
 * ```ts
 * const result = pruneIngredients({
 *   ingredients: [
 *     { name: 'Harina de trigo', isAllergen: true, allergenType: 'gluten', index: 0 },
 *     { name: 'E-330', category: 'acidity_regulator', isAllergen: false, index: 1 },
 *   ],
 *   difficultyLevel: 'SIMPLE',
 * });
 * ```
 */
export function pruneIngredients(input: PruningInput): PruningOutput {
  // ── Runtime type validation ────────────────────────────────────────────
  if (typeof input !== 'object' || input === null) {
    throw new TypeError(
      'nlpPruningEngine: input must be a non-null object'
    );
  }

  if (!isDifficultyLevel(input.difficultyLevel)) {
    throw new TypeError(
      `nlpPruningEngine: invalid difficultyLevel "${String(
        input.difficultyLevel
      )}". Expected VERY_SIMPLE | SIMPLE | NORMAL.`
    );
  }

  if (!isParsedIngredientArray(input.ingredients)) {
    throw new TypeError(
      'nlpPruningEngine: ingredients must be an array of ParsedIngredient objects.'
    );
  }

  // ── Dispatch by difficulty ─────────────────────────────────────────────
  const { difficultyLevel, ingredients } = input;
  const originalCount = ingredients.length;

  let kept: ParsedIngredient[];
  let removedIndices: number[];
  let allergenWarnings: AllergenWarning[] | undefined;
  let summary: string | undefined;

  switch (difficultyLevel) {
    case 'NORMAL': {
      const result = pruneNormal(ingredients);
      kept = result.kept;
      removedIndices = result.removedIndices;
      break;
    }

    case 'SIMPLE': {
      const result = pruneSimple(ingredients);
      kept = result.kept;
      removedIndices = result.removedIndices;
      break;
    }

    case 'VERY_SIMPLE': {
      const result = pruneVerySimple(ingredients);
      kept = result.kept;
      removedIndices = result.removedIndices;
      allergenWarnings = result.allergenWarnings;
      summary = result.summary;
      break;
    }

    /* v8 ignore next 2 — exhaustive check; unreachable due to guard above */
    default:
      throw new Error(`Unreachable: ${difficultyLevel}`);
  }

  // ── Build output ───────────────────────────────────────────────────────
  const output: PruningOutput = {
    ingredients: kept,
    appliedLevel: difficultyLevel,
    originalCount,
    prunedCount: kept.length,
    removedIndices,
  };

  if (allergenWarnings !== undefined) {
    output.allergenWarnings = allergenWarnings;
  }

  if (summary !== undefined) {
    output.summary = summary;
  }

  return output;
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPRESS CONTROLLER HELPER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Convenience wrapper that calls `pruneIngredients` and formats the result
 * into the standard API response envelope used by all Express controllers.
 *
 * Usage in a route handler:
 * ```ts
 * app.post('/api/v1/ingredients/prune', (req, res) => {
 *   const result = pruneAndRespond(req.body);
 *   res.status(result.code).json(result);
 * });
 * ```
 */
export interface ApiEnvelope<T> {
  status: 'ok' | 'error';
  data: T | null;
  code: number;
  message?: string;
}

export function pruneAndRespond(
  body: unknown
): ApiEnvelope<PruningOutput> {
  try {
    if (typeof body !== 'object' || body === null) {
      return {
        status: 'error',
        data: null,
        code: 400,
        message: 'Request body must be a JSON object.',
      };
    }

    const { ingredients, difficultyLevel } = body as Record<string, unknown>;

    if (!isParsedIngredientArray(ingredients)) {
      return {
        status: 'error',
        data: null,
        code: 400,
        message:
          'Invalid or missing "ingredients" field. Expected an array of ParsedIngredient objects.',
      };
    }

    if (!isDifficultyLevel(difficultyLevel)) {
      return {
        status: 'error',
        data: null,
        code: 400,
        message:
          'Invalid or missing "difficultyLevel" field. Expected VERY_SIMPLE | SIMPLE | NORMAL.',
      };
    }

    const result = pruneIngredients({
      ingredients,
      difficultyLevel,
    });

    return {
      status: 'ok',
      data: result,
      code: 200,
    };
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Internal pruning error.';
    return {
      status: 'error',
      data: null,
      code: 500,
      message,
    };
  }
}