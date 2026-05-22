import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { useContrastPalette, useEffectiveFontScale, useInteractionAccessibility } from '../hooks/useAccessibilityEngine';

interface RatingWidgetProps {
  scanId: string;
  onSubmit?: (data: { scanId: string; rating: number; feedback: string }) => void;
}

export function RatingWidget({ scanId, onSubmit }: RatingWidgetProps) {
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const palette = useContrastPalette();
  const fontScale = useEffectiveFontScale();
  const { minTouchSize } = useInteractionAccessibility();

  const handleSubmit = () => {
    if (rating === 0) return;
    if (onSubmit) onSubmit({ scanId, rating, feedback });
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <View style={[styles.container, { backgroundColor: palette.background, borderColor: palette.border, borderWidth: 1 }]}>
        <Text style={[styles.thankYouText, { color: palette.text, fontSize: 16 * fontScale }]} accessibilityRole="header">
          ¡Gracias por tu opinión!
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: palette.background, borderColor: palette.border, borderWidth: 1 }]}>
      <Text style={[styles.title, { color: palette.text, fontSize: 18 * fontScale }]} accessibilityRole="header">
        ¿Fue fácil de entender?
      </Text>
      <View style={styles.starsContainer} accessibilityRole="radiogroup">
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity
            key={star}
            accessibilityRole="radio"
            accessibilityState={{ checked: rating >= star }}
            accessibilityLabel={`${star} estrellas`}
            onPress={() => setRating(star)}
            style={[
              styles.starButton,
              { minHeight: minTouchSize, minWidth: minTouchSize, justifyContent: 'center', alignItems: 'center' },
              rating >= star ? styles.starSelected : styles.starUnselected
            ]}
          >
            <Text style={[styles.starText, { color: palette.accent, fontSize: 32 * fontScale }]}>
              {rating >= star ? '★' : '☆'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <TextInput
        style={[
          styles.input, 
          { 
            borderColor: palette.border, 
            color: palette.text, 
            fontSize: 16 * fontScale,
            backgroundColor: palette.background
          }
        ]}
        placeholder="Comentarios adicionales (opcional)"
        placeholderTextColor={palette.secondary}
        value={feedback}
        onChangeText={setFeedback}
        accessibilityLabel="Campo de comentarios adicionales"
      />
      <TouchableOpacity 
        style={[
          styles.submitButton, 
          { backgroundColor: rating === 0 ? palette.secondary : palette.accent, minHeight: minTouchSize }
        ]} 
        onPress={handleSubmit}
        disabled={rating === 0}
        accessibilityRole="button"
      >
        <Text style={[styles.submitText, { color: palette.background, fontSize: 16 * fontScale }]}>
          Enviar Feedback
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, borderRadius: 8, marginVertical: 10 },
  title: { fontWeight: 'bold', marginBottom: 12, textAlign: 'center' },
  starsContainer: { flexDirection: 'row', justifyContent: 'center', marginBottom: 16 },
  starButton: { marginHorizontal: 4 },
  starText: {},
  starSelected: { opacity: 1 },
  starUnselected: { opacity: 0.3 },
  input: { 
    borderWidth: 1, 
    borderRadius: 8, 
    padding: 12, 
    marginBottom: 16,
    minHeight: 60,
    textAlignVertical: 'top'
  },
  submitButton: { borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  submitText: { fontWeight: 'bold' },
  thankYouText: { textAlign: 'center', fontWeight: 'bold' }
});
