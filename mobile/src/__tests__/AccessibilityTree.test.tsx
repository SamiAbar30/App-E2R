import React from 'react';
import { render } from '@testing-library/react-native';
import AccessibleLabelRenderer from '../components/AccessibleLabelRenderer';
import { AccessibilityEngineProvider } from '../context/AccessibilityEngineContext';

describe('Accessibility Tree Verification Rule', () => {
  it('loops through graphical objects (allergens, icons) and asserts they expose an explicit, non-empty accessibilityLabel containing string metrics', () => {
    const mockTokens = [
      { id: '1', text: 'Almendra', category: 'nuts' as const, requiresExplanation: false },
      { id: '2', text: '5', category: 'salt' as const, requiresExplanation: false }
    ];

    const { getByLabelText } = render(
      <AccessibilityEngineProvider>
        <AccessibleLabelRenderer tokens={mockTokens} glossary={{}} />
      </AccessibilityEngineProvider>
    );

    // Assert that the graphical elements expose their labels explicitly
    const nutsIcon = getByLabelText('Nuts icon');
    expect(nutsIcon).toBeTruthy();
    expect(nutsIcon.props.accessibilityLabel).toBe('Nuts icon');

    const saltIcon = getByLabelText('Salt icon');
    expect(saltIcon).toBeTruthy();
    expect(saltIcon.props.accessibilityLabel).toBe('Salt icon');
  });
});
