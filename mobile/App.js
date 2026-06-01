import React, { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AccessibilityEngineProvider } from './src/context/AccessibilityEngineContext';
import { AppNavigation } from './src/navigation/AppNavigation';
import * as Network from 'expo-network';
import { useAppStore } from './src/store/useAppStore';
import { processSyncQueue } from './src/api/client';
import OfflineBanner from './src/components/OfflineBanner';

export default function App() {
  const setIsOffline = useAppStore((state) => state.setIsOffline);

  useEffect(() => {
    // Initial check
    Network.getNetworkStateAsync().then((state) => {
      const isReachable = state.isInternetReachable ?? state.isConnected;
      setIsOffline(!isReachable);
    });

    const subscription = Network.addNetworkStateListener((state) => {
      const isReachable = state.isInternetReachable ?? state.isConnected;
      setIsOffline(!isReachable);
      
      if (isReachable) {
        processSyncQueue();
      }
    });

    return () => {
      if (subscription && subscription.remove) {
        subscription.remove();
      }
    };
  }, [setIsOffline]);

  return (
    <SafeAreaProvider>
      <AccessibilityEngineProvider>
        <View style={{ flex: 1 }}>
          <OfflineBanner />
          <AppNavigation />
        </View>
      </AccessibilityEngineProvider>
    </SafeAreaProvider>
  );
}
