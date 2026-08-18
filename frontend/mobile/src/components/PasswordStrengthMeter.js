import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { calculatePasswordStrength } from '../utils/validators';
import { COLORS } from '../constants/colors';

export default function PasswordStrengthMeter({ password }) {
  if (!password) return null;

  const { score, maxScore, label, color, checks } = calculatePasswordStrength(password);
  const percentage = (score / maxScore) * 100;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Password Strength:</Text>
        <Text style={[styles.strengthLabel, { color }]}>{label}</Text>
      </View>

      <View style={styles.barBackground}>
        <View style={[styles.barFill, { width: `${percentage}%`, backgroundColor: color }]} />
      </View>

      <View style={styles.checklist}>
        {checks.map((item, idx) => (
          <View key={idx} style={styles.checkItem}>
            <Text style={[styles.checkIcon, item.pass ? styles.checkPass : styles.checkFail]}>
              {item.pass ? '✓' : '•'}
            </Text>
            <Text style={[styles.checkText, item.pass && styles.checkTextPass]}>
              {item.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  title: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  strengthLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  barBackground: {
    height: 4,
    backgroundColor: '#e2e8f0',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 8,
  },
  barFill: {
    height: '100%',
    borderRadius: 2,
  },
  checklist: {
    marginTop: 4,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 2,
  },
  checkIcon: {
    width: 16,
    fontSize: 12,
    fontWeight: 'bold',
  },
  checkPass: {
    color: COLORS.success,
  },
  checkFail: {
    color: COLORS.textMuted,
  },
  checkText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  checkTextPass: {
    color: COLORS.text,
    fontWeight: '500',
  },
});
