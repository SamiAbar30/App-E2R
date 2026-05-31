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

    const cognitiveButton = getByRole('button', { name: 'Aplicar perfil cognitivo' });
    fireEvent.press(cognitiveButton);

    expect(getByText('Tamano de texto: 1.3')).toBeTruthy();
    // In our context Cognitive sets contrastMode to Normal
    expect(getByText('Contraste: Normal')).toBeTruthy();
  });

  it('applies Visual profile with HighContrastDark', () => {
    const { getByRole, getByText } = render(
      <AccessibilityEngineProvider>
        <AccessibilitySettingsScreen />
      </AccessibilityEngineProvider>
    );

    const visualButton = getByRole('button', { name: 'Aplicar perfil visual' });
    fireEvent.press(visualButton);

    expect(getByText('Tamano de texto: 1.8')).toBeTruthy();
    expect(getByText('Contraste: HighContrastDark')).toBeTruthy();
  });

  it('applies Motor profile with large touch bounds and debounce', () => {
    const { getByRole, getByText } = render(
      <AccessibilityEngineProvider>
        <AccessibilitySettingsScreen />
      </AccessibilityEngineProvider>
    );

    const motorButton = getByRole('button', { name: 'Aplicar perfil motor' });
    fireEvent.press(motorButton);

    expect(getByText('Tamano de boton: 64')).toBeTruthy();
    expect(getByText('Margen de toque: 800')).toBeTruthy();
  });
});
