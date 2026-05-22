import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import {
  useContrastPalette,
  useEffectiveFontScale,
  useInteractionAccessibility,
} from '../hooks/useAccessibilityEngine';

interface GlossaryModalProps {
  visible: boolean;
  term: string;
  definition: string;
  onClose: () => void;
}

export function GlossaryModal({ visible, term, definition, onClose }: GlossaryModalProps) {
  const palette = useContrastPalette();
  const fontScale = useEffectiveFontScale();
  const { minTouchSize } = useInteractionAccessibility();

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onClose}
      accessibilityViewIsModal
      testID="glossary-modal"
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={onClose}
        accessibilityLabel="Close explanation"
        accessibilityRole="button"
      >
        {/* We block gestures from touching the background, and provide a container */}
        <View style={[styles.modalCard, { backgroundColor: palette.background, borderColor: palette.border, borderWidth: 1 }]} onStartShouldSetResponder={() => true}>
          <Text style={[styles.modalTerm, { color: palette.text, fontSize: 22 * fontScale }]}>{term}</Text>
          <Text style={[styles.modalDefinition, { color: palette.text, fontSize: 18 * fontScale }]}>{definition}</Text>
          <TouchableOpacity
            style={[styles.modalCloseButton, { backgroundColor: palette.accent, minHeight: minTouchSize }]}
            onPress={onClose}
            accessibilityLabel="Close"
            accessibilityRole="button"
          >
            <Text style={[styles.modalCloseText, { color: palette.background, fontSize: 18 * fontScale }]}>OK</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    borderRadius: 16,
    padding: 28,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  modalTerm: {
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalDefinition: {
    lineHeight: 28,
    textAlign: 'center',
    marginBottom: 24,
  },
  modalCloseButton: {
    paddingVertical: 12,
    paddingHorizontal: 40,
    borderRadius: 24,
    minWidth: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseText: {
    fontWeight: 'bold',
  },
});
