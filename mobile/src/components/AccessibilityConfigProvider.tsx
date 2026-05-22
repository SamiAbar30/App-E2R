import React from 'react';
import { AccessibilityEngineProvider } from '../context/AccessibilityEngineContext';

export function AccessibilityConfigProvider({ children }: { children: React.ReactNode }) {
  return <AccessibilityEngineProvider>{children}</AccessibilityEngineProvider>;
}
