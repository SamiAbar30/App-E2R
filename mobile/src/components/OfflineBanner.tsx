import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { WifiOff } from 'lucide-react-native';
import { useAppStore } from '../store/useAppStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function OfflineBanner() {
  const isOffline = useAppStore((state) => state.isOffline);
  const insets = useSafeAreaInsets();

  if (!isOffline) return null;

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 16) }]}>
      <WifiOff color="#f8f9fa" size={20} style={styles.icon} />
      <Text style={styles.text} accessibilityRole="alert">
        Sin conexión a Internet. Algunas funciones no están disponibles.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ef233c',
    padding: 12,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  icon: {
    marginRight: 8,
  },
  text: {
    color: '#f8f9fa',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
