import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useAppStore } from '../store/useAppStore';
import * as Speech from 'expo-speech';
import { Volume2, VolumeX } from 'lucide-react-native';
import { AudioVisualSyncView } from '../components/AudioVisualSyncView';
import {
  useContrastPalette,
  useEffectiveFontScale,
  useInteractionAccessibility,
} from '../hooks/useAccessibilityEngine';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AdditiveResult, AllergenResult, MineralResult } from '../types';

type RootStackParamList = {
  Home: undefined;
};
type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

const Badge = ({ text, color, fontScale }: { text: string; color: string; fontScale: number }) => (
  <View style={[styles.badge, { backgroundColor: color }]} accessible accessibilityLabel={text}>
    <Text style={[styles.badgeText, { fontSize: 14 * fontScale }]}>{text}</Text>
  </View>
);

const normalizeAllergens = (result: any): AllergenResult[] => {
  const raw = result.allergens || result.allergensDetected || result.adapted?.allergens || [];
  return raw.map((allergen: string | AllergenResult) => (
    typeof allergen === 'string'
      ? { name: allergen, severity: 'high' as const }
      : allergen
  ));
};

const normalizeAdditives = (result: any): AdditiveResult[] => {
  const raw = result.additives || result.additivesDetected || result.adapted?.additives || [];
  return raw.map((additive: string | Partial<AdditiveResult>) => (
    typeof additive === 'string'
      ? { code: additive, name: additive, category: 'Aditivo', safe: true }
      : {
          code: additive.code || additive.name || 'Aditivo',
          name: additive.name || additive.code || 'Aditivo',
          category: additive.category || (additive as any).function || 'Aditivo',
          safe: additive.safe ?? true,
          warning: additive.warning,
        }
  ));
};

export function AnalysisResultScreen({ navigation }: { navigation: NavigationProp }) {
  const { result, reset } = useAppStore();
  const [isSpeaking, setIsSpeaking] = useState(false);

  const palette = useContrastPalette();
  const fontScale = useEffectiveFontScale();
  const { minTouchSize } = useInteractionAccessibility();

  if (!result) {
    return (
      <View style={[styles.container, { backgroundColor: palette.background }]}>
        <Text style={[styles.errorText, { color: palette.accent, fontSize: 16 * fontScale }]}>
          No result found.
        </Text>
      </View>
    );
  }

  // Safely extract from either flat type or nested mock/API type
  const extractedText = result.originalText || result.extractedText || (result as any).original?.text || '';
  const adaptedText = result.adaptedText || (result as any).adapted?.text || '';
  const productType = result.productType || 'unknown';
  const minerals = (result.minerals || []) as MineralResult[];
  const allergensDetected = normalizeAllergens(result);
  const additivesDetected = normalizeAdditives(result);

  const toggleAudio = () => {
    setIsSpeaking(!isSpeaking);
  };

  return (
    <View style={{ flex: 1, backgroundColor: palette.background }}>
      <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
        <View
          style={[styles.card, { backgroundColor: palette.background, borderColor: palette.border, borderWidth: 1 }]}
          accessible
          accessibilityLabel={`Product type ${productType}. ${allergensDetected.length} allergens detected. ${additivesDetected.length} additives detected. ${minerals.length} minerals detected.`}
        >
          <Text style={[styles.sectionTitle, { color: palette.text, fontSize: 18 * fontScale }]} accessibilityRole="header">
            Safety Summary
          </Text>
          <Text style={[styles.summaryText, { color: palette.text, fontSize: 16 * fontScale }]}>
            Product type: {productType}
          </Text>
          <Text style={[styles.summaryText, { color: allergensDetected.length > 0 ? palette.accent : palette.secondary, fontSize: 16 * fontScale }]}>
            Allergens: {allergensDetected.length > 0 ? `${allergensDetected.length} detected` : 'None detected'}
          </Text>
          <Text style={[styles.summaryText, { color: palette.text, fontSize: 16 * fontScale }]}>
            Additives: {additivesDetected.length}
          </Text>
          <Text style={[styles.summaryText, { color: palette.text, fontSize: 16 * fontScale }]}>
            Minerals: {minerals.length}
          </Text>
        </View>
        
        <View style={[styles.card, { backgroundColor: palette.background, borderColor: palette.border, borderWidth: 1 }]}>
          <View style={styles.headerRow}>
            <Text style={[styles.sectionTitle, { color: palette.text, fontSize: 18 * fontScale }]} accessibilityRole="header">
              Adapted (Easy-to-Read)
            </Text>
            <TouchableOpacity 
              onPress={toggleAudio} 
              style={[styles.audioButton, { minHeight: minTouchSize, minWidth: minTouchSize, justifyContent: 'center', alignItems: 'center' }]}
              accessibilityRole="button"
              accessibilityLabel={isSpeaking ? "Stop audio" : "Play audio"}
            >
              {isSpeaking ? <VolumeX color={palette.accent} size={24} /> : <Volume2 color={palette.accent} size={24} />}
            </TouchableOpacity>
          </View>
          
          <AudioVisualSyncView 
            text={adaptedText} 
            isSpeaking={isSpeaking}
            onPlaybackComplete={() => setIsSpeaking(false)}
          />
        </View>

        <View style={[styles.card, { backgroundColor: palette.background, borderColor: palette.border, borderWidth: 1 }]}>
          <Text style={[styles.sectionTitle, { color: palette.text, fontSize: 18 * fontScale }]} accessibilityRole="header">
            Detected Allergens
          </Text>
          <View style={styles.badgeContainer}>
            {allergensDetected && allergensDetected.length > 0 ? (
              allergensDetected.map((alg, i) => (
                <Badge
                  key={`${alg.name}-${i}`}
                  text={`${alg.name} (${alg.severity})`}
                  color={palette.accent}
                  fontScale={fontScale}
                />
              ))
            ) : (
              <Text style={[styles.emptyText, { color: palette.secondary, fontSize: 16 * fontScale }]}>None detected</Text>
            )}
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: palette.background, borderColor: palette.border, borderWidth: 1 }]}>
          <Text style={[styles.sectionTitle, { color: palette.text, fontSize: 18 * fontScale }]} accessibilityRole="header">
            Additives
          </Text>
          {additivesDetected && additivesDetected.length > 0 ? (
            additivesDetected.map((add, i) => (
              <View
                key={`${add.code}-${i}`}
                style={[styles.additiveRow, { borderColor: palette.border }]}
                accessible
                accessibilityLabel={`${add.code}, ${add.name}, ${add.category}. ${add.safe ? 'No warning' : add.warning || 'Warning'}`}
              >
                <Text style={[styles.additiveCode, { color: palette.text, fontSize: 16 * fontScale }]}>{add.code}</Text>
                <View style={styles.additiveTextBlock}>
                  <Text style={[styles.additiveName, { color: palette.text, fontSize: 16 * fontScale }]}>{add.name}</Text>
                  <Text style={[styles.additiveMeta, { color: palette.secondary, fontSize: 14 * fontScale }]}>{add.category}</Text>
                  {!add.safe && (
                    <Text style={[styles.warningText, { color: palette.accent, fontSize: 14 * fontScale }]}>{add.warning}</Text>
                  )}
                </View>
              </View>
            ))
          ) : (
            <Text style={[styles.emptyText, { color: palette.secondary, fontSize: 16 * fontScale }]}>None detected</Text>
          )}
        </View>

        {minerals.length > 0 && (
          <View style={[styles.card, { backgroundColor: palette.background, borderColor: palette.border, borderWidth: 1 }]}>
            <Text style={[styles.sectionTitle, { color: palette.text, fontSize: 18 * fontScale }]} accessibilityRole="header">
              Mineral Composition
            </Text>
            {minerals.map((mineral, i) => (
              <View
                key={`${mineral.label}-${i}`}
                style={[styles.mineralRow, { borderColor: palette.border }]}
                accessible
                accessibilityLabel={`${mineral.label}, ${mineral.value} ${mineral.unit}`}
              >
                <Text style={[styles.mineralLabel, { color: palette.text, fontSize: 15 * fontScale }]}>{mineral.label}</Text>
                <Text style={[styles.mineralValue, { color: palette.text, fontSize: 15 * fontScale }]}>
                  {mineral.value} {mineral.unit}
                </Text>
              </View>
            ))}
          </View>
        )}

        <View style={[styles.card, { backgroundColor: palette.background, borderColor: palette.border, borderWidth: 1 }]}>
          <Text style={[styles.sectionTitle, { color: palette.text, fontSize: 18 * fontScale }]} accessibilityRole="header">
            Original Text
          </Text>
          <Text style={[styles.originalText, { color: palette.secondary, fontSize: 14 * fontScale }]}>
            {extractedText}
          </Text>
        </View>

        <TouchableOpacity 
          style={[styles.doneButton, { backgroundColor: palette.text, minHeight: minTouchSize }]} 
          onPress={() => {
            Speech.stop();
            reset();
            navigation.navigate('Home');
          }}
          accessibilityRole="button"
          accessibilityLabel="Done"
        >
          <Text style={[styles.doneButtonText, { color: palette.background, fontSize: 18 * fontScale }]}>Done</Text>
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  card: { 
    padding: 16, 
    borderRadius: 8, 
    marginBottom: 16,
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 1.41
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontWeight: 'bold', marginBottom: 8 },
  audioButton: { borderRadius: 20 },
  summaryText: { marginBottom: 6, lineHeight: 22 },
  originalText: { fontStyle: 'italic' },
  emptyText: { fontStyle: 'italic' },
  badgeContainer: { flexDirection: 'row', flexWrap: 'wrap' },
  badge: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, marginRight: 8, marginBottom: 8 },
  badgeText: { color: '#fff', fontWeight: 'bold' },
  additiveRow: { flexDirection: 'row', marginBottom: 12, alignItems: 'flex-start', borderBottomWidth: 1, paddingBottom: 10 },
  additiveCode: { fontWeight: 'bold', width: 64 },
  additiveTextBlock: { flex: 1 },
  additiveName: { fontWeight: '700' },
  additiveMeta: { marginTop: 2 },
  warningText: { marginTop: 4, fontWeight: '700' },
  mineralRow: { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, paddingVertical: 8 },
  mineralLabel: { flex: 1, fontWeight: '600' },
  mineralValue: { flex: 1, textAlign: 'right' },
  doneButton: { padding: 16, borderRadius: 8, alignItems: 'center', marginTop: 8, marginBottom: 32, justifyContent: 'center' },
  doneButtonText: { fontWeight: 'bold' },
  errorText: { textAlign: 'center', marginTop: 40 },
});
