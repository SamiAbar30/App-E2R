import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Camera, CheckCircle2, X } from 'lucide-react-native';
import { AppShell, appTheme } from '../components/AppShell';
import { useEffectiveFontScale, useInteractionAccessibility } from '../hooks/useAccessibilityEngine';

type RootStackParamList = {
  Home: undefined;
  Camera: undefined;
  History: undefined;
  AccessibilitySettings: undefined;
  ScanGuidance: { cta?: 'scan' | 'back' } | undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'ScanGuidance'>;
type GuidanceRouteProp = RouteProp<RootStackParamList, 'ScanGuidance'>;

export function ScanGuidanceScreen({
  navigation,
  route,
}: {
  navigation: NavigationProp;
  route: GuidanceRouteProp;
}) {
  const fontScale = useEffectiveFontScale();
  const { minTouchSize } = useInteractionAccessibility();
  const cta = route.params?.cta ?? 'scan';

  return (
    <AppShell
      title="Como escanear bien"
      activeTab="none"
      onHome={() => navigation.navigate('Home')}
      onScan={() => navigation.navigate('Camera')}
      onHistory={() => navigation.navigate('History')}
      onSettings={() => navigation.navigate('AccessibilitySettings')}
      showBottomNav={cta !== 'back'}
    >
      <Text style={[styles.intro, { fontSize: 18 * Math.min(fontScale, 1.25) }]}>
        Sigue estos pasos para que el OCR lea mejor la etiqueta.
      </Text>
      <GuidanceTip number="1" title="El texto debe estar dentro del recuadro" badLabel="Cortado" goodLabel="Completo" />
      <GuidanceTip number="2" title="Sosten el producto plano y con buena luz" badLabel="Sombra" goodLabel="Claro" />
      <GuidanceTip number="3" title="No cubras el texto con los dedos" badLabel="Tapado" goodLabel="Libre" />
      <GuidanceTip number="4" title="Acerca la camara para ver el texto grande" badLabel="Lejos" goodLabel="Cerca" />
      <TouchableOpacity
        onPress={() => cta === 'back' ? navigation.goBack() : navigation.navigate('Camera')}
        style={[styles.primaryButton, { minHeight: Math.max(64, minTouchSize) }]}
        accessibilityRole="button"
        accessibilityLabel={cta === 'back' ? 'Entendido' : 'Escanear ahora'}
      >
        {cta === 'scan' && <Camera color="#ffffff" size={22} />}
        <Text style={styles.primaryButtonText}>
          {cta === 'back' ? 'ENTENDIDO' : 'ESCANEAR AHORA'}
        </Text>
      </TouchableOpacity>
    </AppShell>
  );
}

function GuidanceTip({
  number,
  title,
  badLabel,
  goodLabel,
}: {
  number: string;
  title: string;
  badLabel: string;
  goodLabel: string;
}) {
  return (
    <View style={styles.tip}>
      <View style={styles.tipHeader}>
        <View style={styles.numberBadge}>
          <Text style={styles.numberText}>{number}</Text>
        </View>
        <Text style={styles.tipTitle}>{title}</Text>
      </View>
      <View style={styles.exampleRow}>
        <View style={[styles.exampleCard, styles.badExample]}>
          <X color="#ffffff" size={22} />
          <Text style={styles.badText}>{badLabel}</Text>
        </View>
        <View style={[styles.exampleCard, styles.goodExample]}>
          <CheckCircle2 color={appTheme.secondary} size={22} />
          <Text style={styles.goodText}>{goodLabel}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  intro: {
    color: appTheme.muted,
    fontWeight: '700',
    lineHeight: 27,
  },
  tip: {
    borderTopColor: appTheme.border,
    borderTopWidth: 1,
    gap: 16,
    paddingTop: 22,
  },
  tipHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
  },
  numberBadge: {
    alignItems: 'center',
    backgroundColor: appTheme.primarySoft,
    borderRadius: 999,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  numberText: {
    color: appTheme.primary,
    fontSize: 18,
    fontWeight: '900',
  },
  tipTitle: {
    color: appTheme.text,
    flex: 1,
    fontSize: 20,
    fontWeight: '900',
    lineHeight: 29,
  },
  exampleRow: {
    flexDirection: 'row',
    gap: 14,
  },
  exampleCard: {
    alignItems: 'center',
    aspectRatio: 1.05,
    borderRadius: 8,
    flex: 1,
    justifyContent: 'center',
    padding: 12,
  },
  badExample: {
    backgroundColor: appTheme.danger,
  },
  goodExample: {
    backgroundColor: appTheme.secondarySoft,
    borderColor: appTheme.secondary,
    borderWidth: 2,
  },
  badText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 10,
  },
  goodText: {
    color: appTheme.secondary,
    fontSize: 18,
    fontWeight: '900',
    marginTop: 10,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: appTheme.primary,
    borderRadius: 8,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '900',
    letterSpacing: 0,
  },
});
