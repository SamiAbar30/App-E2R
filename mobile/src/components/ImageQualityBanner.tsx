import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import type { DocumentQualityResult } from '../types/documentScanner';
import type { ImageValidationResult } from '../types/imageValidation';

type Props = {
  quality?: DocumentQualityResult | null;
  validation?: ImageValidationResult | null;
  isValidating?: boolean;
  fontScale?: number;
};

const STATE_COLORS: Record<string, string> = {
  GOOD: '#2e7d32',
  BLUR: '#ef6c00',
  BAD_BLUR: '#ef6c00',
  DARK: '#ef233c',
  BAD_LIGHT: '#ef233c',
  OVEREXPOSED: '#ef6c00',
  LOW_CONTRAST: '#ef6c00',
  GLARE: '#ef6c00',
  OCCLUDED: '#ef6c00',
  TOO_SMALL: '#ef6c00',
  BAD_FRAMING: '#ef6c00',
  BAD_PERSPECTIVE: '#ef6c00',
  UNSTABLE: '#ef6c00',
  UNKNOWN: '#8d99ae',
};

function getColor(validation: ImageValidationResult): string {
  if (validation.isAccepted) return STATE_COLORS.GOOD;
  const firstFail = validation.failedReasons[0];
  return STATE_COLORS[firstFail] ?? STATE_COLORS.UNKNOWN;
}

function fromQualityResult(quality: DocumentQualityResult): ImageValidationResult {
  return {
    isAccepted: quality.shouldAccept,
    overallScore: quality.score,
    checks: [],
    scores: {
      sharpness: Math.min(100, Math.round(quality.metrics.focus * 4)),
      brightness: Math.round(quality.metrics.brightness * 100),
      contrast: Math.round(quality.metrics.contrast * 100),
      glare: Math.max(0, Math.round(100 - quality.metrics.glareRatio * 100)),
      coverage: Math.round(quality.metrics.foregroundFillRatio * 100),
      overall: quality.score,
    },
    failedReasons: quality.shouldAccept ? [] : [quality.state as any],
    primaryMessage: quality.message,
    primaryHint: quality.hint,
  };
}

export function ImageQualityBanner({ quality, validation, isValidating = false, fontScale = 1 }: Props) {
  if (isValidating) {
    return (
      <View
        style={[styles.banner, { backgroundColor: '#8d99ae' }]}
        accessibilityRole="alert"
        accessibilityLabel="Comprobando calidad de imagen"
        testID="quality-banner-loading"
      >
        <ActivityIndicator color="#ffffff" size="small" />
        <Text style={[styles.message, { fontSize: 15 * fontScale }]}>Comprobando calidad...</Text>
      </View>
    );
  }

  const displayValidation = validation ?? (quality ? fromQualityResult(quality) : null);

  if (!displayValidation) return null;

  const color = getColor(displayValidation);
  const icon = displayValidation.isAccepted ? 'OK' : '!';

  return (
    <View
      style={[styles.banner, { backgroundColor: color }]}
      accessibilityRole={displayValidation.isAccepted ? 'summary' : 'alert'}
      accessibilityLabel={`${displayValidation.primaryMessage}. ${displayValidation.primaryHint}`}
      testID="quality-banner"
    >
      <View style={styles.row}>
        <Text style={[styles.icon, { fontSize: 18 * fontScale }]}>{icon}</Text>
        <Text style={[styles.message, { fontSize: 15 * fontScale }]}>
          {displayValidation.primaryMessage}
        </Text>
      </View>

      {displayValidation.isAccepted ? (
        <View style={styles.scoreBadge}>
          <Text style={[styles.scoreText, { fontSize: 12 * fontScale }]}>
            Calidad: {displayValidation.overallScore}/100
          </Text>
        </View>
      ) : null}

      {!displayValidation.isAccepted && displayValidation.primaryHint ? (
        <Text style={[styles.hint, { fontSize: 13 * fontScale }]}>{displayValidation.primaryHint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 12,
    alignItems: 'center',
    flexDirection: 'column',
    gap: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  icon: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  message: {
    color: '#ffffff',
    fontWeight: '800',
    textAlign: 'center',
  },
  hint: {
    color: '#ffffff',
    textAlign: 'center',
    opacity: 0.92,
    marginTop: 2,
  },
  scoreBadge: {
    marginTop: 2,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  scoreText: {
    color: '#ffffff',
    fontWeight: '700',
  },
});
