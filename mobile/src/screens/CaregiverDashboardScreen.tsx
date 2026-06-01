import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert } from 'react-native';
import { useCaregiverProfile } from '../store/useCaregiverProfile';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Shield, Lock, Trash2, Plus, AlertTriangle } from 'lucide-react-native';
import { AppShell, appTheme } from '../components/AppShell';

type RootStackParamList = {
  AccessibilitySettings: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'AccessibilitySettings'>;

export function CaregiverDashboardScreen({ navigation }: { navigation: NavigationProp }) {
  const { profile, setRestrictedAllergens, lock, wipeProfile } = useCaregiverProfile();
  const [newAllergen, setNewAllergen] = useState('');

  const handleAddAllergen = () => {
    if (!newAllergen.trim()) return;
    const allergen = newAllergen.trim().toLowerCase();
    if (!profile?.restrictedAllergenIds.includes(allergen)) {
      setRestrictedAllergens([...(profile?.restrictedAllergenIds || []), allergen]);
    }
    setNewAllergen('');
  };

  const handleRemoveAllergen = (allergen: string) => {
    const updated = profile?.restrictedAllergenIds.filter(a => a !== allergen) || [];
    setRestrictedAllergens(updated);
  };

  const handleLock = () => {
    lock();
    navigation.goBack();
  };

  const handleReset = () => {
    Alert.alert(
      "Resetear perfil",
      "Esto borrara tu PIN y todos los alergenos y avisos. ¿Continuar?",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Borrar todo", style: "destructive", onPress: () => {
            wipeProfile();
            navigation.goBack();
        }}
      ]
    );
  };

  return (
    <AppShell
      title="Perfil de Cuidador"
      activeTab="settings"
      onHome={() => navigation.navigate('AccessibilitySettings')}
      onScan={() => {}}
      onHistory={() => {}}
      onSettings={() => {}}
      showBottomNav={false}
      rightAction={
        <TouchableOpacity style={styles.iconButton} onPress={handleLock} accessibilityRole="button" accessibilityLabel="Bloquear perfil">
          <Lock color={appTheme.primaryStrong} size={25} strokeWidth={2.5} />
        </TouchableOpacity>
      }
    >
      <View style={styles.headerBox}>
        <Shield color={appTheme.primary} size={48} />
        <Text style={styles.headerTitle}>Panel de Cuidador</Text>
        <Text style={styles.headerSubtitle}>Gestiona restricciones para el usuario.</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ALERGENOS RESTRINGIDOS</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Ej: gluten, leche, frutos secos"
            value={newAllergen}
            onChangeText={setNewAllergen}
          />
          <TouchableOpacity style={styles.addButton} onPress={handleAddAllergen} accessibilityRole="button">
            <Plus color="#fff" size={24} />
          </TouchableOpacity>
        </View>

        <View style={styles.allergensList}>
          {profile?.restrictedAllergenIds.length === 0 ? (
            <Text style={styles.emptyText}>No hay alergenos restringidos.</Text>
          ) : (
            profile?.restrictedAllergenIds.map(allergen => (
              <View key={allergen} style={styles.allergenItem}>
                <AlertTriangle color={appTheme.danger} size={20} />
                <Text style={styles.allergenText}>{allergen}</Text>
                <TouchableOpacity onPress={() => handleRemoveAllergen(allergen)} accessibilityRole="button">
                  <Trash2 color={appTheme.muted} size={20} />
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>AJUSTES DE SEGURIDAD</Text>
        <TouchableOpacity style={styles.dangerButton} onPress={handleReset} accessibilityRole="button">
          <Trash2 color={appTheme.dangerText} size={20} />
          <Text style={styles.dangerText}>Eliminar Perfil y PIN</Text>
        </TouchableOpacity>
      </View>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  iconButton: {
    padding: 8,
  },
  headerBox: {
    alignItems: 'center',
    backgroundColor: appTheme.primarySoft,
    padding: 24,
    borderRadius: 12,
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: appTheme.primary,
    marginTop: 12,
  },
  headerSubtitle: {
    fontSize: 15,
    color: appTheme.muted,
    marginTop: 4,
    textAlign: 'center',
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: appTheme.muted,
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  input: {
    flex: 1,
    backgroundColor: appTheme.surface,
    borderWidth: 1,
    borderColor: appTheme.border,
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  addButton: {
    backgroundColor: appTheme.primary,
    width: 52,
    height: 52,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  allergensList: {
    gap: 10,
  },
  allergenItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: appTheme.surface,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: appTheme.border,
    gap: 12,
  },
  allergenText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: appTheme.text,
    textTransform: 'capitalize',
  },
  emptyText: {
    color: appTheme.muted,
    fontStyle: 'italic',
    padding: 12,
  },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: appTheme.dangerSoft,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(198, 40, 40, 0.2)',
  },
  dangerText: {
    color: appTheme.dangerText,
    fontSize: 16,
    fontWeight: 'bold',
  },
});
