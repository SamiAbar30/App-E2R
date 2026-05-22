// ── useAccessibilityEngine.ts ───────────────────────────────────────────────
// Memoized selector hooks for the Accessibility Engine
//
// Each hook subscribes to a narrow slice of the context, preventing
// unnecessary re-renders when unrelated fields change. Components should
// import from this file rather than calling useAccessibilityEngineContext
// directly.
//
// TFM — UPM MUSS | React Native 0.81 + Expo 54
// ────────────────────────────────────────────────────────────────────────────

import { useMemo } from 'react';
import {
  useAccessibilityEngineContext,
  type AccessibilityEngine,
  type SystemAccessibilityFlags,
  type AccessibilityOverrides,
  type ContrastPalette,
  type FontPolicy,
  type ContrastMode,
  type TextAlignment,
  type DisabilityPreset,
} from '../context/AccessibilityEngineContext';

// Re-export types for convenience
export type {
  SystemAccessibilityFlags,
  AccessibilityOverrides,
  ContrastPalette,
  FontPolicy,
  ContrastMode,
  TextAlignment,
  DisabilityPreset,
  AccessibilityEngine,
};

// ═══════════════════════════════════════════════════════════════════════════
// FULL ENGINE (use sparingly — prefer narrow selectors below)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Returns the full accessibility engine context.
 *
 * ⚠️ This hook will trigger a re-render on ANY change to the engine.
 * Prefer the narrow selector hooks below for component-level consumption.
 */
export function useAccessibilityEngine(): AccessibilityEngine {
  return useAccessibilityEngineContext();
}

// ═══════════════════════════════════════════════════════════════════════════
// NARROW SELECTORS (memoized — minimal re-render surface)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Returns only the effective font scale (system × override, clamped).
 * Use in any component that renders text.
 */
export function useEffectiveFontScale(): number {
  const { effectiveFontScale } = useAccessibilityEngineContext();
  return useMemo(() => effectiveFontScale, [effectiveFontScale]);
}

/**
 * Returns the active contrast palette (text, background, accent, etc.).
 * Use in any component that renders styled views or text.
 */
export function useContrastPalette(): ContrastPalette {
  const { palette } = useAccessibilityEngineContext();
  return useMemo(() => palette, [palette]);
}

/**
 * Returns the effective font family string for the current font policy.
 */
export function useFontFamily(): string {
  const { fontFamily } = useAccessibilityEngineContext();
  return useMemo(() => fontFamily, [fontFamily]);
}

/**
 * Returns whether Reduce Motion is active.
 * Use to conditionally disable animations.
 */
export function useReduceMotion(): boolean {
  const { reduceMotion } = useAccessibilityEngineContext();
  return useMemo(() => reduceMotion, [reduceMotion]);
}

/**
 * Returns the minimum touch target size in dp.
 * Use for interactive elements (buttons, links, etc.).
 */
export function useMinTouchSize(): number {
  const { minTouchSize } = useAccessibilityEngineContext();
  return useMemo(() => minTouchSize, [minTouchSize]);
}

/**
 * Returns live system accessibility flags from the OS.
 */
export function useSystemFlags(): SystemAccessibilityFlags {
  const { system } = useAccessibilityEngineContext();
  return useMemo(() => system, [system]);
}

/**
 * Returns the current in-app overrides object.
 */
export function useAccessibilityOverrides(): AccessibilityOverrides {
  const { overrides } = useAccessibilityEngineContext();
  return useMemo(() => overrides, [overrides]);
}

// ═══════════════════════════════════════════════════════════════════════════
// ACTION SELECTORS (stable references — safe for useEffect deps)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Returns the updateOverrides action (stable reference).
 * Call with a partial overrides object to merge into persisted state.
 *
 * @example
 * const update = useUpdateOverrides();
 * update({ fontSizeMultiplier: 1.5 });
 */
export function useUpdateOverrides(): (patch: Partial<AccessibilityOverrides>) => void {
  const { updateOverrides } = useAccessibilityEngineContext();
  return updateOverrides;
}

/**
 * Returns the applyDisabilityPreset action (stable reference).
 * Call with a preset name to apply a one-tap configuration.
 *
 * @example
 * const applyPreset = useApplyDisabilityPreset();
 * applyPreset('Cognitive');
 */
export function useApplyDisabilityPreset(): (preset: DisabilityPreset) => void {
  const { applyDisabilityPreset } = useAccessibilityEngineContext();
  return applyDisabilityPreset;
}

/**
 * Returns the resetOverrides action (stable reference).
 * Resets all overrides to factory defaults.
 */
export function useResetOverrides(): () => void {
  const { resetOverrides } = useAccessibilityEngineContext();
  return resetOverrides;
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPOSITE SELECTORS (combine multiple fields into a single hook)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Returns everything a text-rendering component needs:
 * font scale, font family, palette, alignment, and chunked reading flag.
 */
export function useTextAccessibility() {
  const {
    effectiveFontScale,
    fontFamily,
    palette,
    overrides: { textAlignment, chunkedReading },
  } = useAccessibilityEngineContext();

  return useMemo(
    () => ({
      fontScale: effectiveFontScale,
      fontFamily,
      textColor: palette.text,
      backgroundColor: palette.background,
      textAlignment,
      chunkedReading,
    }),
    [effectiveFontScale, fontFamily, palette, textAlignment, chunkedReading],
  );
}

/**
 * Returns everything an interactive element needs:
 * minimum touch size, palette accent/link, reduce motion flag, debounce margin.
 */
export function useInteractionAccessibility() {
  const {
    minTouchSize,
    palette,
    reduceMotion,
    overrides: { debounceMargin },
  } = useAccessibilityEngineContext();

  return useMemo(
    () => ({
      minTouchSize,
      accentColor: palette.accent,
      linkColor: palette.link,
      reduceMotion,
      debounceMargin,
    }),
    [minTouchSize, palette, reduceMotion, debounceMargin],
  );
}

/**
 * Returns a flag indicating whether the screen reader is active.
 * Convenience hook — equivalent to useSystemFlags().isScreenReaderEnabled.
 */
export function useIsScreenReaderEnabled(): boolean {
  const { system } = useAccessibilityEngineContext();
  return useMemo(() => system.isScreenReaderEnabled, [system.isScreenReaderEnabled]);
}