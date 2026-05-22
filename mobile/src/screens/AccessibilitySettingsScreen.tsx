import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useAccessibilityOverrides, useApplyDisabilityPreset, useContrastPalette, useEffectiveFontScale, useInteractionAccessibility, type DisabilityPreset } from '../hooks/useAccessibilityEngine';

export function AccessibilitySettingsScreen() {
  const overrides = useAccessibilityOverrides();
  const applyPreset = useApplyDisabilityPreset();
  const palette = useContrastPalette();
  const fontScale = useEffectiveFontScale();
  const { minTouchSize, reduceMotion } = useInteractionAccessibility();

  const presets: DisabilityPreset[] = ['Cognitive', 'Visual', 'Motor'];

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: palette.background }]}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.title, { color: palette.text, fontSize: 24 * fontScale }]} accessibilityRole="header">
        Accessibility Profiles
      </Text>

      {presets.map(preset => (
        <TouchableOpacity
          key={preset}
          style={[
            styles.button,
            { 
              backgroundColor: palette.accent,
              minHeight: minTouchSize,
              minWidth: minTouchSize
            }
          ]}
          onPress={() => applyPreset(preset)}
          accessibilityRole="button"
          accessibilityLabel={`Apply ${preset} profile`}
        >
          <Text style={[styles.buttonText, { fontSize: 16 * fontScale, color: palette.background }]}>
            {preset} Profile
          </Text>
        </TouchableOpacity>
      ))}

      <View style={[styles.card, { borderColor: palette.border }]}>
        <Text style={[styles.label, { color: palette.text, fontSize: 18 * fontScale }]}>
          Current Settings:
        </Text>
        <Text style={[styles.text, { color: palette.secondary, fontSize: 16 * fontScale }]}>
          Font Scale: {overrides.fontSizeMultiplier}
        </Text>
        <Text style={[styles.text, { color: palette.secondary, fontSize: 16 * fontScale }]}>
          Contrast: {overrides.contrastMode}
        </Text>
        <Text style={[styles.text, { color: palette.secondary, fontSize: 16 * fontScale }]}>
          Touch Size: {overrides.touchTargetSize}
        </Text>
        <Text style={[styles.text, { color: palette.secondary, fontSize: 16 * fontScale }]}>
          Debounce: {overrides.debounceMargin}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  title: {
    fontWeight: 'bold',
    marginBottom: 24,
  },
  button: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: '#ffffff', // Assuming accent allows white text, or we can use palette.background if we want to be safe. But contrast mode might change. Let's use #f8f9fa
    fontWeight: '600',
  },
  card: {
    borderWidth: 1,
    padding: 16,
    borderRadius: 8,
    marginTop: 24,
  },
  label: {
    fontWeight: 'bold',
    marginBottom: 8,
  },
  text: {
    marginBottom: 4,
  }
});
