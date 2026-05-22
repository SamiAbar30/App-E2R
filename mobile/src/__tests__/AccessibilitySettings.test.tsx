import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { AccessibilitySettingsScreen } from '../screens/AccessibilitySettingsScreen';
import { AccessibilityEngineProvider } from '../context/AccessibilityEngineContext';

describe('AccessibilitySettings', () => {
  it('applies Cognitive profile and updates UI', () => {
    const { getByRole, getByText } = render(
      <AccessibilityEngineProvider>
        <AccessibilitySettingsScreen />
      </AccessibilityEngineProvider>
    );

    const cognitiveButton = getByRole('button', { name: 'Apply Cognitive profile' });
    fireEvent.press(cognitiveButton);

    expect(getByText('Font Scale: 1.3')).toBeTruthy();
    // In our context Cognitive sets contrastMode to Normal
    expect(getByText('Contrast: Normal')).toBeTruthy();
  });

  it('applies Visual profile with HighContrastDark', () => {
    const { getByRole, getByText } = render(
      <AccessibilityEngineProvider>
        <AccessibilitySettingsScreen />
      </AccessibilityEngineProvider>
    );

    const visualButton = getByRole('button', { name: 'Apply Visual profile' });
    fireEvent.press(visualButton);

    expect(getByText('Font Scale: 1.8')).toBeTruthy();
    expect(getByText('Contrast: HighContrastDark')).toBeTruthy();
  });

  it('applies Motor profile with large touch bounds and debounce', () => {
    const { getByRole, getByText } = render(
      <AccessibilityEngineProvider>
        <AccessibilitySettingsScreen />
      </AccessibilityEngineProvider>
    );

    const motorButton = getByRole('button', { name: 'Apply Motor profile' });
    fireEvent.press(motorButton);

    expect(getByText('Touch Size: 64')).toBeTruthy();
    expect(getByText('Debounce: 800')).toBeTruthy();
  });
});
