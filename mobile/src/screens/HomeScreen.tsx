import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Camera, Clock, Settings } from 'lucide-react-native';
import { useAppStore } from '../store/useAppStore';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  useContrastPalette,
  useEffectiveFontScale,
  useInteractionAccessibility,
} from '../hooks/useAccessibilityEngine';
import { ScanResult } from '../types';

type RootStackParamList = {
  Camera: undefined;
  Result: undefined;
  AccessibilitySettings: undefined;
};
type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Camera' | 'Result' | 'AccessibilitySettings'>;

export function HomeScreen({ navigation }: { navigation: NavigationProp }) {
  const { history, setResult } = useAppStore();
  const palette = useContrastPalette();
  const fontScale = useEffectiveFontScale();
  const { minTouchSize } = useInteractionAccessibility();

  const handleHistoryItemClick = (item: ScanResult) => {
    setResult(item);
    navigation.navigate('Result');
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: palette.background }]} contentContainerStyle={{ padding: 24, paddingBottom: 40 }}>
      
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
        <TouchableOpacity 
          onPress={() => navigation.navigate('AccessibilitySettings')}
          accessibilityRole="button"
          accessibilityLabel="Accessibility Settings"
          style={{ minHeight: minTouchSize, minWidth: minTouchSize, justifyContent: 'center', alignItems: 'center' }}
        >
          <Settings color={palette.text} size={24} />
        </TouchableOpacity>
      </View>

      <View style={styles.header}>
        <Text style={[styles.title, { color: palette.text, fontSize: 28 * fontScale }]} accessibilityRole="header">
          Easy-to-Read Labels
        </Text>
        <Text style={[styles.subtitle, { color: palette.secondary, fontSize: 16 * fontScale }]}>
          Scan an ingredient label to see a simplified version with adapted formatting.
        </Text>
      </View>

      <TouchableOpacity 
        style={[styles.button, { backgroundColor: palette.accent, minHeight: minTouchSize }]} 
        onPress={() => navigation.navigate('Camera')}
        accessibilityRole="button"
        accessibilityLabel="Scan Label"
      >
        <Camera color={palette.background} size={24} style={{ marginRight: 8 }} />
        <Text style={[styles.buttonText, { color: palette.background, fontSize: 18 * fontScale }]}>Scan Label</Text>
      </TouchableOpacity>

      <View style={[styles.divider, { backgroundColor: palette.border }]} />

      <View style={styles.historySection}>
        <View style={styles.historyHeader}>
          <Clock color={palette.text} size={20} style={{ marginRight: 8 }} />
          <Text style={[styles.historyTitle, { color: palette.text, fontSize: 20 * fontScale }]}>Last Activities</Text>
        </View>

        {history && history.length > 0 ? (
          history.map((item, index) => {
            const previewText = item.adaptedText?.substring(0, 40) + '...';
            const dateStr = item.date ? new Date(item.date).toLocaleDateString() : '';
            
            return (
              <TouchableOpacity 
                key={item.id || index} 
                style={[styles.historyCard, { backgroundColor: palette.background, borderColor: palette.border, borderWidth: 1, borderLeftColor: palette.accent, borderLeftWidth: 4, minHeight: minTouchSize }]}
                onPress={() => handleHistoryItemClick(item)}
                accessibilityRole="button"
                accessibilityLabel={`History item from ${dateStr}`}
              >
                <Text style={[styles.historyDate, { color: palette.secondary }]}>{dateStr}</Text>
                <Text style={[styles.historyPreview, { color: palette.text, fontSize: 16 * fontScale }]}>{previewText}</Text>
                {item.allergensDetected?.length > 0 && (
                  <Text style={[styles.historyTags, { color: palette.accent }]}>
                    ⚠️ {item.allergensDetected.length} Allergens
                  </Text>
                )}
              </TouchableOpacity>
            )
          })
        ) : (
          <Text style={[styles.emptyHistory, { color: palette.secondary, fontSize: 14 * fontScale }]}>No recent scans found.</Text>
        )}
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
    lineHeight: 24,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    borderRadius: 8,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  buttonText: {
    fontWeight: 'bold',
  },
  divider: {
    height: 1,
    marginVertical: 32,
  },
  historySection: {
    flex: 1,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  historyTitle: {
    fontWeight: 'bold',
  },
  historyCard: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    justifyContent: 'center'
  },
  historyDate: {
    fontSize: 12,
    marginBottom: 4,
  },
  historyPreview: {
    fontWeight: '500',
  },
  historyTags: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: 'bold',
  },
  emptyHistory: {
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 20,
  }
});
