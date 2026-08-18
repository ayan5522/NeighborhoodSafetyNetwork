import React, { useRef } from 'react';
import { View, TextInput, StyleSheet } from 'react-native';
import { COLORS } from '../constants/colors';

export default function OTPInput({ code = '', setCode, length = 6, error = false }) {
  const inputs = useRef([]);

  const digits = code.split('').concat(Array(length).fill('')).slice(0, length);

  const handleChange = (text, index) => {
    const cleaned = text.replace(/[^0-9]/g, '');

    // Handle full paste
    if (cleaned.length > 1) {
      const pastedDigits = cleaned.slice(0, length);
      setCode(pastedDigits);
      const nextIndex = Math.min(pastedDigits.length, length - 1);
      inputs.current[nextIndex]?.focus();
      return;
    }

    const currentDigits = [...digits];
    currentDigits[index] = cleaned;
    const newCode = currentDigits.join('').slice(0, length);
    setCode(newCode);

    if (cleaned && index < length - 1) {
      inputs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace' && !digits[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  return (
    <View style={styles.container}>
      {Array(length)
        .fill(0)
        .map((_, index) => {
          const isFilled = !!digits[index];
          return (
            <TextInput
              key={index}
              ref={(ref) => (inputs.current[index] = ref)}
              style={[
                styles.box,
                isFilled && styles.boxFilled,
                error && styles.boxError,
              ]}
              value={digits[index] || ''}
              onChangeText={(text) => handleChange(text, index)}
              onKeyPress={(e) => handleKeyPress(e, index)}
              keyboardType="number-pad"
              maxLength={index === 0 ? length : 1}
              textAlign="center"
              selectTextOnFocus
              autoFocus={index === 0}
            />
          );
        })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 20,
    paddingHorizontal: 4,
  },
  box: {
    width: 46,
    height: 54,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text,
  },
  boxFilled: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primarySoft,
  },
  boxError: {
    borderColor: COLORS.error,
    backgroundColor: '#fffbfa',
  },
});
