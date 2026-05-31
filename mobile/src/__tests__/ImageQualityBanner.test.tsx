import React from 'react';
import { render } from '@testing-library/react-native';
import { ImageQualityBanner } from '../components/ImageQualityBanner';
import type { ImageValidationResult } from '../types/imageValidation';

function makeAccepted(overrides?: Partial<ImageValidationResult>): ImageValidationResult {
  return {
    isAccepted: true,
    overallScore: 90,
    checks: [],
    scores: { sharpness: 90, brightness: 85, contrast: 80, glare: 100, coverage: 95, overall: 90 },
    failedReasons: [],
    primaryMessage: 'Imagen lista',
    primaryHint: 'La etiqueta se ve clara para analizar.',
    ...overrides,
  };
}

function makeRejected(
  reason: string,
  message: string,
  hint: string,
  overrides?: Partial<ImageValidationResult>
): ImageValidationResult {
  return {
    isAccepted: false,
    overallScore: 35,
    checks: [],
    scores: { sharpness: 30, brightness: 40, contrast: 25, glare: 100, coverage: 90, overall: 35 },
    failedReasons: [reason as any],
    primaryMessage: message,
    primaryHint: hint,
    ...overrides,
  };
}

describe('ImageQualityBanner', () => {
  it('renders nothing when validation is null and not validating', () => {
    const { toJSON } = render(<ImageQualityBanner validation={null} />);
    expect(toJSON()).toBeNull();
  });

  it('shows loading state when validating', () => {
    const { getByTestId, getByText } = render(
      <ImageQualityBanner validation={null} isValidating />
    );
    expect(getByTestId('quality-banner-loading')).toBeTruthy();
    expect(getByText(/comprobando/i)).toBeTruthy();
  });

  it('shows success message for accepted result', () => {
    const validation = makeAccepted();
    const { getByTestId, getByText } = render(<ImageQualityBanner validation={validation} />);
    expect(getByTestId('quality-banner')).toBeTruthy();
    expect(getByText('Imagen lista')).toBeTruthy();
    expect(getByText('OK')).toBeTruthy();
  });

  it('shows quality score when accepted', () => {
    const validation = makeAccepted({ overallScore: 87 });
    const { getByText } = render(<ImageQualityBanner validation={validation} />);
    expect(getByText('Calidad: 87/100')).toBeTruthy();
  });

  it('shows warning for BLUR rejection', () => {
    const validation = makeRejected('BLUR', 'Imagen borrosa', 'Sujeta el movil con firmeza.');
    const { getByText } = render(<ImageQualityBanner validation={validation} />);
    expect(getByText('Imagen borrosa')).toBeTruthy();
    expect(getByText(/firmeza/i)).toBeTruthy();
  });

  it('shows warning for GLARE rejection', () => {
    const validation = makeRejected('GLARE', 'Hay reflejos', 'Inclina el producto.');
    const { getByText } = render(<ImageQualityBanner validation={validation} />);
    expect(getByText('Hay reflejos')).toBeTruthy();
  });

  it('shows warning for OCCLUDED rejection', () => {
    const validation = makeRejected(
      'OCCLUDED',
      'Texto tapado',
      'Asegura que nada cubra el texto.'
    );
    const { getByText } = render(<ImageQualityBanner validation={validation} />);
    expect(getByText('Texto tapado')).toBeTruthy();
  });

  it('does not show hint when accepted', () => {
    const validation = makeAccepted();
    const { queryByText } = render(<ImageQualityBanner validation={validation} />);
    expect(queryByText('La etiqueta se ve clara para analizar.')).toBeNull();
  });

  it('sets accessibility role to alert for rejection', () => {
    const validation = makeRejected('DARK', 'Too dark', 'Move to light.');
    const { getByTestId } = render(<ImageQualityBanner validation={validation} />);
    expect(getByTestId('quality-banner').props.accessibilityRole).toBe('alert');
  });

  it('sets accessibility role to summary for accepted', () => {
    const validation = makeAccepted();
    const { getByTestId } = render(<ImageQualityBanner validation={validation} />);
    expect(getByTestId('quality-banner').props.accessibilityRole).toBe('summary');
  });
});
