import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Camera, CheckCircle2, ScanLine, TriangleAlert } from 'lucide-react-native';
import { AppShell, appTheme } from '../components/AppShell';
import { useAppStore } from '../store/useAppStore';
import { useEffectiveFontScale, useInteractionAccessibility } from '../hooks/useAccessibilityEngine';
import type { ScanResult } from '../types';

type RootStackParamList = {
  Home: undefined;
  Camera: undefined;
  Result: undefined;
  History: undefined;
  AccessibilitySettings: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'History'>;
type Filter = 'all' | 'allergens' | 'water' | 'food';

export function HistoryScreen({ navigation }: { navigation: NavigationProp }) {
  const { history } = useAppStore();
  const [filter, setFilter] = useState<Filter>('all');
  const fontScale = useEffectiveFontScale();
  const { minTouchSize } = useInteractionAccessibility();

  const filteredHistory = useMemo(() => history.filter(item => {
    const hasAllergens = item.allergensDetected?.length > 0 || (item.allergens?.length ?? 0) > 0;
    if (filter === 'allergens') return hasAllergens;
    if (filter === 'water') return item.productType === 'water';
    if (filter === 'food') return item.productType === 'food';
    return true;
  }), [filter, history]);

  const openItem = (item: ScanResult) => {
    useAppStore.setState({ result: item, isProcessing: false, error: null });
    navigation.navigate('Result');
  };

  return (
    <AppShell
      title="Mis escaneos"
      activeTab="history"
      onHome={() => navigation.navigate('Home')}
      onScan={() => navigation.navigate('Camera')}
      onHistory={() => navigation.navigate('History')}
      onSettings={() => navigation.navigate('AccessibilitySettings')}
    >
      {history.length === 0 ? (
        <View style={styles.emptyCard}>
          <View style={styles.emptyIcon}>
            <ScanLine color={appTheme.primary} size={72} strokeWidth={2.1} />
          </View>
          <Text style={[styles.emptyTitle, { fontSize: 22 * Math.min(fontScale, 1.3) }]}>
            Aun no has escaneado nada
          </Text>
          <Text style={[styles.emptyText, { fontSize: 16 * Math.min(fontScale, 1.2) }]}>
            Escanea un producto para ver los resultados aqui.
          </Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('Camera')}
            style={[styles.primaryButton, { minHeight: Math.max(64, minTouchSize) }]}
            accessibilityRole="button"
            accessibilityLabel="Escanear ahora"
          >
            <Camera color="#ffffff" size={22} />
            <Text style={styles.primaryButtonText}>ESCANEAR AHORA</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <View style={styles.filterRow}>
            <FilterButton label="Todos" active={filter === 'all'} onPress={() => setFilter('all')} />
            <FilterButton label="Alergenos" active={filter === 'allergens'} onPress={() => setFilter('allergens')} />
            <FilterButton label="Agua" active={filter === 'water'} onPress={() => setFilter('water')} />
            <FilterButton label="Alimentos" active={filter === 'food'} onPress={() => setFilter('food')} />
          </View>

          {filteredHistory.length === 0 ? (
            <View style={styles.emptySmall}>
              <Text style={styles.emptySmallText}>No hay escaneos para este filtro.</Text>
            </View>
          ) : (
            filteredHistory.map((item, index) => (
              <HistoryItem key={item.id || index} item={item} onPress={() => openItem(item)} fontScale={fontScale} />
            ))
          )}
        </>
      )}
    </AppShell>
  );
}

function FilterButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.filterButton, active && styles.filterButtonActive]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.filterText, active && styles.filterTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function HistoryItem({
  item,
  onPress,
  fontScale,
}: {
  item: ScanResult;
  onPress: () => void;
  fontScale: number;
}) {
  const hasAllergens = item.allergensDetected?.length > 0 || (item.allergens?.length ?? 0) > 0;
  const previewText = item.adaptedText?.substring(0, 64) || 'Etiqueta adaptada';
  const date = item.date ? new Date(item.date).toLocaleDateString() : 'Reciente';
  const product = item.productType === 'water' ? 'Agua' : item.productType === 'food' ? 'Alimento' : 'Etiqueta';

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.historyItem, { borderLeftColor: hasAllergens ? appTheme.danger : appTheme.secondary }]}
      accessibilityRole="button"
      accessibilityLabel="Abrir escaneo"
    >
      <View style={[styles.itemIcon, { backgroundColor: hasAllergens ? appTheme.dangerSoft : appTheme.secondarySoft }]}>
        {hasAllergens ? (
          <TriangleAlert color={appTheme.dangerText} size={24} />
        ) : (
          <CheckCircle2 color={appTheme.secondaryText} size={24} />
        )}
      </View>
      <View style={styles.itemText}>
        <Text style={[styles.itemTitle, { fontSize: 16 * Math.min(fontScale, 1.25) }]} numberOfLines={2}>
          {previewText}
        </Text>
        <Text style={styles.itemMeta}>{product} - {date}</Text>
      </View>
      <Text style={[styles.status, { color: hasAllergens ? appTheme.dangerText : appTheme.secondaryText }]}>
        {hasAllergens ? 'Alerta' : 'Seguro'}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  emptyCard: {
    alignItems: 'center',
    backgroundColor: appTheme.surface,
    borderColor: '#e5e2e1',
    borderRadius: 8,
    borderWidth: 1,
    padding: 28,
  },
  emptyIcon: {
    alignItems: 'center',
    backgroundColor: appTheme.primarySoft,
    borderRadius: 999,
    height: 172,
    justifyContent: 'center',
    marginBottom: 24,
    width: 172,
  },
  emptyTitle: {
    color: appTheme.text,
    fontWeight: '900',
    textAlign: 'center',
  },
  emptyText: {
    color: appTheme.muted,
    fontWeight: '600',
    lineHeight: 24,
    marginTop: 10,
    textAlign: 'center',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: appTheme.primary,
    borderRadius: 8,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    marginTop: 28,
    paddingHorizontal: 24,
    width: '100%',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '900',
    letterSpacing: 0,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  filterButton: {
    backgroundColor: '#f0eded',
    borderColor: appTheme.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  filterButtonActive: {
    backgroundColor: appTheme.primary,
    borderColor: appTheme.primary,
  },
  filterText: {
    color: '#414750',
    fontWeight: '900',
  },
  filterTextActive: {
    color: '#ffffff',
  },
  emptySmall: {
    alignItems: 'center',
    backgroundColor: appTheme.surface,
    borderRadius: 8,
    padding: 22,
  },
  emptySmallText: {
    color: appTheme.muted,
    fontWeight: '800',
  },
  historyItem: {
    alignItems: 'center',
    backgroundColor: appTheme.surface,
    borderLeftWidth: 6,
    borderRadius: 8,
    flexDirection: 'row',
    gap: 12,
    minHeight: 88,
    padding: 14,
  },
  itemIcon: {
    alignItems: 'center',
    borderRadius: 999,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  itemText: {
    flex: 1,
  },
  itemTitle: {
    color: appTheme.text,
    fontWeight: '800',
    lineHeight: 22,
  },
  itemMeta: {
    color: appTheme.muted,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
  },
  status: {
    fontSize: 12,
    fontWeight: '900',
  },
});
