import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  LayoutChangeEvent
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Camera, Image as ImageIcon } from 'lucide-react-native';
import { useAppStore } from '../store/useAppStore';
import { uploadLabelImage } from '../api/client';
import { CameraFrameProcessor, FrameStats } from '../components/CameraFrameProcessor';
import {
  useContrastPalette,
  useEffectiveFontScale,
  useInteractionAccessibility,
} from '../hooks/useAccessibilityEngine';
import { cropImageToGuideFrame, Size } from '../utils/cameraGuideCrop';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

type RootStackParamList = {
  Result: undefined;
};
type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Result'>;

export function CameraScanScreen({ navigation }: { navigation: NavigationProp }) {
  const { setImageUri, imageUri, setProcessing, setResult, setError, isProcessing } = useAppStore();
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [mockStats, setMockStats] = useState<FrameStats | undefined>(undefined);
  const [previewSize, setPreviewSize] = useState<Size | undefined>(undefined);
  const [isCapturing, setIsCapturing] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);

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

  const handleCameraLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setPreviewSize({ width, height });
  };

  const takePhoto = async () => {
    if (!permission?.granted) {
      const permissionResult = await requestPermission();
      if (!permissionResult.granted) {
        alert("You've refused to allow this app to access your camera!");
      }
      return;
    }

    if (!cameraRef.current) {
      return;
    }

    setIsCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.9,
        base64: true,
      });

      if (photo) {
        const cropped = await cropImageToGuideFrame(
          photo.uri,
          { width: photo.width, height: photo.height },
          previewSize
        );
        setImageUri(cropped.uri);
        setImageBase64(cropped.base64 || photo.base64 || null);
      }
    } catch (err: any) {
      setError(err.message);
      alert('Error taking photo. Please try again.');
    } finally {
      setIsCapturing(false);
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
                onPress={() => {
                  setImageUri(null);
                  setImageBase64(null);
                }}
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
        <View style={styles.cameraContainer} onLayout={handleCameraLayout}>
          {permission?.granted ? (
            <CameraView ref={cameraRef} style={styles.camera} facing="back" />
          ) : (
            <View style={[styles.permissionPanel, { backgroundColor: palette.background }]}>
              <Text style={[styles.permissionText, { color: palette.text, fontSize: 18 * fontScale }]}>
                Camera permission is needed to scan a label.
              </Text>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: palette.accent, minHeight: minTouchSize }]}
                onPress={requestPermission}
                accessibilityRole="button"
                accessibilityLabel="Allow camera"
              >
                <Text style={{ color: palette.background, fontSize: 16 * fontScale, fontWeight: 'bold' }}>Allow Camera</Text>
              </TouchableOpacity>
            </View>
          )}

          <CameraFrameProcessor stats={mockStats} onClearToCapture={() => {}} fontScale={fontScale} />

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
              style={[styles.shutterButton, { width: Math.max(72, minTouchSize + 24), height: Math.max(72, minTouchSize + 24) }]}
              onPress={takePhoto}
              disabled={isCapturing}
              accessibilityRole="button"
              accessibilityLabel="Take Photo"
              accessibilityState={{ disabled: isCapturing }}
            >
              <View style={[styles.shutterInner, isCapturing && styles.shutterInnerBusy]}>
                {isCapturing ? (
                  <ActivityIndicator color="#2b2d42" />
                ) : (
                  <Camera color="#2b2d42" size={30} strokeWidth={2.5} />
                )}
              </View>
            </TouchableOpacity>

            <View style={[styles.controlSpacer, { minWidth: minTouchSize, minHeight: minTouchSize }]} />
          </View>

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
  cameraContainer: { flex: 1, backgroundColor: '#000000' },
  camera: { ...StyleSheet.absoluteFillObject },
  permissionPanel: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  permissionText: { textAlign: 'center', marginBottom: 20, lineHeight: 26 },
  button: { paddingVertical: 14, paddingHorizontal: 24, borderRadius: 8, alignItems: 'center', minWidth: 140, justifyContent: 'center' },
  actionRow: { flexDirection: 'row', justifyContent: 'space-around', paddingBottom: 24 },
  loadingContainer: { alignItems: 'center', padding: 24 },
  loadingText: { marginTop: 12 },
  bottomControls: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 28,
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
    width: 56,
    height: 56,
    borderRadius: 999,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInnerBusy: {
    opacity: 0.82,
  },
  controlSpacer: { opacity: 0 },
});
