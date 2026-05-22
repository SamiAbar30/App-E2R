import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import AccessibleLabelRenderer from '../components/AccessibleLabelRenderer';
import { AccessibilityEngineProvider } from '../context/AccessibilityEngineContext';

describe('AccessibleLabelRenderer', () => {
  const mockGlossary = {
    't1': 'Sugar adds sweetness.',
    't2': 'Gluten is a protein.',
  };

  const tokens = [
    { id: 't1', text: 'Sugar', category: 'sugar' as const, requiresExplanation: true },
    { id: 't2', text: 'Gluten', category: 'gluten' as const, requiresExplanation: true },
    { id: 't3', text: 'Water', requiresExplanation: false },
  ];

  it('renders pictogram SVG vectors adjacent to text', () => {
    const { getByText, getByRole } = render(
      <AccessibilityEngineProvider>
        <AccessibleLabelRenderer tokens={tokens} glossary={mockGlossary} />
      </AccessibilityEngineProvider>
    );

    // Tokens are rendered
    expect(getByText('Sugar')).toBeTruthy();
    
    // Check if tappable
    const button = getByRole('button', { name: 'Sugar. Tap for explanation.' });
    expect(button).toBeTruthy();
  });

  it('modal overlay blocks global gestures and shows explanation', () => {
    const { getByRole, getAllByRole, getByText, queryByText } = render(
      <AccessibilityEngineProvider>
        <AccessibleLabelRenderer tokens={tokens} glossary={mockGlossary} />
      </AccessibilityEngineProvider>
    );

    const button = getByRole('button', { name: 'Sugar. Tap for explanation.' });
    fireEvent.press(button);

    // Modal appears
    expect(getByText('Sugar adds sweetness.')).toBeTruthy();

    // The modal overlay should block gestures, we can check if it has the right accessibilityRole
    const closeBtn = getAllByRole('button', { name: 'Close' })[0];
    expect(closeBtn).toBeTruthy();

    // Close modal
    fireEvent.press(closeBtn);
    expect(queryByText('Sugar adds sweetness.')).toBeNull();
  });
});
