import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAppStore } from '../store/useAppStore';
import { uploadLabelImage } from '../api/client';
import { CameraFrameProcessor, FrameStats } from '../components/CameraFrameProcessor';
import {
  useContrastPalette,
  useEffectiveFontScale,
  useInteractionAccessibility,
} from '../hooks/useAccessibilityEngine';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

type RootStackParamList = {
  Result: undefined;
};
type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Result'>;

export function CameraScanScreen({ navigation }: { navigation: NavigationProp }) {
  const { setImageUri, imageUri, setProcessing, setResult, setError, isProcessing } = useAppStore();
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [isClearToCapture, setIsClearToCapture] = useState(true);
  const [mockStats, setMockStats] = useState<FrameStats | undefined>(undefined);

  const palette = useContrastPalette();
  const fontScale = useEffectiveFontScale();
  const { minTouchSize } = useInteractionAccessibility();

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
      setImageBase64(result.assets[0].base64 || null);
    }
  };

  const takePhoto = async () => {
    if (!isClearToCapture) return;
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    
    if (permissionResult.granted === false) {
      alert("You've refused to allow this app to access your camera!");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
      setImageBase64(result.assets[0].base64 || null);
    }
  };

  const analyzeImage = async () => {
    if (!imageUri || !imageBase64) return;
    
    setProcessing(true);
    try {
      console.log('Analyzing image...');
      const data = await uploadLabelImage(imageUri, imageBase64);
      setResult(data as any);
      navigation.navigate('Result');
    } catch (err: any) {
      setError(err.message);
      alert('Error analyzing image. Make sure backend is running.');
    } finally {
      setProcessing(false);
    }
  };

  // For tests, expose a way to set mock stats. We can do this via testID or attaching to global,
  // but it's easier to just let tests pass a prop if we extracted it, or we can use a hidden button.
  // Actually, in Jest we can just test the CameraFrameProcessor directly or mock it.
  // We will test CameraFrameProcessor and CameraScanScreen.

  return (
    <View style={[styles.container, { backgroundColor: palette.background }]}>
      {imageUri ? (
        <View style={styles.previewContainer}>
          <Image source={{ uri: imageUri }} style={styles.image} accessibilityLabel="Captured label" />
          
          {isProcessing ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={palette.accent} />
              <Text style={[styles.loadingText, { color: palette.text, fontSize: 16 * fontScale }]}>
                Analyzing Label...
              </Text>
            </View>
          ) : (
            <View style={styles.actionRow}>
              <TouchableOpacity 
                style={[styles.button, { backgroundColor: palette.background, borderColor: palette.border, borderWidth: 1, minHeight: minTouchSize }]} 
                onPress={() => setImageUri(null)}
                accessibilityRole="button"
                accessibilityLabel="Retake photo"
              >
                <Text style={{ color: palette.text, fontSize: 16 * fontScale, fontWeight: 'bold' }}>Retake</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.button, { backgroundColor: palette.accent, minHeight: minTouchSize }]} 
                onPress={analyzeImage}
                accessibilityRole="button"
                accessibilityLabel="Analyze photo"
              >
                <Text style={{ color: palette.background, fontSize: 16 * fontScale, fontWeight: 'bold' }}>Analyze</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      ) : (
        <View style={styles.captureContainer}>
          <CameraFrameProcessor stats={mockStats} onClearToCapture={setIsClearToCapture} fontScale={fontScale} />
          <TouchableOpacity 
            style={[
              styles.button, 
              { backgroundColor: isClearToCapture ? palette.accent : palette.secondary, minHeight: minTouchSize, opacity: isClearToCapture ? 1 : 0.5 }
            ]} 
            onPress={takePhoto}
            disabled={!isClearToCapture}
            accessibilityRole="button"
            accessibilityLabel="Take Photo"
          >
            <Text style={{ color: palette.background, fontSize: 16 * fontScale, fontWeight: 'bold' }}>Take Photo</Text>
          </TouchableOpacity>
          <Text style={[styles.orText, { color: palette.secondary, fontSize: 16 * fontScale }]}>OR</Text>
          <TouchableOpacity 
            style={[styles.button, { backgroundColor: palette.background, borderColor: palette.border, borderWidth: 1, minHeight: minTouchSize }]} 
            onPress={pickImage}
            accessibilityRole="button"
            accessibilityLabel="Pick from Gallery"
          >
            <Text style={{ color: palette.text, fontSize: 16 * fontScale, fontWeight: 'bold' }}>Pick from Gallery</Text>
          </TouchableOpacity>

          {/* Test Hooks */}
          {process.env.NODE_ENV === 'test' && (
            <View style={{ position: 'absolute', bottom: 0, opacity: 0 }}>
              <TouchableOpacity testID="mock-blur" onPress={() => setMockStats({ laplacianVariance: 20, luminance: 0.8 })} />
              <TouchableOpacity testID="mock-dark" onPress={() => setMockStats({ laplacianVariance: 100, luminance: 0.1 })} />
              <TouchableOpacity testID="mock-clear" onPress={() => setMockStats({ laplacianVariance: 100, luminance: 0.8 })} />
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  previewContainer: { flex: 1, padding: 16 },
  image: { flex: 1, borderRadius: 12, marginBottom: 16, resizeMode: 'contain' },
  captureContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  button: { paddingVertical: 14, paddingHorizontal: 24, borderRadius: 8, alignItems: 'center', minWidth: 140, justifyContent: 'center' },
  actionRow: { flexDirection: 'row', justifyContent: 'space-around', paddingBottom: 24 },
  orText: { marginVertical: 20, fontWeight: 'bold' },
  loadingContainer: { alignItems: 'center', padding: 24 },
  loadingText: { marginTop: 12 }
});
