import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';

export type FrameStats = {
  laplacianVariance: number;
  luminance: number;
};

interface Props {
  stats?: FrameStats;
  onClearToCapture: (isClear: boolean) => void;
  fontScale?: number;
}

export function CameraFrameProcessor({ stats, onClearToCapture, fontScale = 1 }: Props) {
  const [warning, setWarning] = useState<string | null>(null);

  useEffect(() => {
    if (!stats) {
      setWarning(null);
      onClearToCapture(true);
      return;
    }

    if (stats.luminance < 0.2) {
      setWarning('MOVE CLOSER');
      onClearToCapture(false);
    } else if (stats.laplacianVariance < 50) {
      setWarning('HOLD STEADY');
      onClearToCapture(false);
    } else {
      setWarning(null);
      onClearToCapture(true);
    }
  }, [stats, onClearToCapture]);

  if (!warning) return null;

  return (
    <View style={styles.container} accessibilityRole="alert">
      <Text style={[styles.text, { fontSize: 24 * fontScale }]}>{warning}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 40,
    alignSelf: 'center',
    backgroundColor: '#ef233c', // ACCENT_RED
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    zIndex: 10,
  },
  text: {
    color: '#ffffff',
    fontWeight: 'bold',
  }
});
