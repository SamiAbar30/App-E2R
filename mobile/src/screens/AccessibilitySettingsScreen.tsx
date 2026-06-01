import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Check, Contrast, Eye, Hand, Lock, Shield, Type, User, ZoomIn } from 'lucide-react-native';
import { AppShell, appTheme } from '../components/AppShell';
import {
  useAccessibilityOverrides,
  useApplyDisabilityPreset,
  useEffectiveFontScale,
  useInteractionAccessibility,
  useResetOverrides,
  useUpdateOverrides,
  type ContrastMode,
} from '../hooks/useAccessibilityEngine';

type RootStackParamList = {
  Home: undefined;
  Camera: undefined;
  History: undefined;
  AccessibilitySettings: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'AccessibilitySettings'>;

const FONT_OPTIONS = [
  { label: 'A', value: 1.0, size: 15, accessibilityLabel: 'Texto pequeno' },
  { label: 'A', value: 1.3, size: 19, accessibilityLabel: 'Texto mediano' },
  { label: 'A', value: 1.6, size: 23, accessibilityLabel: 'Texto grande' },
  { label: 'A', value: 1.9, size: 27, accessibilityLabel: 'Texto muy grande' },
] as const;

const isHighContrast = (mode: ContrastMode) => mode !== 'Normal';

export function AccessibilitySettingsScreen({ navigation }: { navigation: NavigationProp }) {
  const overrides = useAccessibilityOverrides();
  const applyPreset = useApplyDisabilityPreset();
  const resetOverrides = useResetOverrides();
  const updateOverrides = useUpdateOverrides();
  const fontScale = useEffectiveFontScale();
  const { minTouchSize, reduceMotion } = useInteractionAccessibility();

  const selectTemplate = (template: 'standard' | 'visual' | 'contrast' | 'simple') => {
    if (template === 'standard') {
      resetOverrides();
      return;
    }
    if (template === 'visual') {
      applyPreset('Visual');
      return;
    }
    if (template === 'contrast') {
      updateOverrides({
        contrastMode: 'HighContrastDark',
        fontPolicy: 'highLegibility',
        fontSizeMultiplier: Math.max(overrides.fontSizeMultiplier, 1.3),
      });
      return;
    }
    applyPreset('Cognitive');
  };

  const selectedFont = FONT_OPTIONS.reduce((best, option) => (
    Math.abs(option.value - overrides.fontSizeMultiplier) < Math.abs(best.value - overrides.fontSizeMultiplier)
      ? option
      : best
  ), FONT_OPTIONS[0]);

  return (
    <AppShell
      title="Accesibilidad"
      activeTab="settings"
      onHome={() => navigation.navigate('Home')}
      onScan={() => navigation.navigate('Camera')}
      onHistory={() => navigation.navigate('History')}
      onSettings={() => navigation.navigate('AccessibilitySettings')}
    >
      <Text style={styles.sectionLabel}>PLANTILLA VISUAL</Text>
      <View style={styles.templateGrid}>
        <TemplateCard
          title="Estandar"
          subtitle="Vista predeterminada"
          icon={<Eye color={appTheme.primary} size={24} />}
          selected={overrides.fontSizeMultiplier === 1 && overrides.contrastMode === 'Normal' && !overrides.chunkedReading}
          onPress={() => selectTemplate('standard')}
          accessibilityLabel="Aplicar perfil estandar"
        />
        <TemplateCard
          title="Vision reducida"
          subtitle="Elementos mas grandes"
          icon={<ZoomIn color={appTheme.primary} size={24} />}
          selected={overrides.fontSizeMultiplier >= 1.7 && isHighContrast(overrides.contrastMode)}
          onPress={() => selectTemplate('visual')}
          accessibilityLabel="Aplicar perfil visual"
        />
        <TemplateCard
          title="Alto contraste"
          subtitle="Colores oscuros"
          icon={<Contrast color={appTheme.primary} size={24} />}
          selected={isHighContrast(overrides.contrastMode) && overrides.fontSizeMultiplier < 1.7}
          onPress={() => selectTemplate('contrast')}
          accessibilityLabel="Aplicar alto contraste"
        />
        <TemplateCard
          title="Modo simple"
          subtitle="Solo lo esencial"
          icon={<User color={appTheme.primary} size={24} />}
          selected={overrides.chunkedReading}
          onPress={() => selectTemplate('simple')}
          accessibilityLabel="Aplicar perfil cognitivo"
        />
      </View>

      <Text style={styles.sectionLabel}>TAMANO DE TEXTO</Text>
      <View style={styles.segment}>
        {FONT_OPTIONS.map(option => {
          const selected = selectedFont.value === option.value;
          return (
            <TouchableOpacity
              key={option.value}
              onPress={() => updateOverrides({ fontSizeMultiplier: option.value })}
              style={[styles.fontOption, selected && styles.fontOptionSelected, { minHeight: minTouchSize }]}
              accessibilityRole="button"
              accessibilityLabel={option.accessibilityLabel}
              accessibilityState={{ selected }}
            >
              <Text style={[styles.fontOptionText, selected && styles.fontOptionTextSelected, { fontSize: option.size }]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.previewBox}>
        <Type color={appTheme.primary} size={22} />
        <Text style={[styles.previewText, { fontSize: 18 * fontScale }]}>
          Asi se vera el texto en los resultados.
        </Text>
      </View>

      <Text style={styles.sectionLabel}>INTERACCION</Text>
      <TouchableOpacity
        onPress={() => applyPreset('Motor')}
        style={[styles.motorCard, { minHeight: minTouchSize + 28 }]}
        accessibilityRole="button"
        accessibilityLabel="Aplicar perfil motor"
      >
        <View style={styles.iconCircle}>
          <Hand color={appTheme.primary} size={24} />
        </View>
        <View style={styles.motorText}>
          <Text style={styles.templateTitle}>Perfil motor</Text>
          <Text style={styles.templateSubtitle}>Botones grandes y toques mas seguros</Text>
        </View>
        {overrides.touchTargetSize >= 64 && <Check color={appTheme.primary} size={22} />}
      </TouchableOpacity>

      <Text style={styles.sectionLabel}>IDIOMA</Text>
      <View style={[styles.languagePill, { minHeight: minTouchSize }]}>
        <Text style={styles.languageText}>Espanol</Text>
        <Lock color={appTheme.muted} size={18} />
      </View>

      <Text style={styles.sectionLabel}>PERFIL DE CUIDADOR</Text>
      <TouchableOpacity
        onPress={() => navigation.navigate('CaregiverAuth' as any)}
        style={[styles.motorCard, { minHeight: minTouchSize + 28, marginBottom: 20 }]}
        accessibilityRole="button"
        accessibilityLabel="Acceder al perfil de cuidador"
      >
        <View style={styles.iconCircle}>
          <Shield color={appTheme.primary} size={24} />
        </View>
        <View style={styles.motorText}>
          <Text style={styles.templateTitle}>Cuidador</Text>
          <Text style={styles.templateSubtitle}>Gestionar restricciones y seguridad</Text>
        </View>
      </TouchableOpacity>

      <View style={styles.currentCard}>
        <Text style={styles.currentTitle}>Configuracion actual</Text>
        <Text style={styles.currentText}>Tamano de texto: {overrides.fontSizeMultiplier}</Text>
        <Text style={styles.currentText}>Contraste: {overrides.contrastMode}</Text>
        <Text style={styles.currentText}>Tamano de boton: {overrides.touchTargetSize}</Text>
        <Text style={styles.currentText}>Margen de toque: {overrides.debounceMargin}</Text>
        <Text style={styles.currentText}>Reducir movimiento: {reduceMotion ? 'Si' : 'No'}</Text>
      </View>
    </AppShell>
  );
}

function TemplateCard({
  title,
  subtitle,
  icon,
  selected,
  onPress,
  accessibilityLabel,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  selected: boolean;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.templateCard, selected && styles.templateCardSelected]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected }}
    >
      <View style={styles.iconCircle}>{icon}</View>
      <Text style={styles.templateTitle}>{title}</Text>
      <Text style={styles.templateSubtitle}>{subtitle}</Text>
      <View style={[styles.checkSlot, selected && styles.checkSlotSelected]}>
        {selected && <Check color="#ffffff" size={16} strokeWidth={3} />}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  sectionLabel: {
    color: appTheme.muted,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0,
  },
  templateGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  templateCard: {
    backgroundColor: appTheme.surface,
    borderColor: 'transparent',
    borderRadius: 8,
    borderWidth: 2,
    flexBasis: '47%',
    flexGrow: 1,
    minHeight: 132,
    padding: 14,
    position: 'relative',
  },
  templateCardSelected: {
    borderColor: appTheme.primary,
  },
  iconCircle: {
    alignItems: 'center',
    backgroundColor: appTheme.primarySoft,
    borderRadius: 999,
    height: 48,
    justifyContent: 'center',
    marginBottom: 12,
    width: 48,
  },
  templateTitle: {
    color: appTheme.text,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0,
  },
  templateSubtitle: {
    color: appTheme.muted,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: 4,
  },
  checkSlot: {
    alignItems: 'center',
    borderColor: appTheme.border,
    borderRadius: 999,
    borderWidth: 2,
    height: 24,
    justifyContent: 'center',
    position: 'absolute',
    right: 12,
    top: 12,
    width: 24,
  },
  checkSlotSelected: {
    backgroundColor: appTheme.primary,
    borderColor: appTheme.primary,
  },
  segment: {
    backgroundColor: appTheme.surface,
    borderColor: appTheme.border,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  fontOption: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  fontOptionSelected: {
    backgroundColor: appTheme.primary,
  },
  fontOptionText: {
    color: appTheme.text,
    fontWeight: '900',
  },
  fontOptionTextSelected: {
    color: '#ffffff',
  },
  previewBox: {
    alignItems: 'center',
    backgroundColor: appTheme.primarySoft,
    borderColor: appTheme.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 18,
  },
  previewText: {
    color: appTheme.text,
    flex: 1,
    fontWeight: '700',
    lineHeight: 28,
  },
  motorCard: {
    alignItems: 'center',
    backgroundColor: appTheme.surface,
    borderColor: appTheme.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    padding: 14,
  },
  motorText: {
    flex: 1,
  },
  languagePill: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#f0eded',
    borderColor: appTheme.border,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 18,
  },
  languageText: {
    color: appTheme.muted,
    fontWeight: '900',
  },
  currentCard: {
    backgroundColor: appTheme.surface,
    borderColor: appTheme.border,
    borderRadius: 8,
    borderWidth: 1,
    padding: 16,
  },
  currentTitle: {
    color: appTheme.text,
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 8,
  },
  currentText: {
    color: appTheme.muted,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 5,
  },
});
