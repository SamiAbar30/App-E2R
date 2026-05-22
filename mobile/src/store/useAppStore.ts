import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ScanResult } from '../types';

export type AppState = {
  imageUri: string | null;
  isProcessing: boolean;
  result: ScanResult | null;
  error: string | null;
  history: ScanResult[];
  
  setImageUri: (uri: string | null) => void;
  setProcessing: (status: boolean) => void;
  setResult: (data: ScanResult) => void;
  setError: (errorMessage: string) => void;
  reset: () => void;
  addToHistory: (newResult: ScanResult) => void;
  clearHistory: () => void;
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      imageUri: null,
      isProcessing: false,
      result: null,
      error: null,
      history: [],

      setImageUri: (uri) => set({ imageUri: uri, result: null, error: null }),
      setProcessing: (status) => set({ isProcessing: status }),
      
      setResult: (data) => {
        set({ result: data, isProcessing: false, error: null });
        get().addToHistory(data);
      },
      
      setError: (errorMessage) => set({ error: errorMessage, isProcessing: false, result: null }),
      reset: () => set({ imageUri: null, isProcessing: false, result: null, error: null }),
      
      addToHistory: (newResult) => {
        set((state) => {
          // Add to beginning of history, keeping max 10 items
          const item = { ...newResult, id: Date.now().toString(), date: new Date().toISOString() };
          const updatedHistory = [item, ...state.history].slice(0, 10);
          return { history: updatedHistory };
        });
      },

      clearHistory: () => set({ history: [] })
    }),
    {
      name: 'easy-to-read-storage',
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist the history array, not the active session states
      partialize: (state) => ({ history: state.history }),
    }
  )
);
