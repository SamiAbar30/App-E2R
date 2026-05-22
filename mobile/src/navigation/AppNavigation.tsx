import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HomeScreen } from '../screens/HomeScreen';
import { CameraScanScreen } from '../screens/CameraScanScreen';
import { AnalysisResultScreen } from '../screens/AnalysisResultScreen';
import { AccessibilitySettingsScreen } from '../screens/AccessibilitySettingsScreen';
import { useContrastPalette, useFontFamily } from '../hooks/useAccessibilityEngine';

export type RootStackParamList = {
  Home: undefined;
  Camera: undefined;
  Result: undefined;
  AccessibilitySettings: undefined;
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
        <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'Easy-to-Read' }} />
        <Stack.Screen name="Camera" component={CameraScanScreen} options={{ title: 'Scan Label' }} />
        <Stack.Screen name="Result" component={AnalysisResultScreen} options={{ title: 'Adapted Label' }} />
        <Stack.Screen name="AccessibilitySettings" component={AccessibilitySettingsScreen} options={{ title: 'Accessibility' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
