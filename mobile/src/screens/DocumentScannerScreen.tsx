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
import { ArrowLeft, Camera, Image as ImageIcon, RotateCcw, ScanLine } from 'lucide-react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { uploadLabelImage } from '../api/client';
import {
  useContrastPalette,
  useEffectiveFontScale,
  useInteractionAccessibility,
} from '../hooks/useAccessibilityEngine';
import { useDocumentQuality } from '../hooks/useDocumentQuality';
import { useAppStore } from '../store/useAppStore';
import type { AcceptedDocumentImage } from '../types/documentScanner';
import { createImageDataUri } from '../utils/documentImageQuality';

type RootStackParamList = {
  Result: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Result'>;

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

export function DocumentScannerScreen({ navigation }: { navigation: NavigationProp }) {
  const { setImageUri, imageUri, setProcessing, setResult, setError, isProcessing } = useAppStore();
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [rejectedImage, setRejectedImage] = useState<AcceptedDocumentImage | null>(null);
  const [isScanning, setScanning] = useState(false);
  const autoOpened = useRef(false);

  const palette = useContrastPalette();
  const fontScale = useEffectiveFontScale();
  const { minTouchSize } = useInteractionAccessibility();
  const { isEvaluating, evaluateScannedDocument, resetQuality } = useDocumentQuality();

  const acceptImage = useCallback(
    (document: AcceptedDocumentImage) => {
      setRejectedImage(null);
      setImageUri(document.uri);
      setImageBase64(document.base64);
    },
    [setImageUri]
  );

  const evaluateAndAccept = useCallback(
    async (uri: string, base64: string, width?: number, height?: number) => {
      const qualityResult = await evaluateScannedDocument({ uri, base64, width, height });
      const document: AcceptedDocumentImage = {
        uri,
        base64,
        width,
        height,
        quality: qualityResult,
      };

      if (qualityResult.shouldAccept) {
        acceptImage(document);
        return;
      }

      setRejectedImage(document);
      Alert.alert(qualityResult.message, qualityResult.hint);
    },
    [acceptImage, evaluateScannedDocument]
  );

  const startScan = useCallback(async () => {
    const hasAndroidPermission = await requestAndroidCameraPermission();
    if (!hasAndroidPermission) {
      Alert.alert('Camera permission needed', 'Camera access is required to scan documents.');
      return;
    }

    setScanning(true);
    setRejectedImage(null);
    resetQuality();

    try {
      const scanner = getDocumentScanner();
      if (!scanner) {
        Alert.alert(
          'Scanner build needed',
          'The native document scanner is not available in this app build. Run npx expo prebuild and npx expo run:android, then test again outside Expo Go.'
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
        Alert.alert('No document found', 'Try again with the document fully visible.');
        return;
      }

      const base64 = cleanBase64(firstImage);
      await evaluateAndAccept(createImageDataUri(base64), base64);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Document scan failed.';
      setError(message);
      Alert.alert('Scanner error', message);
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
    }, 250);

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
      Alert.alert('Image unavailable', 'Could not read this image. Please choose another one.');
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
      setError(err.message);
      Alert.alert('Error analyzing image', 'Make sure the backend is running and try again.');
    } finally {
      setProcessing(false);
    }
  };

  const retake = () => {
    setImageUri(null);
    setImageBase64(null);
    setRejectedImage(null);
    resetQuality();
    void startScan();
  };

  const canUseRejected = rejectedImage?.base64 && rejectedImage?.uri;

  return (
    <View style={[styles.container, { backgroundColor: imageUri ? palette.background : '#000000' }]}>
      {imageUri ? (
        <View style={styles.previewContainer}>
          <Image source={{ uri: imageUri }} style={styles.image} accessibilityLabel="Scanned document" />

          {isProcessing ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={palette.accent} />
              <Text style={[styles.loadingText, { color: palette.text, fontSize: 16 * fontScale }]}>
                Analyzing...
              </Text>
            </View>
          ) : (
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[
                  styles.button,
                  {
                    backgroundColor: palette.background,
                    borderColor: palette.border,
                    borderWidth: 1,
                    minHeight: minTouchSize,
                  },
                ]}
                onPress={retake}
                accessibilityRole="button"
                accessibilityLabel="Scan again"
              >
                <RotateCcw color={palette.text} size={20} />
                <Text style={[styles.buttonText, { color: palette.text, fontSize: 16 * fontScale }]}>
                  Scan again
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: palette.accent, minHeight: minTouchSize }]}
                onPress={analyzeImage}
                accessibilityRole="button"
                accessibilityLabel="Analyze scan"
              >
                <ScanLine color={palette.background} size={20} />
                <Text style={[styles.buttonText, { color: palette.background, fontSize: 16 * fontScale }]}>
                  Analyze
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      ) : (
        <View style={styles.launcher}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <ArrowLeft color="#ffffff" size={32} strokeWidth={2.6} />
          </TouchableOpacity>

          {rejectedImage ? (
            <View style={styles.rejectedCard}>
              <Text style={[styles.rejectedTitle, { fontSize: 16 * fontScale }]}>
                {rejectedImage.quality.message}
              </Text>
              <Text style={[styles.rejectedHint, { fontSize: 13 * fontScale }]}>
                {rejectedImage.quality.hint}
              </Text>
            </View>
          ) : null}

          {(isScanning || isEvaluating) && (
            <View style={styles.inlineLoading}>
              <ActivityIndicator color="#ffffff" />
            </View>
          )}

          <View style={styles.bottomControls}>
            <TouchableOpacity
              style={[styles.galleryButton, { minWidth: minTouchSize, minHeight: minTouchSize }]}
              onPress={pickImage}
              accessibilityRole="button"
              accessibilityLabel="Pick from Gallery"
            >
              <ImageIcon color="#ffffff" size={28} strokeWidth={2.4} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.shutterButton,
                { width: Math.max(78, minTouchSize + 30), height: Math.max(78, minTouchSize + 30) },
              ]}
              onPress={startScan}
              disabled={isScanning || isEvaluating}
              accessibilityRole="button"
              accessibilityLabel="Scan document"
              accessibilityState={{ disabled: isScanning || isEvaluating }}
            >
              <View style={[styles.shutterInner, (isScanning || isEvaluating) && styles.shutterInnerBusy]}>
                {isScanning || isEvaluating ? (
                  <ActivityIndicator color="#2b2d42" />
                ) : (
                  <Camera color="#2b2d42" size={30} strokeWidth={2.5} />
                )}
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.useAnywayButton,
                {
                  minWidth: minTouchSize,
                  minHeight: minTouchSize,
                  opacity: canUseRejected ? 1 : 0,
                },
              ]}
              disabled={!canUseRejected}
              onPress={() => {
                if (rejectedImage) acceptImage(rejectedImage);
              }}
              accessibilityRole="button"
              accessibilityLabel="Use scan anyway"
              accessibilityState={{ disabled: !canUseRejected }}
            >
              <Text style={styles.useAnywayText}>Use</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  previewContainer: { flex: 1, padding: 16 },
  image: { flex: 1, borderRadius: 8, marginBottom: 12, resizeMode: 'contain' },
  loadingContainer: { alignItems: 'center', padding: 24 },
  loadingText: { marginTop: 8, textAlign: 'center' },
  actionRow: { flexDirection: 'row', justifyContent: 'space-around', paddingBottom: 24, gap: 12 },
  button: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  buttonText: { fontWeight: '800' },
  launcher: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'flex-end',
  },
  closeButton: {
    position: 'absolute',
    top: 42,
    left: 22,
    width: 54,
    height: 54,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.42)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  rejectedCard: {
    position: 'absolute',
    left: 24,
    right: 24,
    top: 112,
    borderRadius: 8,
    padding: 14,
    backgroundColor: 'rgba(239,35,60,0.88)',
  },
  rejectedTitle: { color: '#ffffff', fontWeight: '900', textAlign: 'center' },
  rejectedHint: { color: '#ffffff', marginTop: 4, textAlign: 'center' },
  inlineLoading: {
    position: 'absolute',
    top: '46%',
    alignSelf: 'center',
    alignItems: 'center',
    borderRadius: 999,
    padding: 16,
    backgroundColor: 'rgba(0,0,0,0.58)',
  },
  bottomControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 28,
    paddingBottom: 34,
  },
  galleryButton: {
    borderRadius: 8,
    backgroundColor: 'rgba(43,45,66,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterButton: {
    borderRadius: 999,
    borderWidth: 4,
    borderColor: '#ffffff',
    backgroundColor: 'rgba(255,255,255,0.24)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 58,
    height: 58,
    borderRadius: 999,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInnerBusy: {
    opacity: 0.82,
  },
  useAnywayButton: {
    borderRadius: 8,
    backgroundColor: 'rgba(43,45,66,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  useAnywayText: {
    color: '#ffffff',
    fontWeight: '900',
  },
});
