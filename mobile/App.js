import React from 'react';
import { AccessibilityEngineProvider } from './src/context/AccessibilityEngineContext';
import { AppNavigation } from './src/navigation/AppNavigation';

export default function App() {
  return (
    <AccessibilityEngineProvider>
      <AppNavigation />
    </AccessibilityEngineProvider>
  );
}
