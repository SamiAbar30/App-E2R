import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Camera,
  CheckCircle2,
  HelpCircle,
  History,
  ScanLine,
  TriangleAlert,
} from 'lucide-react-native';
import { AppShell, appTheme } from '../components/AppShell';
import { useAppStore } from '../store/useAppStore';
import { useEffectiveFontScale, useInteractionAccessibility } from '../hooks/useAccessibilityEngine';
import type { ScanResult } from '../types';

type RootStackParamList = {
  Home: undefined;
  Camera: undefined;
  Result: undefined;
  AccessibilitySettings: undefined;
  History: undefined;
  ScanGuidance: { cta?: 'scan' | 'back' } | undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

export function HomeScreen({ navigation }: { navigation: NavigationProp }) {
  const { history, setResult, isOffline } = useAppStore();
  const fontScale = useEffectiveFontScale();
  const { minTouchSize } = useInteractionAccessibility();

  const openResult = (item: ScanResult) => {
    setResult(item);
    navigation.navigate('Result');
  };

  return (
    <AppShell
      title="LeerFacil"
      activeTab="home"
      onHome={() => navigation.navigate('Home')}
      onScan={() => navigation.navigate('Camera')}
      onHistory={() => navigation.navigate('History')}
      onSettings={() => navigation.navigate('AccessibilitySettings')}
    >
      <View style={styles.hero}>
        <View style={styles.heroText}>
          <Text style={[styles.heroTitle, { fontSize: 24 * Math.min(fontScale, 1.3) }]}>
            Escanea una etiqueta
          </Text>
          <Text style={[styles.heroSubtitle, { fontSize: 16 * Math.min(fontScale, 1.25) }]}>
            Coloca la lista de ingredientes dentro del marco y evita reflejos.
          </Text>
        </View>
        <View style={styles.heroIcon}>
          <ScanLine color={appTheme.primaryText} size={38} strokeWidth={2.4} />
        </View>
      </View>

      <TouchableOpacity
        style={[styles.primaryButton, { minHeight: Math.max(66, minTouchSize) }, isOffline && { backgroundColor: appTheme.muted }]}
        onPress={() => !isOffline && navigation.navigate('Camera')}
        accessibilityRole="button"
        accessibilityLabel="Escanear producto"
        disabled={isOffline}
      >
        <Camera color="#ffffff" size={24} strokeWidth={2.5} />
        <Text style={[styles.primaryButtonText, { fontSize: 16 * Math.min(fontScale, 1.25) }]}>
          {isOffline ? 'ESCANEO DESHABILITADO' : 'ESCANEAR PRODUCTO'}
        </Text>
      </TouchableOpacity>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { fontSize: 21 * Math.min(fontScale, 1.3) }]}>
          Acceso rapido
        </Text>
        <View style={styles.quickGrid}>
          <QuickAction
            icon={<ScanLine color={appTheme.primary} size={24} />}
            label="Escanear"
            onPress={() => !isOffline && navigation.navigate('Camera')}
            minTouchSize={minTouchSize}
            fontScale={fontScale}
            disabled={isOffline}
          />
          <QuickAction
            icon={<History color={appTheme.primary} size={24} />}
            label="Mis escaneos"
            onPress={() => navigation.navigate('History')}
            minTouchSize={minTouchSize}
            fontScale={fontScale}
          />
          <QuickAction
            icon={<HelpCircle color={appTheme.primary} size={24} />}
            label="Como usar"
            onPress={() => navigation.navigate('ScanGuidance', { cta: 'scan' })}
            minTouchSize={minTouchSize}
            fontScale={fontScale}
          />
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { fontSize: 21 * Math.min(fontScale, 1.3) }]}>
            Escaneos recientes
          </Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('History')}
            accessibilityRole="button"
            accessibilityLabel="Ver historial"
          >
            <Text style={styles.linkText}>Ver todo</Text>
          </TouchableOpacity>
        </View>

        {history.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <ScanLine color={appTheme.primary} size={48} strokeWidth={2.2} />
            </View>
            <Text style={[styles.emptyTitle, { fontSize: 18 * Math.min(fontScale, 1.25) }]}>
              Aun no has escaneado nada
            </Text>
            <Text style={[styles.emptyText, { fontSize: 15 * Math.min(fontScale, 1.2) }]}>
              Tus resultados apareceran aqui despues del primer analisis.
            </Text>
          </View>
        ) : (
          history.slice(0, 3).map((item, index) => (
            <HistoryRow
              key={item.id || index}
              item={item}
              onPress={() => openResult(item)}
              fontScale={fontScale}
            />
          ))
        )}
      </View>
    </AppShell>
  );
}

function QuickAction({
  icon,
  label,
  onPress,
  minTouchSize,
  fontScale,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  minTouchSize: number;
  fontScale: number;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.quickCard, { minHeight: Math.max(100, minTouchSize) }, disabled && { opacity: 0.5 }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
    >
      <View style={styles.quickIcon}>{icon}</View>
      <Text style={[styles.quickLabel, { fontSize: 13 * Math.min(fontScale, 1.25) }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function HistoryRow({
  item,
  onPress,
  fontScale,
}: {
  item: ScanResult;
  onPress: () => void;
  fontScale: number;
}) {
  const hasAllergens = item.allergensDetected?.length > 0 || (item.allergens?.length ?? 0) > 0;
  const preview = item.adaptedText?.substring(0, 54) || 'Etiqueta adaptada';
  const productLabel = item.productType === 'water' ? 'Agua' : item.productType === 'food' ? 'Alimento' : 'Etiqueta';

  return (
    <TouchableOpacity
      style={[styles.historyRow, { borderLeftColor: hasAllergens ? appTheme.danger : appTheme.secondary }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Abrir escaneo"
    >
      <View style={[styles.historyIcon, { backgroundColor: hasAllergens ? appTheme.dangerSoft : appTheme.secondarySoft }]}>
        {hasAllergens ? (
          <TriangleAlert color={appTheme.dangerText} size={22} />
        ) : (
          <CheckCircle2 color={appTheme.secondaryText} size={22} />
        )}
      </View>
      <View style={styles.historyText}>
        <Text style={[styles.historyTitle, { fontSize: 15 * Math.min(fontScale, 1.25) }]} numberOfLines={2}>
          {preview}
        </Text>
        <Text style={[styles.historyMeta, { fontSize: 12 * Math.min(fontScale, 1.2) }]}>
          {productLabel}
        </Text>
      </View>
      <Text style={[styles.statusText, { color: hasAllergens ? appTheme.dangerText : appTheme.secondaryText }]}>
        {hasAllergens ? 'Alerta' : 'Seguro'}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    backgroundColor: appTheme.primaryStrong,
    borderRadius: 8,
    flexDirection: 'row',
    gap: 18,
    minHeight: 142,
    padding: 22,
  },
  heroText: {
    flex: 1,
  },
  heroTitle: {
    color: appTheme.primaryText,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 31,
  },
  heroSubtitle: {
    color: '#d2e4ff',
    fontWeight: '600',
    lineHeight: 24,
    marginTop: 8,
  },
  heroIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: 999,
    height: 86,
    justifyContent: 'center',
    width: 86,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: appTheme.primary,
    borderRadius: 8,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '900',
    letterSpacing: 0,
  },
  section: {
    gap: 14,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: appTheme.primary,
    fontWeight: '900',
    letterSpacing: 0,
  },
  linkText: {
    color: appTheme.primary,
    fontWeight: '900',
  },
  quickGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  quickCard: {
    alignItems: 'center',
    backgroundColor: appTheme.surface,
    borderColor: '#e5e2e1',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    gap: 10,
    justifyContent: 'center',
    padding: 12,
  },
  quickIcon: {
    alignItems: 'center',
    backgroundColor: appTheme.primarySoft,
    borderRadius: 999,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  quickLabel: {
    color: appTheme.text,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: appTheme.surface,
    borderColor: '#e5e2e1',
    borderRadius: 8,
    borderWidth: 1,
    padding: 24,
  },
  emptyIcon: {
    alignItems: 'center',
    backgroundColor: appTheme.primarySoft,
    borderRadius: 999,
    height: 112,
    justifyContent: 'center',
    marginBottom: 18,
    width: 112,
  },
  emptyTitle: {
    color: appTheme.text,
    fontWeight: '900',
    textAlign: 'center',
  },
  emptyText: {
    color: appTheme.muted,
    fontWeight: '600',
    lineHeight: 22,
    marginTop: 8,
    textAlign: 'center',
  },
  historyRow: {
    alignItems: 'center',
    backgroundColor: appTheme.surface,
    borderLeftWidth: 6,
    borderRadius: 8,
    flexDirection: 'row',
    gap: 12,
    minHeight: 84,
    padding: 14,
  },
  historyIcon: {
    alignItems: 'center',
    borderRadius: 999,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  historyText: {
    flex: 1,
  },
  historyTitle: {
    color: appTheme.text,
    fontWeight: '800',
    lineHeight: 21,
  },
  historyMeta: {
    color: appTheme.muted,
    fontWeight: '700',
    marginTop: 3,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '900',
  },
});
