import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { evaluateLabelQuality, FrameStats, LabelQualityResult } from '../utils/labelQuality';
import {
  GUIDE_ASPECT_RATIO,
  GUIDE_TOP_OFFSET,
  GUIDE_WIDTH_RATIO
} from '../utils/cameraGuideCrop';

export type { FrameStats };

interface Props {
  stats?: FrameStats;
  onClearToCapture: (isClear: boolean) => void;
  fontScale?: number;
}

export function CameraFrameProcessor({ stats, onClearToCapture, fontScale = 1 }: Props) {
  const [quality, setQuality] = useState<LabelQualityResult>(() => evaluateLabelQuality(stats));

  useEffect(() => {
    const nextQuality = evaluateLabelQuality(stats);
    setQuality(nextQuality);
    onClearToCapture(nextQuality.isClearToCapture);
  }, [stats, onClearToCapture]);

  return (
    <View
      style={[styles.container, { borderColor: quality.borderColor }]}
      pointerEvents="none"
      accessibilityRole={quality.isClearToCapture ? 'summary' : 'alert'}
      accessibilityLabel={quality.message}
      testID="label-quality-frame"
    >
      <View style={[styles.corner, styles.topLeft]} />
      <View style={[styles.corner, styles.topRight]} />
      <View style={[styles.corner, styles.bottomLeft]} />
      <View style={[styles.corner, styles.bottomRight]} />
      <View style={[styles.statusPill, { backgroundColor: quality.borderColor }]}>
        <Text style={[styles.text, { fontSize: 18 * fontScale }]}>{quality.message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: GUIDE_TOP_OFFSET,
    alignSelf: 'center',
    width: `${GUIDE_WIDTH_RATIO * 100}%`,
    aspectRatio: GUIDE_ASPECT_RATIO,
    borderWidth: 4,
    borderRadius: 8,
    justifyContent: 'flex-start',
    alignItems: 'center',
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  statusPill: {
    marginTop: -18,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 160,
    alignItems: 'center',
  },
  text: {
    color: '#ffffff',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  corner: {
    position: 'absolute',
    width: 34,
    height: 34,
    borderColor: '#ffffff',
  },
  topLeft: {
    top: 10,
    left: 10,
    borderTopWidth: 4,
    borderLeftWidth: 4,
  },
  topRight: {
    top: 10,
    right: 10,
    borderTopWidth: 4,
    borderRightWidth: 4,
  },
  bottomLeft: {
    bottom: 10,
    left: 10,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
  },
  bottomRight: {
    bottom: 10,
    right: 10,
    borderBottomWidth: 4,
    borderRightWidth: 4,
  }
});
