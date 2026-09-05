import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import incidentService from '../services/incidentService';
import { theme } from '../styles/theme';

const CATEGORIES = [
  { key: 'ACCIDENT', label: 'Accident', icon: '🚗' },
  { key: 'FIRE', label: 'Fire', icon: '🔥' },
  { key: 'SUSPICIOUS_ACTIVITY', label: 'Suspicious Activity', icon: '👁️' },
  { key: 'ROAD_HAZARD', label: 'Road Hazard', icon: '⚠️' },
  { key: 'FLOOD_WATERLOGGING', label: 'Flood / Waterlogging', icon: '🌊' },
  { key: 'MEDICAL_EMERGENCY', label: 'Medical Emergency', icon: '🏥' },
  { key: 'INFRASTRUCTURE_ISSUE', label: 'Infrastructure Issue', icon: '🏗️' },
  { key: 'OTHER', label: 'Other Safety Concern', icon: '📌' },
];

const SEVERITIES = [
  { key: 'LOW', label: 'Low', color: '#10B981' },
  { key: 'MEDIUM', label: 'Medium', color: '#F59E0B' },
  { key: 'HIGH', label: 'High', color: '#F97316' },
  { key: 'CRITICAL', label: 'Critical', color: '#EF4444' },
];

export default function EditIncidentScreen({ route, navigation }) {
  const { incident } = route.params || {};

  const [category, setCategory] = useState(incident?.category || 'ACCIDENT');
  const [title, setTitle] = useState(incident?.title || '');
  const [description, setDescription] = useState(incident?.description || '');
  const [severity, setSeverity] = useState(incident?.severity || 'MEDIUM');

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleUpdate = async () => {
    setErrorMessage('');
    setSuccessMessage('');

    if (!title.trim() || title.trim().length < 3) {
      setErrorMessage('Title must be at least 3 characters long.');
      return;
    }

    if (!description.trim() || description.trim().length < 10) {
      setErrorMessage('Description must be at least 10 characters long.');
      return;
    }

    setSubmitting(true);
    try {
      await incidentService.updateIncident(incident.id, {
        category,
        title: title.trim(),
        description: description.trim(),
        severity,
      });

      setSuccessMessage('Incident report updated successfully.');
      setTimeout(() => {
        navigation.goBack();
      }, 1000);
    } catch (err) {
      setErrorMessage(err.response?.data?.message || err.message || 'Failed to update report.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Edit Pending Report</Text>
          <Text style={styles.headerSubtitle}>
            Update incident details before verification or active broadcast.
          </Text>
        </View>

        {errorMessage ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        {successMessage ? (
          <View style={styles.successBox}>
            <Text style={styles.successText}>{successMessage}</Text>
          </View>
        ) : null}

        {/* Category */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Category</Text>
          <View style={styles.categoryGrid}>
            {CATEGORIES.map((cat) => {
              const isSelected = category === cat.key;
              return (
                <TouchableOpacity
                  key={cat.key}
                  style={[styles.categoryCard, isSelected && styles.categoryCardSelected]}
                  onPress={() => setCategory(cat.key)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.categoryIcon}>{cat.icon}</Text>
                  <Text
                    style={[styles.categoryLabel, isSelected && styles.categoryLabelSelected]}
                    numberOfLines={1}
                  >
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Title & Description */}
        <View style={styles.section}>
          <View style={styles.labelRow}>
            <Text style={styles.sectionTitle}>Title</Text>
            <Text style={styles.charCount}>{title.length}/120</Text>
          </View>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            maxLength={120}
          />

          <View style={[styles.labelRow, { marginTop: 12 }]}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.charCount}>{description.length}/2000</Text>
          </View>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            maxLength={2000}
            textAlignVertical="top"
          />
        </View>

        {/* Severity */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Severity Level</Text>
          <View style={styles.severityRow}>
            {SEVERITIES.map((sev) => {
              const isSelected = severity === sev.key;
              return (
                <TouchableOpacity
                  key={sev.key}
                  style={[
                    styles.severityPill,
                    isSelected && { borderColor: sev.color, backgroundColor: `${sev.color}15`, borderWidth: 2 },
                  ]}
                  onPress={() => setSeverity(sev.key)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.severityDot, { backgroundColor: sev.color }]} />
                  <Text style={[styles.severityText, isSelected && { color: sev.color, fontWeight: '700' }]}>
                    {sev.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, submitting && styles.saveButtonDisabled]}
          onPress={handleUpdate}
          disabled={submitting}
          activeOpacity={0.8}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.saveButtonText}>Save Changes</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    padding: theme.spacing.lg,
  },
  header: {
    marginBottom: theme.spacing.md,
  },
  headerTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: '700',
    color: theme.colors.primaryDark,
  },
  headerSubtitle: {
    fontSize: theme.typography.sizes.xs + 1,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  section: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    ...theme.shadows.card,
  },
  sectionTitle: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 8,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  charCount: {
    fontSize: 11,
    color: theme.colors.textMuted,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  categoryCard: {
    width: '48%',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    padding: 8,
    alignItems: 'center',
  },
  categoryCardSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: '#EFF6FF',
    borderWidth: 2,
  },
  categoryIcon: {
    fontSize: 16,
    marginBottom: 2,
  },
  categoryLabel: {
    fontSize: 10,
    color: theme.colors.textSecondary,
    fontWeight: '600',
  },
  categoryLabelSelected: {
    color: theme.colors.primary,
    fontWeight: '700',
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textPrimary,
  },
  textArea: {
    minHeight: 80,
  },
  severityRow: {
    flexDirection: 'row',
    gap: 8,
  },
  severityPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    paddingVertical: 8,
  },
  severityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  severityText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  saveButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    marginBottom: theme.spacing.xl,
    ...theme.shadows.button,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: theme.typography.sizes.sm + 1,
    fontWeight: '700',
  },
  errorBox: {
    backgroundColor: theme.colors.errorLight,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    padding: 10,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.md,
  },
  errorText: {
    color: theme.colors.error,
    fontSize: theme.typography.sizes.xs,
    textAlign: 'center',
  },
  successBox: {
    backgroundColor: theme.colors.successLight,
    borderWidth: 1,
    borderColor: '#6EE7B7',
    padding: 10,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.md,
  },
  successText: {
    color: '#065F46',
    fontSize: theme.typography.sizes.xs,
    textAlign: 'center',
    fontWeight: '700',
  },
});
