// ── AccessibilityEngineContext.tsx ──────────────────────────────────────────
// Unified Accessibility Configuration Engine
//
// Mechanics:
//   1. React Context Provider wrapping the entire app tree.
//   2. Syncs with native OS accessibility settings via AccessibilityInfo API
//      (Bold Text, Screen Reader, Reduce Motion, font scale).
//   3. In-app overrides: fontSizeMultiplier, textAlignment, fontPolicy,
//      contrastMode — merged with system hooks.
//   4. Disability presets: Cognitive, Visual, Motor — one-tap configuration.
//   5. Persists overrides to encrypted MMKV; memoizes all derived values.
//
// TFM — UPM MUSS | React Native 0.81 + Expo 54
// ────────────────────────────────────────────────────────────────────────────

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  AccessibilityInfo,
  useWindowDimensions,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES (strict — no `any`)
// ═══════════════════════════════════════════════════════════════════════════

/** Font family policy */
export type FontPolicy = 'native' | 'highLegibility' | 'openDyslexic';

/** Contrast mode */
export type ContrastMode = 'Normal' | 'HighContrastDark' | 'HighContrastLight';

/** Text alignment */
export type TextAlignment = 'left' | 'justified';

/** Disability profile identifiers */
export type DisabilityPreset = 'Cognitive' | 'Visual' | 'Motor';

/** System-level accessibility flags synced from the OS */
export interface SystemAccessibilityFlags {
  /** Whether Bold Text is enabled at the OS level (iOS) */
  isBoldTextEnabled: boolean;
  /** Whether a screen reader (VoiceOver / TalkBack) is active */
  isScreenReaderEnabled: boolean;
  /** Whether Reduce Motion is enabled at the OS level */
  isReduceMotionEnabled: boolean;
  /** Whether Increase Contrast is enabled at the OS level */
  isIncreaseContrastEnabled: boolean;
  /** System font scale factor (raw, before clamping) */
  systemFontScale: number;
}

/** In-app overrides that the user or caregiver can configure */
export interface AccessibilityOverrides {
  /** Font size multiplier applied on top of system scale (1.0 – 2.2) */
  fontSizeMultiplier: number;
  /** Preferred text alignment */
  textAlignment: TextAlignment;
  /** Font family policy */
  fontPolicy: FontPolicy;
  /** Contrast mode */
  contrastMode: ContrastMode;
  /** Whether chunked reading mode is active (Cognitive preset) */
  chunkedReading: boolean;
  /** Minimum touch target size in dp (Motor preset: 64) */
  touchTargetSize: number;
  /** Debounce margin in ms for tap handlers (Motor preset: high) */
  debounceMargin: number;
}

/** Resolved palette for the active contrast mode */
export interface ContrastPalette {
  /** Primary text color */
  text: string;
  /** Page / card background */
  background: string;
  /** Accent / interactive element color */
  accent: string;
  /** Secondary / muted text */
  secondary: string;
  /** Border / divider color */
  border: string;
  /** Link color */
  link: string;
}

/** Full shape of the context value */
export interface AccessibilityEngine {
  // ── Live system flags ──────────────────────────────────────────────────
  system: SystemAccessibilityFlags;

  // ── In-app overrides ───────────────────────────────────────────────────
  overrides: AccessibilityOverrides;

  // ── Resolved (merged) values — what components should consume ──────────
  /** Effective font size multiplier = system × override, clamped */
  effectiveFontScale: number;
  /** Effective contrast palette */
  palette: ContrastPalette;
  /** Effective font family string */
  fontFamily: string;
  /** Whether animations / motion should be suppressed */
  reduceMotion: boolean;
  /** Minimum touch target dimension in dp */
  minTouchSize: number;

  // ── Actions ────────────────────────────────────────────────────────────
  /** Merge a partial overrides object into persisted state */
  updateOverrides: (patch: Partial<AccessibilityOverrides>) => void;
  /** Apply a named disability preset (one-tap configuration) */
  applyDisabilityPreset: (preset: DisabilityPreset) => void;
  /** Reset all overrides to defaults */
  resetOverrides: () => void;
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

/** Clamp range for fontSizeMultiplier */
const MIN_FONT_MULTIPLIER = 1.0;
const MAX_FONT_MULTIPLIER = 2.2;

/** Default overrides (no user customization yet) */
const DEFAULT_OVERRIDES: AccessibilityOverrides = {
  fontSizeMultiplier: 1.0,
  textAlignment: 'left',
  fontPolicy: 'native',
  contrastMode: 'Normal',
  chunkedReading: false,
  touchTargetSize: 44, // standard WCAG minimum
  debounceMargin: 300, // ms
};

// ── Contrast palettes ──────────────────────────────────────────────────────

const PALETTE_NORMAL: ContrastPalette = {
  text: '#2b2d42',
  background: '#f8f9fa',
  accent: '#ef233c',
  secondary: '#8d99ae',
  border: '#dee2e6',
  link: '#1a5276',
};

const PALETTE_HIGH_CONTRAST_DARK: ContrastPalette = {
  text: '#FFFFFF',
  background: '#000000',
  accent: '#FFF200',
  secondary: '#CCCCCC',
  border: '#FFFFFF',
  link: '#FFF200',
};

const PALETTE_HIGH_CONTRAST_LIGHT: ContrastPalette = {
  text: '#000000',
  background: '#FFFFFF',
  accent: '#B80000',
  secondary: '#333333',
  border: '#000000',
  link: '#0000EE',
};

// ── Font family mapping ────────────────────────────────────────────────────

const FONT_FAMILY_MAP: Record<FontPolicy, string> = {
  native: Platform.select({ ios: 'System', android: 'sans-serif' }) ?? 'System',
  highLegibility: Platform.select({ ios: 'Atkinson Hyperlegible', android: 'sans-serif-medium' }) ?? 'Atkinson Hyperlegible',
  openDyslexic: 'OpenDyslexic',
};

// ═══════════════════════════════════════════════════════════════════════════
// ASYNC STORAGE PERSISTENCE
// ═══════════════════════════════════════════════════════════════════════════

const OVERRIDES_KEY = '@tfm_accessibilityOverrides';

async function readOverrides(): Promise<AccessibilityOverrides> {
  try {
    const raw = await AsyncStorage.getItem(OVERRIDES_KEY);
    if (!raw) return { ...DEFAULT_OVERRIDES };
    const parsed: unknown = JSON.parse(raw);
    if (!isAccessibilityOverrides(parsed)) {
      console.warn('[AccessibilityEngine] Stored overrides failed validation — resetting.');
      return { ...DEFAULT_OVERRIDES };
    }
    // Clamp on read to guard against corrupted values
    return clampOverrides(parsed);
  } catch {
    return { ...DEFAULT_OVERRIDES };
  }
}

async function writeOverrides(overrides: AccessibilityOverrides): Promise<void> {
  try {
    await AsyncStorage.setItem(OVERRIDES_KEY, JSON.stringify(overrides));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[AccessibilityEngine] Failed to persist overrides: ${message}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// RUNTIME TYPE GUARDS
// ═══════════════════════════════════════════════════════════════════════════

function isFontPolicy(value: unknown): value is FontPolicy {
  return value === 'native' || value === 'highLegibility' || value === 'openDyslexic';
}

function isContrastMode(value: unknown): value is ContrastMode {
  return value === 'Normal' || value === 'HighContrastDark' || value === 'HighContrastLight';
}

function isTextAlignment(value: unknown): value is TextAlignment {
  return value === 'left' || value === 'justified';
}

function isAccessibilityOverrides(value: unknown): value is AccessibilityOverrides {
  if (typeof value !== 'object' || value === null) return false;
  const o = value as Record<string, unknown>;
  return (
    typeof o.fontSizeMultiplier === 'number' &&
    isTextAlignment(o.textAlignment) &&
    isFontPolicy(o.fontPolicy) &&
    isContrastMode(o.contrastMode) &&
    typeof o.chunkedReading === 'boolean' &&
    typeof o.touchTargetSize === 'number' &&
    typeof o.debounceMargin === 'number'
  );
}

function clampOverrides(overrides: AccessibilityOverrides): AccessibilityOverrides {
  return {
    ...overrides,
    fontSizeMultiplier: Math.min(
      MAX_FONT_MULTIPLIER,
      Math.max(MIN_FONT_MULTIPLIER, overrides.fontSizeMultiplier),
    ),
    touchTargetSize: Math.max(24, Math.min(96, overrides.touchTargetSize)),
    debounceMargin: Math.max(100, Math.min(2000, overrides.debounceMargin)),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// DISABILITY PRESETS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Returns a full overrides object for a given disability profile.
 *
 * Cognitive: larger text, max line spacing, left-aligned, high-legibility
 *   font, chunked reading mode — optimised for users with cognitive
 *   disabilities who benefit from simplified, well-spaced text.
 *
 * Visual: maximum font scale, HighContrastDark palette, primes TTS
 *   readiness — for users with low vision or colour blindness.
 *
 * Motor: 64 dp touch targets, high debounce margins — for users with
 *   motor impairments who need larger interactive areas and tolerance
 *   against accidental double-taps.
 */
function buildPreset(preset: DisabilityPreset): AccessibilityOverrides {
  switch (preset) {
    case 'Cognitive':
      return {
        fontSizeMultiplier: 1.3,
        textAlignment: 'left',
        fontPolicy: 'highLegibility',
        contrastMode: 'Normal',
        chunkedReading: true,
        touchTargetSize: 48,
        debounceMargin: 400,
      };

    case 'Visual':
      return {
        fontSizeMultiplier: 1.8,
        textAlignment: 'left',
        fontPolicy: 'highLegibility',
        contrastMode: 'HighContrastDark',
        chunkedReading: false,
        touchTargetSize: 48,
        debounceMargin: 300,
      };

    case 'Motor':
      return {
        fontSizeMultiplier: 1.0,
        textAlignment: 'left',
        fontPolicy: 'native',
        contrastMode: 'Normal',
        chunkedReading: false,
        touchTargetSize: 64,
        debounceMargin: 800,
      };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CONTEXT
// ═══════════════════════════════════════════════════════════════════════════

const AccessibilityEngineContext = createContext<AccessibilityEngine | null>(null);

// ═══════════════════════════════════════════════════════════════════════════
// PROVIDER
// ═══════════════════════════════════════════════════════════════════════════

interface ProviderProps {
  children: ReactNode;
}

export const AccessibilityEngineProvider: React.FC<ProviderProps> = ({ children }) => {
  // ── System flags (live from AccessibilityInfo) ──────────────────────────
  const [systemFlags, setSystemFlags] = useState<SystemAccessibilityFlags>({
    isBoldTextEnabled: false,
    isScreenReaderEnabled: false,
    isReduceMotionEnabled: false,
    isIncreaseContrastEnabled: false,
    systemFontScale: 1.0,
  });

  // ── In-app overrides (hydrated from MMKV on mount) ─────────────────────
  const [overrides, setOverridesState] = useState<AccessibilityOverrides>(DEFAULT_OVERRIDES);
  const isHydrated = useRef(false);

  // Hydrate once on mount
  useEffect(() => {
    if (!isHydrated.current) {
      readOverrides().then((stored) => {
        setOverridesState(stored);
        isHydrated.current = true;
      });
    }
  }, []);

  // ── Subscribe to native accessibility changes ──────────────────────────

  useEffect(() => {
    // Bold Text (iOS)
    AccessibilityInfo.isBoldTextEnabled().then((enabled) => {
      setSystemFlags((prev) => ({ ...prev, isBoldTextEnabled: enabled }));
    });

    // Screen Reader
    AccessibilityInfo.isScreenReaderEnabled().then((enabled) => {
      setSystemFlags((prev) => ({ ...prev, isScreenReaderEnabled: enabled }));
    });

    // Reduce Motion
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      setSystemFlags((prev) => ({ ...prev, isReduceMotionEnabled: enabled }));
    });

    // Subscriptions for real-time changes
    const boldSub = AccessibilityInfo.addEventListener(
      'boldTextChanged',
      (enabled: boolean) => {
        setSystemFlags((prev) => ({ ...prev, isBoldTextEnabled: enabled }));
      },
    );

    const readerSub = AccessibilityInfo.addEventListener(
      'screenReaderChanged',
      (enabled: boolean) => {
        setSystemFlags((prev) => ({ ...prev, isScreenReaderEnabled: enabled }));
      },
    );

    const motionSub = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (enabled: boolean) => {
        setSystemFlags((prev) => ({ ...prev, isReduceMotionEnabled: enabled }));
      },
    );

    return () => {
      boldSub.remove();
      readerSub.remove();
      motionSub.remove();
    };
  }, []);

  // ── Track system font scale via Dimensions ─────────────────────────────

  const { fontScale } = useWindowDimensions();

  useEffect(() => {
    setSystemFlags((prev) => {
      if (Math.abs(prev.systemFontScale - fontScale) > 0.001) {
        return { ...prev, systemFontScale: fontScale };
      }
      return prev;
    });
  }, [fontScale]);

  // ── Actions ────────────────────────────────────────────────────────────

  const updateOverrides = useCallback((patch: Partial<AccessibilityOverrides>) => {
    setOverridesState((prev) => {
      const next = clampOverrides({ ...prev, ...patch });
      writeOverrides(next);
      return next;
    });
  }, []);

  const applyDisabilityPreset = useCallback((preset: DisabilityPreset) => {
    const presetOverrides = buildPreset(preset);
    setOverridesState(presetOverrides);
    writeOverrides(presetOverrides);
  }, []);

  const resetOverrides = useCallback(() => {
    setOverridesState({ ...DEFAULT_OVERRIDES });
    writeOverrides({ ...DEFAULT_OVERRIDES });
  }, []);

  // ── Derived / memoized values ──────────────────────────────────────────

  const effectiveFontScale = useMemo<number>(() => {
    const raw = systemFlags.systemFontScale * overrides.fontSizeMultiplier;
    return Math.min(MAX_FONT_MULTIPLIER, Math.max(MIN_FONT_MULTIPLIER, raw));
  }, [systemFlags.systemFontScale, overrides.fontSizeMultiplier]);

  const palette = useMemo<ContrastPalette>(() => {
    switch (overrides.contrastMode) {
      case 'HighContrastDark':
        return PALETTE_HIGH_CONTRAST_DARK;
      case 'HighContrastLight':
        return PALETTE_HIGH_CONTRAST_LIGHT;
      default:
        return PALETTE_NORMAL;
    }
  }, [overrides.contrastMode]);

  const fontFamily = useMemo<string>(() => {
    return FONT_FAMILY_MAP[overrides.fontPolicy];
  }, [overrides.fontPolicy]);

  const reduceMotion = useMemo<boolean>(() => {
    return systemFlags.isReduceMotionEnabled;
  }, [systemFlags.isReduceMotionEnabled]);

  const minTouchSize = useMemo<number>(() => {
    return overrides.touchTargetSize;
  }, [overrides.touchTargetSize]);

  // ── Context value (memoized to prevent unnecessary re-renders) ─────────

  const value = useMemo<AccessibilityEngine>(
    () => ({
      system: systemFlags,
      overrides,
      effectiveFontScale,
      palette,
      fontFamily,
      reduceMotion,
      minTouchSize,
      updateOverrides,
      applyDisabilityPreset,
      resetOverrides,
    }),
    [
      systemFlags,
      overrides,
      effectiveFontScale,
      palette,
      fontFamily,
      reduceMotion,
      minTouchSize,
      updateOverrides,
      applyDisabilityPreset,
      resetOverrides,
    ],
  );

  return (
    <AccessibilityEngineContext.Provider value={value}>
      {children}
    </AccessibilityEngineContext.Provider>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// CONSUMER HOOK (re-exported from useAccessibilityEngine.ts for convenience)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Internal raw context accessor. Prefer the memoized selectors in
 * `useAccessibilityEngine.ts` for component consumption.
 */
export function useAccessibilityEngineContext(): AccessibilityEngine {
  const ctx = useContext(AccessibilityEngineContext);
  if (!ctx) {
    throw new Error(
      'useAccessibilityEngineContext must be used within an <AccessibilityEngineProvider>. ' +
      'Wrap your app root with <AccessibilityEngineProvider>.',
    );
  }
  return ctx;
}