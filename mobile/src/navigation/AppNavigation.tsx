import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HomeScreen } from '../screens/HomeScreen';
import { DocumentScannerScreen } from '../screens/DocumentScannerScreen';
import { AnalysisResultScreen } from '../screens/AnalysisResultScreen';
import { AccessibilitySettingsScreen } from '../screens/AccessibilitySettingsScreen';
import { HistoryScreen } from '../screens/HistoryScreen';
import { ScanGuidanceScreen } from '../screens/ScanGuidanceScreen';
import { useContrastPalette, useFontFamily } from '../hooks/useAccessibilityEngine';

export type RootStackParamList = {
  Home: undefined;
  Camera: undefined;
  Result: undefined;
  AccessibilitySettings: undefined;
  History: undefined;
  ScanGuidance: { cta?: 'scan' | 'back' } | undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function AppNavigation() {
  const palette = useContrastPalette();
  const fontFamily = useFontFamily();

  return (
    <NavigationContainer>
      <Stack.Navigator 
        id="RootStack"
        initialRouteName="Home"
        screenOptions={{
          headerStyle: { backgroundColor: palette.text },
          headerTintColor: palette.background,
          headerTitleStyle: { fontWeight: 'bold', fontFamily },
        }}
      >
        <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Camera" component={DocumentScannerScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Result" component={AnalysisResultScreen} options={{ headerShown: false }} />
        <Stack.Screen name="AccessibilitySettings" component={AccessibilitySettingsScreen} options={{ headerShown: false }} />
        <Stack.Screen name="History" component={HistoryScreen} options={{ headerShown: false }} />
        <Stack.Screen name="ScanGuidance" component={ScanGuidanceScreen} options={{ headerShown: false }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
