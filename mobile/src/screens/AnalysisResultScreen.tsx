import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal } from 'react-native';
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

type RootStackParamList = {
  Home: undefined;
};
type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

const Badge = ({ text, color, fontScale }: { text: string; color: string; fontScale: number }) => (
  <View style={[styles.badge, { backgroundColor: color }]}>
    <Text style={[styles.badgeText, { fontSize: 14 * fontScale }]}>{text}</Text>
  </View>
);

export function AnalysisResultScreen({ navigation }: { navigation: NavigationProp }) {
  const { result, reset } = useAppStore();
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMagnifierVisible, setMagnifierVisible] = useState(false);

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
  const extractedText = result.extractedText || (result as any).original?.text || '';
  const adaptedText = result.adaptedText || (result as any).adapted?.text || '';
  const allergensDetected = result.allergensDetected || (result as any).adapted?.allergens || [];
  
  // Additives can be strings or objects depending on the mock vs final backend API
  const rawAdditives = result.additivesDetected || (result as any).adapted?.additives || [];
  const additivesDetected = rawAdditives.map((add: any) => typeof add === 'string' ? add : add.code);
  console.log(result);

  const toggleAudio = () => {
    setIsSpeaking(!isSpeaking);
  };

  return (
    <View style={{ flex: 1, backgroundColor: palette.background }}>
      <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
        
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
              allergensDetected.map((alg, i) => <Badge key={i} text={alg} color={palette.accent} fontScale={fontScale} />)
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
              <View key={i} style={styles.additiveRow}>
                <Text style={[styles.additiveCode, { color: palette.text, fontSize: 16 * fontScale }]}>{add}</Text>
              </View>
            ))
          ) : (
            <Text style={[styles.emptyText, { color: palette.secondary, fontSize: 16 * fontScale }]}>None detected</Text>
          )}
        </View>

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
  originalText: { fontStyle: 'italic' },
  emptyText: { fontStyle: 'italic' },
  badgeContainer: { flexDirection: 'row', flexWrap: 'wrap' },
  badge: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, marginRight: 8, marginBottom: 8 },
  badgeText: { color: '#fff', fontWeight: 'bold' },
  additiveRow: { flexDirection: 'row', marginBottom: 12, alignItems: 'center' },
  additiveCode: { fontWeight: 'bold', width: 60 },
  doneButton: { padding: 16, borderRadius: 8, alignItems: 'center', marginTop: 8, marginBottom: 32, justifyContent: 'center' },
  doneButtonText: { fontWeight: 'bold' },
  errorText: { textAlign: 'center', marginTop: 40 },
});
