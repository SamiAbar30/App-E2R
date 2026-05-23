import React from 'react';
import { render, act, fireEvent } from '@testing-library/react-native';
import { Text, TouchableOpacity } from 'react-native';
import { AccessibilityEngineProvider } from '../context/AccessibilityEngineContext';
import { useAccessibilityOverrides, useContrastPalette, useInteractionAccessibility, useApplyDisabilityPreset } from '../hooks/useAccessibilityEngine';

jest.setTimeout(15000);

const TestComponent = ({ profile }: { profile: 'Cognitive' | 'Visual' | 'Motor' }) => {
  const applyDisabilityPreset = useApplyDisabilityPreset();
  const overrides = useAccessibilityOverrides();
  const palette = useContrastPalette();
  const { minTouchSize } = useInteractionAccessibility();

  return (
    <>
      <TouchableOpacity
        testID="preset-button"
        onPress={() => applyDisabilityPreset(profile)}
      >
        <Text>Apply {profile}</Text>
      </TouchableOpacity>
      <Text testID="text-alignment">{overrides.textAlignment}</Text>
      <Text testID="font-policy">{overrides.fontPolicy}</Text>
      <Text testID="contrast-mode">{overrides.contrastMode}</Text>
      <Text testID="min-touch-size">{minTouchSize}</Text>
      <Text testID="bg-color">{palette.background}</Text>
      <Text testID="text-color">{palette.text}</Text>
      <Text testID="accent-color">{palette.accent}</Text>
    </>
  );
};

describe('Cognitive Accessibility & Profile Preset Macro Automation Rules', () => {
  it('mocks Cognitive profile card and asserts textAlignment, strict line height scaling, and typography', async () => {
    const { getByTestId } = render(
      <AccessibilityEngineProvider>
        <TestComponent profile="Cognitive" />
      </AccessibilityEngineProvider>
    );

    // Allow hydration to complete first
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    // Apply Cognitive
    await act(async () => {
      fireEvent.press(getByTestId('preset-button'));
    });

    expect(getByTestId('text-alignment').props.children).toBe('left');
    expect(getByTestId('font-policy').props.children).toBe('highLegibility');
  });

  it('mocks Visual profile configuration and asserts color shift to pitch black and high-luminance yellow', async () => {
    const { getByTestId } = render(
      <AccessibilityEngineProvider>
        <TestComponent profile="Visual" />
      </AccessibilityEngineProvider>
    );

    // Allow hydration to complete first
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    // Apply Visual
    await act(async () => {
      fireEvent.press(getByTestId('preset-button'));
    });

    expect(getByTestId('contrast-mode').props.children).toBe('HighContrastDark');
    expect(getByTestId('bg-color').props.children).toBe('#000000');
    expect(getByTestId('accent-color').props.children).toBe('#FFF200'); // accent is yellow
  });

  it('mocks Motor profile configuration and asserts element scaling', async () => {
    const { getByTestId } = render(
      <AccessibilityEngineProvider>
        <TestComponent profile="Motor" />
      </AccessibilityEngineProvider>
    );

    // Allow hydration to complete first
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    // Apply Motor
    await act(async () => {
      fireEvent.press(getByTestId('preset-button'));
    });

    expect(Number(getByTestId('min-touch-size').props.children)).toBe(64);
  });
});
