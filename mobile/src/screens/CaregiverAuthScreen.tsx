import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { useCaregiverProfile } from '../store/useCaregiverProfile';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Shield, Lock } from 'lucide-react-native';
import { appTheme } from '../components/AppShell';

type RootStackParamList = {
  AccessibilitySettings: undefined;
  CaregiverDashboard: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'CaregiverDashboard'>;

export function CaregiverAuthScreen({ navigation }: { navigation: NavigationProp }) {
  const { profile, verifyPin, setPin, unlock, isUnlocked } = useCaregiverProfile();
  const [pin, setPinInput] = useState('');
  const [error, setError] = useState('');

  const isSetup = !profile?.caregiverPinHash;

  useEffect(() => {
    // If already unlocked, redirect to dashboard
    if (isUnlocked) {
      navigation.replace('CaregiverDashboard');
    }
  }, [isUnlocked, navigation]);

  const handleSubmit = () => {
    if (pin.length < 4) {
      setError('El PIN debe tener al menos 4 digitos.');
      return;
    }
    
    if (isSetup) {
      setPin(pin);
      unlock();
      navigation.replace('CaregiverDashboard');
    } else {
      if (verifyPin(pin)) {
        unlock();
        navigation.replace('CaregiverDashboard');
      } else {
        setError('PIN incorrecto. Intentalo de nuevo.');
        setPinInput('');
      }
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} accessibilityRole="button">
          <Text style={styles.backText}>Volver</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          {isSetup ? <Shield color={appTheme.primary} size={64} /> : <Lock color={appTheme.primary} size={64} />}
        </View>
        <Text style={styles.title}>
          {isSetup ? 'Crear PIN de Cuidador' : 'Acceso de Cuidador'}
        </Text>
        <Text style={styles.subtitle}>
          {isSetup
            ? 'Crea un PIN seguro para proteger la configuracion del perfil.'
            : 'Introduce el PIN para acceder a la configuracion.'}
        </Text>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          secureTextEntry
          maxLength={8}
          value={pin}
          onChangeText={(text) => {
            setPinInput(text);
            setError('');
          }}
          placeholder="****"
          placeholderTextColor={appTheme.muted}
          accessibilityLabel="Introduce tu PIN"
        />
        {error ? <Text style={styles.errorText} accessibilityRole="alert">{error}</Text> : null}
        <TouchableOpacity style={styles.button} onPress={handleSubmit} accessibilityRole="button">
          <Text style={styles.buttonText}>{isSetup ? 'Crear PIN' : 'Desbloquear'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: appTheme.background,
  },
  header: {
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  backButton: {
    paddingVertical: 10,
  },
  backText: {
    color: appTheme.primary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    marginTop: -50,
  },
  iconContainer: {
    backgroundColor: appTheme.primarySoft,
    padding: 20,
    borderRadius: 999,
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: appTheme.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: appTheme.muted,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  input: {
    backgroundColor: appTheme.surface,
    borderColor: appTheme.border,
    borderWidth: 1,
    borderRadius: 8,
    width: '100%',
    fontSize: 24,
    padding: 16,
    textAlign: 'center',
    letterSpacing: 8,
    marginBottom: 16,
  },
  errorText: {
    color: appTheme.dangerText,
    marginBottom: 16,
    fontWeight: 'bold',
  },
  button: {
    backgroundColor: appTheme.primary,
    width: '100%',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
