import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Speech from 'expo-speech';
import { AlertTriangle, Beaker, CheckCircle2, Droplets, RotateCcw, ScanLine, Volume2, VolumeX } from 'lucide-react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppShell, appTheme } from '../components/AppShell';
import { AudioVisualSyncView } from '../components/AudioVisualSyncView';
import { useAppStore } from '../store/useAppStore';
import { useAccessibilityOverrides, useEffectiveFontScale, useInteractionAccessibility } from '../hooks/useAccessibilityEngine';
import type { AdditiveResult, AllergenResult, MineralResult } from '../types';

type RootStackParamList = {
  Home: undefined;
  Camera: undefined;
  History: undefined;
  AccessibilitySettings: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

const normalizeAllergens = (result: any): AllergenResult[] => {
  const raw = result.allergens || result.allergensDetected || result.adapted?.allergens || [];
  return raw.map((allergen: string | AllergenResult) => (
    typeof allergen === 'string' ? { name: allergen, severity: 'high' as const } : allergen
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

const productTitle = (type?: string) => {
  if (type === 'water') return 'Etiqueta de agua';
  if (type === 'food') return 'Etiqueta alimentaria';
  if (type === 'supplement') return 'Suplemento';
  return 'Resultado del escaneo';
};

export function AnalysisResultScreen({ navigation }: { navigation: NavigationProp }) {
  const { result, reset } = useAppStore();
  const [isSpeaking, setIsSpeaking] = useState(false);
  const fontScale = useEffectiveFontScale();
  const { minTouchSize } = useInteractionAccessibility();
  const overrides = useAccessibilityOverrides();

  const finish = () => {
    Speech.stop();
    setIsSpeaking(false);
    reset();
    navigation.navigate('Home');
  };

  if (!result) {
    return (
      <AppShell
        title="Resultado"
        activeTab="none"
        onHome={() => navigation.navigate('Home')}
        onScan={() => navigation.navigate('Camera')}
        onHistory={() => navigation.navigate('History')}
        onSettings={() => navigation.navigate('AccessibilitySettings')}
      >
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No hay resultado disponible.</Text>
          <TouchableOpacity style={[styles.primaryButton, { minHeight: minTouchSize }]} onPress={() => navigation.navigate('Camera')}>
            <Text style={styles.primaryButtonText}>ESCANEAR</Text>
          </TouchableOpacity>
        </View>
      </AppShell>
    );
  }

  const adaptedText = result.adaptedText || (result as any).adapted?.text || '';
  const originalText = result.originalText || result.extractedText || (result as any).original?.text || '';
  const allergens = normalizeAllergens(result);
  const additives = normalizeAdditives(result);
  const minerals = (result.minerals || []) as MineralResult[];
  const hasWarnings = allergens.length > 0 || additives.some(additive => !additive.safe);
  const textScale = Math.min(fontScale, overrides.fontSizeMultiplier >= 1.6 ? 1.45 : 1.25);

  return (
    <AppShell
      title={productTitle(result.productType)}
      activeTab="none"
      onHome={() => navigation.navigate('Home')}
      onScan={() => navigation.navigate('Camera')}
      onHistory={() => navigation.navigate('History')}
      onSettings={() => navigation.navigate('AccessibilitySettings')}
    >
      <View style={[styles.summary, { borderColor: hasWarnings ? appTheme.danger : appTheme.secondary }]}>
        <View style={styles.summaryHeader}>
          <Text style={[styles.summaryTitle, { fontSize: 22 * textScale }]}>
            {hasWarnings ? 'Revisar antes de consumir' : 'Sin avisos importantes'}
          </Text>
          {hasWarnings ? <AlertTriangle color={appTheme.danger} size={32} /> : <CheckCircle2 color={appTheme.secondary} size={32} />}
        </View>
        <View style={styles.badges}>
          <Badge label={allergens.length > 0 ? `${allergens.length} alergenos` : 'Sin alergenos'} danger={allergens.length > 0} />
          <Badge label={`${additives.length} aditivos`} danger={additives.some(additive => !additive.safe)} />
          {minerals.length > 0 && <Badge label={`${minerals.length} minerales`} />}
        </View>
      </View>

      {allergens.length > 0 && (
        <Section title="Alergenos detectados" icon={<AlertTriangle color={appTheme.danger} size={23} />}>
          <View style={styles.badges}>
            {allergens.map((allergen, index) => (
              <View key={`${allergen.name}-${index}`} style={styles.dangerPill}>
                <Text style={styles.dangerPillText}>{allergen.name}</Text>
              </View>
            ))}
          </View>
        </Section>
      )}

      <Section title="Texto en lectura facil" icon={<Volume2 color={appTheme.primary} size={23} />}>
        <TouchableOpacity
          onPress={() => {
            if (isSpeaking) {
              Speech.stop();
              setIsSpeaking(false);
            } else {
              setIsSpeaking(true);
            }
          }}
          style={[styles.audioButton, { minHeight: minTouchSize }]}
          accessibilityRole="button"
          accessibilityLabel={isSpeaking ? 'Detener audio' : 'Escuchar texto'}
        >
          {isSpeaking ? <VolumeX color={appTheme.danger} size={22} /> : <Volume2 color={appTheme.primary} size={22} />}
          <Text style={styles.audioText}>{isSpeaking ? 'Detener audio' : 'Escuchar texto'}</Text>
        </TouchableOpacity>
        <View style={styles.textBox}>
          <AudioVisualSyncView text={adaptedText || 'No se encontro texto adaptado.'} isSpeaking={isSpeaking} onPlaybackComplete={() => setIsSpeaking(false)} />
        </View>
      </Section>

      {additives.length > 0 && (
        <Section title="Aditivos" icon={<Beaker color={appTheme.primary} size={23} />}>
          {additives.map((additive, index) => (
            <View key={`${additive.code}-${index}`} style={[styles.additiveCard, !additive.safe && styles.additiveWarning]}>
              <View style={[styles.additiveCode, { backgroundColor: additive.safe ? appTheme.secondary : appTheme.danger }]}>
                <Text style={styles.additiveCodeText}>{additive.code}</Text>
              </View>
              <View style={styles.additiveText}>
                <Text style={styles.additiveName}>{additive.name}</Text>
                <Text style={styles.additiveMeta}>{additive.category}</Text>
                {!additive.safe && <Text style={styles.warningText}>{additive.warning}</Text>}
              </View>
            </View>
          ))}
        </Section>
      )}

      {minerals.length > 0 && (
        <Section title="Composicion mineral" icon={<Droplets color={appTheme.primary} size={23} />}>
          {minerals.map((mineral, index) => (
            <View key={`${mineral.label}-${index}`} style={styles.mineralRow}>
              <Text style={styles.mineralLabel}>{mineral.label}</Text>
              <Text style={styles.mineralValue}>{mineral.value} {mineral.unit}</Text>
            </View>
          ))}
        </Section>
      )}

      {!overrides.chunkedReading && (
        <Section title="Texto original">
          <Text style={styles.originalText}>{originalText}</Text>
        </Section>
      )}

      <View style={styles.actionRow}>
        <TouchableOpacity
          onPress={() => navigation.navigate('Camera')}
          style={[styles.secondaryButton, { minHeight: Math.max(58, minTouchSize) }]}
          accessibilityRole="button"
          accessibilityLabel="Escanear otra etiqueta"
        >
          <RotateCcw color={appTheme.text} size={21} />
          <Text style={styles.secondaryButtonText}>Escanear</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={finish}
          style={[styles.primaryButton, { minHeight: Math.max(58, minTouchSize) }]}
          accessibilityRole="button"
          accessibilityLabel="Guardar resultado"
        >
          <ScanLine color="#ffffff" size={21} />
          <Text style={styles.primaryButtonText}>Guardar</Text>
        </TouchableOpacity>
      </View>
    </AppShell>
  );
}

function Badge({ label, danger }: { label: string; danger?: boolean }) {
  return (
    <View style={[styles.badge, { backgroundColor: danger ? appTheme.dangerSoft : appTheme.secondarySoft, borderColor: danger ? appTheme.danger : appTheme.secondary }]}>
      <Text style={[styles.badgeText, { color: danger ? appTheme.dangerText : appTheme.secondaryText }]}>{label}</Text>
    </View>
  );
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        {icon}
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  emptyCard: {
    alignItems: 'center',
    backgroundColor: appTheme.surface,
    borderRadius: 8,
    padding: 24,
  },
  emptyTitle: {
    color: appTheme.text,
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 18,
  },
  summary: {
    backgroundColor: appTheme.surface,
    borderRadius: 8,
    borderWidth: 2,
    padding: 18,
  },
  summaryHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  summaryTitle: {
    color: appTheme.text,
    flex: 1,
    fontWeight: '900',
    letterSpacing: 0,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  badge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  badgeText: {
    fontSize: 14,
    fontWeight: '900',
  },
  section: {
    backgroundColor: appTheme.surface,
    borderColor: '#e5e2e1',
    borderRadius: 8,
    borderWidth: 1,
    padding: 18,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  sectionTitle: {
    color: appTheme.text,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 0,
  },
  dangerPill: {
    backgroundColor: appTheme.danger,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  dangerPillText: {
    color: '#ffffff',
    fontWeight: '900',
  },
  audioButton: {
    alignItems: 'center',
    backgroundColor: appTheme.primarySoft,
    borderRadius: 8,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginBottom: 12,
  },
  audioText: {
    color: appTheme.primary,
    fontWeight: '900',
  },
  textBox: {
    backgroundColor: '#f0eded',
    borderRadius: 8,
    padding: 12,
  },
  additiveCard: {
    alignItems: 'flex-start',
    backgroundColor: appTheme.secondarySoft,
    borderColor: appTheme.secondary,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
    padding: 14,
  },
  additiveWarning: {
    backgroundColor: '#fff0c2',
    borderColor: appTheme.danger,
  },
  additiveCode: {
    alignItems: 'center',
    borderRadius: 8,
    justifyContent: 'center',
    minWidth: 58,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  additiveCodeText: {
    color: '#ffffff',
    fontWeight: '900',
  },
  additiveText: {
    flex: 1,
  },
  additiveName: {
    color: appTheme.text,
    fontSize: 17,
    fontWeight: '900',
  },
  additiveMeta: {
    color: appTheme.muted,
    fontWeight: '700',
    marginTop: 2,
  },
  warningText: {
    color: appTheme.dangerText,
    fontWeight: '900',
    marginTop: 6,
  },
  mineralRow: {
    borderBottomColor: '#e5e2e1',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  mineralLabel: {
    color: appTheme.text,
    flex: 1,
    fontWeight: '900',
  },
  mineralValue: {
    color: appTheme.text,
    fontWeight: '900',
  },
  originalText: {
    color: appTheme.muted,
    fontStyle: 'italic',
    lineHeight: 22,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: appTheme.primary,
    borderRadius: 8,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: appTheme.surface,
    borderColor: appTheme.border,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
  },
  secondaryButtonText: {
    color: appTheme.text,
    fontSize: 16,
    fontWeight: '900',
  },
});
