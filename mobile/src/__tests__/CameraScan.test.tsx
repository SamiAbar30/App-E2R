import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { CameraScanScreen } from '../screens/CameraScanScreen';
import { AccessibilityEngineProvider } from '../context/AccessibilityEngineContext';

describe('CameraScanScreen', () => {
  const mockNavigation = { navigate: jest.fn() } as any;

  it('renders correctly', () => {
    const { getByRole } = render(
      <AccessibilityEngineProvider>
        <CameraScanScreen navigation={mockNavigation} />
      </AccessibilityEngineProvider>
    );
    expect(getByRole('button', { name: 'Take Photo' })).toBeTruthy();
  });

  it('mocks blurred frame and blocks capture with HOLD STEADY', () => {
    const { getByTestId, getByRole, getByText } = render(
      <AccessibilityEngineProvider>
        <CameraScanScreen navigation={mockNavigation} />
      </AccessibilityEngineProvider>
    );

    const mockBlurBtn = getByTestId('mock-blur');
    fireEvent.press(mockBlurBtn);

    expect(getByText('HOLD STEADY')).toBeTruthy();
    
    const captureBtn = getByRole('button', { name: 'Take Photo' });
    // Verify it is disabled by checking if it blocks press or checking props
    expect(captureBtn.props.accessibilityState?.disabled ?? captureBtn.props.disabled).toBe(true);
  });

  it('mocks under-exposed frame and blocks capture with MOVE CLOSER', () => {
    const { getByTestId, getByRole, getByText } = render(
      <AccessibilityEngineProvider>
        <CameraScanScreen navigation={mockNavigation} />
      </AccessibilityEngineProvider>
    );

    const mockDarkBtn = getByTestId('mock-dark');
    fireEvent.press(mockDarkBtn);

    expect(getByText('MOVE CLOSER')).toBeTruthy();
    
    const captureBtn = getByRole('button', { name: 'Take Photo' });
    expect(captureBtn.props.accessibilityState?.disabled ?? captureBtn.props.disabled).toBe(true);
  });
});
