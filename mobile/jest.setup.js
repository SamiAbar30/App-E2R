// Mock expo-camera
jest.mock('expo-camera', () => {
  return {
    Camera: () => null,
    CameraView: () => null,
    useCameraPermissions: () => [{ granted: true }, jest.fn()],
  };
});

// Mock expo-speech
jest.mock('expo-speech', () => {
  return {
    speak: jest.fn(),
    stop: jest.fn(),
    isSpeakingAsync: jest.fn().mockResolvedValue(false),
  };
});

// Mock image cropping used by the scan camera
jest.mock('expo-image-manipulator', () => {
  return {
    SaveFormat: { JPEG: 'jpeg' },
    manipulateAsync: jest.fn(async (uri, _actions, options) => ({
      uri,
      width: 100,
      height: 100,
      base64: options?.base64 ? 'mock-cropped-base64' : undefined,
    })),
  };
});

// Mock react-native-mmkv
jest.mock('react-native-mmkv', () => {
  return {
    createMMKV: jest.fn(() => ({
      set: jest.fn(),
      getString: jest.fn(),
      getNumber: jest.fn(),
      getBoolean: jest.fn(),
      contains: jest.fn(),
      delete: jest.fn(),
      getAllKeys: jest.fn(),
      clearAll: jest.fn(),
      recrypt: jest.fn(),
      addOnValueChangedListener: jest.fn(),
    })),
  };
}, { virtual: true });

// Mock zustand if needed or AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => {
  return {
    setItem: jest.fn(),
    getItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
  };
});
