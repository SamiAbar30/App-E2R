import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  NativeModules,
  PermissionsAndroid,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  TurboModuleRegistry,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Camera, HelpCircle, Image as ImageIcon, RotateCcw, ScanLine, X } from 'lucide-react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { uploadLabelImage } from '../api/client';
import { AppShell, appTheme } from '../components/AppShell';
import { useEffectiveFontScale, useInteractionAccessibility } from '../hooks/useAccessibilityEngine';
import { useDocumentQuality } from '../hooks/useDocumentQuality';
import { useAppStore } from '../store/useAppStore';
import type { AcceptedDocumentImage, DocumentQualityResult, DocumentQualityState } from '../types/documentScanner';
import { createImageDataUri } from '../utils/documentImageQuality';

type RootStackParamList = {
  Home: undefined;
  Camera: undefined;
  Result: undefined;
  History: undefined;
  AccessibilitySettings: undefined;
  ScanGuidance: { cta?: 'scan' | 'back' } | undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Camera'>;

type ScanDocumentResponse = {
  scannedImages?: string[];
  status?: 'success' | 'cancel';
};

type NativeDocumentScanner = {
  scanDocument(options?: {
    croppedImageQuality?: number;
    maxNumDocuments?: number;
    responseType?: 'base64' | 'imageFilePath';
  }): Promise<ScanDocumentResponse>;
};

const stateText: Record<DocumentQualityState, { title: string; hint: string }> = {
  GOOD: {
    title: 'Imagen lista',
    hint: 'La etiqueta tiene calidad suficiente para OCR.',
  },
  BAD_BLUR: {
    title: 'Imagen borrosa',
    hint: 'Sujeta el movil con firmeza y vuelve a escanear.',
  },
  BAD_LIGHT: {
    title: 'Falta luz',
    hint: 'Acerca la etiqueta a una zona con mas luz.',
  },
  LOW_CONTRAST: {
    title: 'Texto con poco contraste',
    hint: 'Evita fondos oscuros o brillantes.',
  },
  GLARE: {
    title: 'Hay reflejos',
    hint: 'Inclina un poco el producto para quitar el brillo.',
  },
  OCCLUDED: {
    title: 'Texto tapado',
    hint: 'No cubras la etiqueta con los dedos.',
  },
  TOO_SMALL: {
    title: 'Etiqueta demasiado pequena',
    hint: 'Acerca la camara hasta que el texto ocupe mas espacio.',
  },
  BAD_PERSPECTIVE: {
    title: 'Etiqueta inclinada',
    hint: 'Pon el producto mas plano frente a la camara.',
  },
  UNSTABLE: {
    title: 'Movimiento detectado',
    hint: 'Mantente quieto durante la captura.',
  },
  UNKNOWN: {
    title: 'Calidad no confirmada',
    hint: 'Vuelve a escanear si el texto no se ve claro.',
  },
};

function cleanBase64(value: string): string {
  return value.includes(',') ? value.split(',').pop() ?? '' : value;
}

async function requestAndroidCameraPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA);
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

function getDocumentScanner(): NativeDocumentScanner | null {
  const nativeModule = NativeModules.DocumentScanner as NativeDocumentScanner | undefined;
  if (nativeModule?.scanDocument) return nativeModule;

  const turboModule = TurboModuleRegistry.get('DocumentScanner') as NativeDocumentScanner | null;
  return turboModule?.scanDocument ? turboModule : null;
}

function toSpanishQuality(quality: DocumentQualityResult) {
  return stateText[quality.state] ?? stateText.UNKNOWN;
}

export function DocumentScannerScreen({ navigation }: { navigation: NavigationProp }) {
  const { setImageUri, imageUri, setProcessing, setResult, setError, isProcessing } = useAppStore();
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [rejectedImage, setRejectedImage] = useState<AcceptedDocumentImage | null>(null);
  const [isScanning, setScanning] = useState(false);
  const autoOpened = useRef(false);

  const fontScale = useEffectiveFontScale();
  const { minTouchSize } = useInteractionAccessibility();
  const { isEvaluating, evaluateScannedDocument, resetQuality } = useDocumentQuality();

  const evaluateAndAccept = useCallback(
    async (uri: string, base64: string, width?: number, height?: number) => {
      const qualityResult = await evaluateScannedDocument({ uri, base64, width, height });
      const document: AcceptedDocumentImage = { uri, base64, width, height, quality: qualityResult };

      if (qualityResult.shouldAccept) {
        setRejectedImage(null);
        setImageUri(uri);
        setImageBase64(base64);
        return;
      }

      setImageUri(null);
      setImageBase64(null);
      setRejectedImage(document);
      const message = toSpanishQuality(qualityResult);
      Alert.alert(message.title, message.hint);
    },
    [evaluateScannedDocument, setImageUri]
  );

  const startScan = useCallback(async () => {
    const hasAndroidPermission = await requestAndroidCameraPermission();
    if (!hasAndroidPermission) {
      Alert.alert('Permiso de camara necesario', 'Activa el permiso de camara para escanear etiquetas.');
      return;
    }

    setScanning(true);
    setRejectedImage(null);
    resetQuality();

    try {
      const scanner = getDocumentScanner();
      if (!scanner) {
        Alert.alert(
          'Escaner no disponible',
          'Esta funcion necesita una build de desarrollo. No funciona dentro de Expo Go.'
        );
        return;
      }

      const response = await scanner.scanDocument({
        croppedImageQuality: 96,
        maxNumDocuments: 1,
        responseType: 'base64',
      });

      if (response.status === 'cancel') return;

      const firstImage = response.scannedImages?.[0];
      if (!firstImage) {
        Alert.alert('No se encontro etiqueta', 'Vuelve a intentarlo con la etiqueta completa dentro del marco.');
        return;
      }

      const base64 = cleanBase64(firstImage);
      await evaluateAndAccept(createImageDataUri(base64), base64);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'No se pudo escanear la etiqueta.';
      setError(message);
      Alert.alert('Error de escaneo', message);
    } finally {
      setScanning(false);
    }
  }, [evaluateAndAccept, resetQuality, setError]);

  useEffect(() => {
    if (process.env.NODE_ENV === 'test') return;
    if (autoOpened.current || imageUri) return;
    autoOpened.current = true;

    const timeout = setTimeout(() => {
      void startScan();
    }, 200);

    return () => clearTimeout(timeout);
  }, [imageUri, startScan]);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.92,
      base64: true,
    });

    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset.base64) {
      Alert.alert('Imagen no disponible', 'No se pudo leer esta imagen. Elige otra.');
      return;
    }

    await evaluateAndAccept(asset.uri, cleanBase64(asset.base64), asset.width, asset.height);
  };

  const analyzeImage = async () => {
    if (!imageUri || !imageBase64) return;

    setProcessing(true);
    try {
      const data = await uploadLabelImage(imageUri, imageBase64);
      setResult(data as any);
      navigation.navigate('Result');
    } catch (err: any) {
      const message = err?.message || 'No se pudo analizar la etiqueta.';
      setError(message);
      Alert.alert('No se pudo analizar', message);
    } finally {
      setProcessing(false);
    }
  };

  const clearPreview = () => {
    setImageUri(null);
    setImageBase64(null);
    setRejectedImage(null);
    resetQuality();
    autoOpened.current = false;
  };

  const rejectedMessage = rejectedImage ? toSpanishQuality(rejectedImage.quality) : null;

  return (
    <AppShell
      title="Escanear etiqueta"
      activeTab="scan"
      onHome={() => navigation.navigate('Home')}
      onScan={() => void startScan()}
      onHistory={() => navigation.navigate('History')}
      onSettings={() => navigation.navigate('AccessibilitySettings')}
      scroll={false}
      showBottomNav={false}
    >
      <View style={styles.screen}>
        {imageUri ? (
          <>
            <View style={styles.previewHeader}>
              <TouchableOpacity
                onPress={() => navigation.navigate('Home')}
                style={[styles.iconButton, { minHeight: minTouchSize, minWidth: minTouchSize }]}
                accessibilityRole="button"
                accessibilityLabel="Cerrar"
              >
                <X color={appTheme.text} size={26} />
              </TouchableOpacity>
              <Text style={[styles.previewTitle, { fontSize: 20 * Math.min(fontScale, 1.25) }]}>
                Imagen validada
              </Text>
              <View style={{ width: minTouchSize }} />
            </View>
            <Image source={{ uri: imageUri }} style={styles.image} accessibilityLabel="Etiqueta escaneada" />
            <View style={styles.readyCard}>
              <View style={styles.readyIcon}>
                <CheckIcon />
              </View>
              <View style={styles.readyText}>
                <Text style={[styles.readyTitle, { fontSize: 20 * Math.min(fontScale, 1.25) }]}>
                  Etiqueta lista
                </Text>
                <Text style={[styles.readyBody, { fontSize: 15 * Math.min(fontScale, 1.2) }]}>
                  La imagen paso la validacion y puede enviarse al OCR.
                </Text>
              </View>
            </View>
            {isProcessing ? (
              <View style={styles.loadingBlock}>
                <ActivityIndicator size="large" color={appTheme.primary} />
                <Text style={styles.loadingText}>Analizando etiqueta...</Text>
              </View>
            ) : (
              <View style={styles.actionRow}>
                <TouchableOpacity
                  onPress={() => {
                    clearPreview();
                    void startScan();
                  }}
                  style={[styles.secondaryButton, { minHeight: Math.max(60, minTouchSize) }]}
                  accessibilityRole="button"
                  accessibilityLabel="Escanear otra vez"
                >
                  <RotateCcw color={appTheme.text} size={22} />
                  <Text style={styles.secondaryButtonText}>Repetir</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={analyzeImage}
                  style={[styles.primaryButton, { minHeight: Math.max(60, minTouchSize) }]}
                  accessibilityRole="button"
                  accessibilityLabel="Analizar etiqueta"
                >
                  <ScanLine color="#ffffff" size={22} />
                  <Text style={styles.primaryButtonText}>Analizar</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        ) : (
          <View style={styles.launchPanel}>
            <View style={styles.scanIcon}>
              {isScanning || isEvaluating ? (
                <ActivityIndicator size="large" color={appTheme.primary} />
              ) : (
                <ScanLine color={appTheme.primary} size={54} strokeWidth={2.2} />
              )}
            </View>
            <Text style={[styles.launchTitle, { fontSize: 24 * Math.min(fontScale, 1.25) }]}>
              {isScanning || isEvaluating ? 'Validando imagen' : 'Escaner de etiquetas'}
            </Text>
            <Text style={[styles.launchText, { fontSize: 16 * Math.min(fontScale, 1.2) }]}>
              {isScanning || isEvaluating
                ? 'Espera un momento. Revisamos nitidez, luz y encuadre.'
                : 'Se abrira el escaner de documentos. Usa una foto clara de la etiqueta del producto.'}
            </Text>
            {rejectedMessage && (
              <View style={styles.errorCard}>
                <Text style={styles.errorTitle}>{rejectedMessage.title}</Text>
                <Text style={styles.errorText}>{rejectedMessage.hint}</Text>
              </View>
            )}
            <View style={styles.launchActions}>
              <TouchableOpacity
                onPress={() => void startScan()}
                disabled={isScanning || isEvaluating}
                style={[styles.primaryButtonWide, { minHeight: Math.max(62, minTouchSize) }]}
                accessibilityRole="button"
                accessibilityLabel="Abrir escaner"
                accessibilityState={{ disabled: isScanning || isEvaluating }}
              >
                <Camera color="#ffffff" size={22} />
                <Text style={styles.primaryButtonText}>Abrir escaner</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={pickImage}
                disabled={isScanning || isEvaluating}
                style={[styles.secondaryButtonWide, { minHeight: Math.max(58, minTouchSize) }]}
                accessibilityRole="button"
                accessibilityLabel="Elegir de galeria"
              >
                <ImageIcon color={appTheme.primary} size={22} />
                <Text style={styles.secondaryButtonText}>Galeria</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => navigation.navigate('ScanGuidance', { cta: 'back' })}
                style={[styles.textButton, { minHeight: minTouchSize }]}
                accessibilityRole="button"
                accessibilityLabel="Como escanear bien"
              >
                <HelpCircle color={appTheme.primary} size={20} />
                <Text style={styles.textButtonLabel}>Como escanear bien</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </AppShell>
  );
}

function CheckIcon() {
  return <Text style={styles.checkText}>OK</Text>;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    gap: 14,
  },
  previewHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  iconButton: {
    alignItems: 'center',
    borderRadius: 999,
    justifyContent: 'center',
  },
  previewTitle: {
    color: appTheme.text,
    fontWeight: '900',
  },
  image: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    flex: 1,
    resizeMode: 'contain',
  },
  readyCard: {
    alignItems: 'flex-start',
    backgroundColor: appTheme.surface,
    borderColor: appTheme.secondary,
    borderRadius: 8,
    borderWidth: 2,
    flexDirection: 'row',
    gap: 12,
    padding: 16,
  },
  readyIcon: {
    alignItems: 'center',
    backgroundColor: appTheme.secondarySoft,
    borderRadius: 999,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  checkText: {
    color: appTheme.secondaryText,
    fontSize: 13,
    fontWeight: '900',
  },
  readyText: {
    flex: 1,
  },
  readyTitle: {
    color: appTheme.text,
    fontWeight: '900',
  },
  readyBody: {
    color: appTheme.muted,
    fontWeight: '600',
    lineHeight: 22,
    marginTop: 4,
  },
  loadingBlock: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  loadingText: {
    color: appTheme.text,
    fontWeight: '800',
    marginTop: 8,
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
  launchPanel: {
    alignItems: 'center',
    backgroundColor: appTheme.surface,
    borderColor: '#e5e2e1',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  scanIcon: {
    alignItems: 'center',
    backgroundColor: appTheme.primarySoft,
    borderRadius: 999,
    height: 132,
    justifyContent: 'center',
    marginBottom: 24,
    width: 132,
  },
  launchTitle: {
    color: appTheme.text,
    fontWeight: '900',
    textAlign: 'center',
  },
  launchText: {
    color: appTheme.muted,
    fontWeight: '600',
    lineHeight: 24,
    marginTop: 10,
    textAlign: 'center',
  },
  errorCard: {
    backgroundColor: appTheme.dangerSoft,
    borderColor: appTheme.danger,
    borderLeftWidth: 6,
    borderRadius: 8,
    marginTop: 18,
    padding: 14,
    width: '100%',
  },
  errorTitle: {
    color: appTheme.dangerText,
    fontSize: 17,
    fontWeight: '900',
  },
  errorText: {
    color: appTheme.text,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
    marginTop: 4,
  },
  launchActions: {
    gap: 12,
    marginTop: 28,
    width: '100%',
  },
  primaryButtonWide: {
    alignItems: 'center',
    backgroundColor: appTheme.primary,
    borderRadius: 8,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
  },
  secondaryButtonWide: {
    alignItems: 'center',
    backgroundColor: appTheme.primarySoft,
    borderColor: appTheme.primary,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
  },
  textButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  textButtonLabel: {
    color: appTheme.primary,
    fontWeight: '900',
  },
});
