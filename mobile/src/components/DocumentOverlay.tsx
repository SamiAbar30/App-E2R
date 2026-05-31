import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Polygon, Rect } from 'react-native-svg';
import type {
  DocumentFrameSize,
  DocumentQuad,
  DocumentQualityState,
} from '../types/documentScanner';

type Props = {
  quad?: DocumentQuad;
  frameSize?: DocumentFrameSize;
  state: DocumentQualityState;
  message: string;
  hint?: string;
  fontScale?: number;
};

const COLORS: Record<DocumentQualityState, string> = {
  GOOD: '#2e7d32',
  BAD_BLUR: '#ef6c00',
  BAD_LIGHT: '#ef233c',
  LOW_CONTRAST: '#ef6c00',
  GLARE: '#ef6c00',
  OCCLUDED: '#ef6c00',
  TOO_SMALL: '#ef6c00',
  BAD_PERSPECTIVE: '#ef6c00',
  UNSTABLE: '#ef6c00',
  UNKNOWN: '#8d99ae',
};

function polygonPoints(quad: DocumentQuad): string {
  return [
    quad.topLeft,
    quad.topRight,
    quad.bottomRight,
    quad.bottomLeft,
  ]
    .map((point) => `${point.x},${point.y}`)
    .join(' ');
}

export function DocumentOverlay({
  quad,
  frameSize,
  state,
  message,
  hint,
  fontScale = 1,
}: Props) {
  const color = COLORS[state];
  const width = frameSize?.width ?? 300;
  const height = frameSize?.height ?? 420;

  return (
    <View style={styles.container} pointerEvents="none" accessibilityRole="summary">
      <View style={styles.frame}>
        <Svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`}>
          {quad ? (
            <Polygon
              points={polygonPoints(quad)}
              fill="rgba(46,125,50,0.08)"
              stroke={color}
              strokeWidth={5}
              strokeLinejoin="round"
            />
          ) : (
            <Rect
              x={14}
              y={14}
              width={width - 28}
              height={height - 28}
              rx={12}
              fill="rgba(0,0,0,0.04)"
              stroke={color}
              strokeWidth={5}
              strokeDasharray={state === 'GOOD' ? undefined : '12 10'}
            />
          )}
        </Svg>
      </View>
      <View style={[styles.statusPill, { backgroundColor: color }]}>
        <Text style={[styles.message, { fontSize: 17 * fontScale }]}>{message}</Text>
        {hint ? <Text style={[styles.hint, { fontSize: 13 * fontScale }]}>{hint}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  frame: {
    width: '82%',
    aspectRatio: 0.72,
    maxHeight: 430,
  },
  statusPill: {
    marginTop: -8,
    maxWidth: '88%',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
  },
  message: {
    color: '#ffffff',
    fontWeight: '800',
    textAlign: 'center',
  },
  hint: {
    color: '#ffffff',
    marginTop: 3,
    textAlign: 'center',
    opacity: 0.95,
  },
});
