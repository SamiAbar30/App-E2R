import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import Svg, { Path, Circle, Rect, Text as SvgText } from 'react-native-svg';
import { GlossaryModal } from './GlossaryModal';
import {
  useContrastPalette,
  useEffectiveFontScale,
  useInteractionAccessibility,
} from '../hooks/useAccessibilityEngine';

export interface Token {
  id: string;
  text: string;
  category?: 'sugar' | 'salt' | 'nuts' | 'gluten' | 'additive';
  requiresExplanation: boolean;
}

export interface Glossary {
  [tokenId: string]: string;
}

interface Props {
  tokens: Token[];
  glossary: Glossary;
}

const Pictogram = ({ category, size = 24, fill, accent, bg }: { category: string; size?: number; fill: string; accent: string; bg: string }) => {
  switch (category) {
    case 'sugar':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityLabel="Sugar icon">
          <Path d="M12 2L9 7h6l-3-5zm-7 7l2 10h10l2-10H5z" fill={fill} />
          <Circle cx="12" cy="14" r="2" fill={accent} />
        </Svg>
      );
    case 'salt':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityLabel="Salt icon">
          <Rect x="6" y="4" width="12" height="16" rx="2" fill={fill} />
          <Path d="M9 8h6M9 12h6M9 16h3" stroke={bg} strokeWidth="2" strokeLinecap="round" />
        </Svg>
      );
    case 'nuts':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityLabel="Nuts icon">
          <Circle cx="12" cy="12" r="8" fill={fill} />
          <Path d="M12 6c-1 2-2 4-2 6s1 4 2 4 2-2 2-4-1-4-2-6z" fill={accent} />
          <Path d="M8 10c1-1 3-2 4-2M16 10c-1-1-3-2-4-2" stroke={bg} strokeWidth="1.5" strokeLinecap="round" />
        </Svg>
      );
    case 'gluten':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityLabel="Gluten icon">
          <Path d="M7 3c0 3 1 6 3 8M17 3c0 3-1 6-3 8M12 11v10" stroke={fill} strokeWidth="2.5" strokeLinecap="round" />
          <Circle cx="7" cy="3" r="2" fill={accent} />
          <Circle cx="17" cy="3" r="2" fill={accent} />
          <Circle cx="12" cy="21" r="2" fill={accent} />
        </Svg>
      );
    case 'additive':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityLabel="Additive icon">
          <Rect x="3" y="3" width="18" height="18" rx="3" fill={fill} />
          <SvgText x="12" y="16" textAnchor="middle" fontSize="11" fontWeight="bold" fill={bg}>
            E
          </SvgText>
        </Svg>
      );
    default:
      return null;
  }
};

const TokenChip = ({ token, glossary }: { token: Token; glossary: Glossary }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const palette = useContrastPalette();
  const fontScale = useEffectiveFontScale();
  const { minTouchSize, debounceMargin } = useInteractionAccessibility();
  const [lastTap, setLastTap] = useState(0);

  const hasPictogram = token.category !== undefined;
  const isTappable = token.requiresExplanation && !!glossary[token.id];

  const handlePress = () => {
    const now = Date.now();
    if (now - lastTap < debounceMargin) return;
    setLastTap(now);
    setShowTooltip(true);
  };

  const textStyle = [
    styles.tokenText,
    { color: palette.text, fontSize: 18 * fontScale },
    isTappable && { color: palette.link, textDecorationLine: 'underline' as const, textDecorationColor: palette.link },
  ];

  const chip = (
    <View style={[styles.tokenChip, { backgroundColor: palette.background, borderColor: palette.border, borderWidth: 1 }]}>
      {hasPictogram && (
        <View style={styles.pictogramWrapper}>
          <Pictogram category={token.category!} fill={palette.text} accent={palette.accent} bg={palette.background} />
        </View>
      )}
      <Text style={textStyle}>{token.text}</Text>
    </View>
  );

  if (isTappable) {
    return (
      <>
        <TouchableOpacity
          onPress={handlePress}
          accessibilityLabel={`${token.text}. Tap for explanation.`}
          accessibilityRole="button"
          accessibilityHint="Shows a simple definition"
          activeOpacity={0.7}
          style={{ minHeight: minTouchSize, justifyContent: 'center' }}
        >
          {chip}
        </TouchableOpacity>
        <GlossaryModal
          visible={showTooltip}
          term={token.text}
          definition={glossary[token.id]}
          onClose={() => setShowTooltip(false)}
        />
      </>
    );
  }

  return chip;
};

export default function AccessibleLabelRenderer({ tokens, glossary }: Props) {
  const palette = useContrastPalette();
  const fontScale = useEffectiveFontScale();

  if (!tokens || tokens.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: palette.background }]}>
        <Text style={[styles.emptyText, { color: palette.secondary, fontSize: 18 * fontScale }]}>
          No ingredients to display.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: palette.background }]}
      contentContainerStyle={styles.content}
      accessibilityLabel="Simplified ingredient list"
    >
      <View style={styles.tokenFlow}>
        {tokens.map((token) => (
          <TokenChip key={token.id} token={token} glossary={glossary} />
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16 },
  tokenFlow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  tokenChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  pictogramWrapper: { marginRight: 6 },
  tokenText: { lineHeight: 26 },
  emptyText: {
    textAlign: 'center',
    marginTop: 40,
  },
});