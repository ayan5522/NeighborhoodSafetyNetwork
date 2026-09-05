import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  Image,
  Alert,
  Platform,
  Modal,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import incidentService from '../services/incidentService';
import locationService from '../services/locationService';
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
  { key: 'LOW', label: 'Low', color: '#10B981', hint: 'Minor issue with limited immediate impact.' },
  { key: 'MEDIUM', label: 'Medium', color: '#F59E0B', hint: 'Issue that may affect nearby residents.' },
  { key: 'HIGH', label: 'High', color: '#F97316', hint: 'Serious incident requiring attention.' },
  { key: 'CRITICAL', label: 'Critical', color: '#EF4444', hint: 'Potential immediate danger to people.' },
];

export default function ReportIncidentScreen({ navigation }) {
  const [category, setCategory] = useState('ACCIDENT');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState('MEDIUM');
  const [imageUri, setImageUri] = useState(null);
  const [photoPickerVisible, setPhotoPickerVisible] = useState(false);

  const [coords, setCoords] = useState({ latitude: 16.9902, longitude: 73.3120, accuracy: 10 });
  const [areaName, setAreaName] = useState('Detecting current area...');
  const [locLoading, setLocLoading] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [submittedIncident, setSubmittedIncident] = useState(null);

  useEffect(() => {
    fetchCurrentLocation();
  }, []);

  const fetchCurrentLocation = async () => {
    setLocLoading(true);
    try {
      const pos = await locationService.getCurrentPosition();
      setCoords(pos);
      const locInfo = await locationService.syncLocationWithBackend(pos);
      if (locInfo) {
        setAreaName(`${locInfo.neighborhood_name || 'Area'}, ${locInfo.locality || 'Locality'}`);
      } else {
        setAreaName('Ratnagiri Safety Zone');
      }
    } catch (err) {
      setAreaName('Using default development location (Ratnagiri)');
    } finally {
      setLocLoading(false);
    }
  };

  /**
   * Capture photo using device Camera
   */
  const handleTakePhoto = async () => {
    setPhotoPickerVisible(false);
    try {
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Camera Permission Required',
            'Please allow camera permission in your phone settings to capture real-time incident photos.'
          );
          return;
        }
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setImageUri(result.assets[0].uri);
      }
    } catch (err) {
      console.warn('[Camera Error]', err);
      Alert.alert('Camera Error', err.message || 'Could not launch camera.');
    }
  };

  /**
   * Choose photo from device Gallery / Library
   */
  const handlePickFromGallery = async () => {
    setPhotoPickerVisible(false);
    try {
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Photo Library Permission Required',
            'Please allow photo library permission in your phone settings to select evidence photos.'
          );
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setImageUri(result.assets[0].uri);
      }
    } catch (err) {
      console.warn('[Gallery Error]', err);
      Alert.alert('Gallery Error', err.message || 'Could not open photo library.');
    }
  };

  const handleRemoveImage = () => {
    setImageUri(null);
  };

  const handleResetForm = () => {
    setTitle('');
    setDescription('');
    setCategory('ACCIDENT');
    setSeverity('MEDIUM');
    setImageUri(null);
    setSubmittedIncident(null);
    setErrorMessage('');
    fetchCurrentLocation();
  };

  const handleSubmit = async () => {
    setErrorMessage('');

    if (!title.trim() || title.trim().length < 3) {
      setErrorMessage('Please enter a descriptive title (minimum 3 characters).');
      return;
    }

    if (!description.trim() || description.trim().length < 10) {
      setErrorMessage('Please provide more details in the description (minimum 10 characters).');
      return;
    }

    setSubmitting(true);
    try {
      const created = await incidentService.createIncident({
        category,
        title: title.trim(),
        description: description.trim(),
        severity,
        latitude: coords.latitude,
        longitude: coords.longitude,
        imageUri,
      });

      setSubmittedIncident(created);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to submit report.';
      setErrorMessage(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Render Success Confirmation View upon submission
  if (submittedIncident) {
    const selectedCatObj = CATEGORIES.find((c) => c.key === submittedIncident.category) || { icon: '📌', label: submittedIncident.category };
    const selectedSevObj = SEVERITIES.find((s) => s.key === submittedIncident.severity) || { color: '#10B981', label: submittedIncident.severity };

    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.successContainer}>
          {/* Success Banner Card */}
          <View style={styles.successHeroCard}>
            <View style={styles.successIconCircle}>
              <Text style={styles.successIconText}>✓</Text>
            </View>
            <Text style={styles.successHeroTitle}>Report Submitted Successfully!</Text>
            <Text style={styles.successHeroSubtitle}>
              Your safety incident report has been securely saved to the neighborhood database in PENDING status.
            </Text>
          </View>

          {/* Incident Summary Card */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryCardHeader}>Submitted Report Summary</Text>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Category:</Text>
              <View style={styles.summaryBadge}>
                <Text style={styles.summaryBadgeIcon}>{selectedCatObj.icon}</Text>
                <Text style={styles.summaryBadgeText}>{selectedCatObj.label}</Text>
              </View>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Title:</Text>
              <Text style={styles.summaryValueTitle} numberOfLines={2}>
                {submittedIncident.title}
              </Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Severity:</Text>
              <View style={[styles.severityPill, { backgroundColor: `${selectedSevObj.color}20` }]}>
                <View style={[styles.severityDot, { backgroundColor: selectedSevObj.color }]} />
                <Text style={[styles.severityPillText, { color: selectedSevObj.color }]}>
                  {submittedIncident.severity}
                </Text>
              </View>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Status:</Text>
              <View style={styles.pendingStatusBadge}>
                <Text style={styles.pendingStatusText}>PENDING REVIEW</Text>
              </View>
            </View>

            <View style={[styles.summaryRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.summaryLabel}>Location:</Text>
              <Text style={styles.summaryValueLoc}>
                {submittedIncident.neighborhood_name || submittedIncident.locality || 'Ratnagiri Zone'}
              </Text>
            </View>
          </View>

          {/* Navigation Action Buttons */}
          <View style={styles.successActionsContainer}>
            <TouchableOpacity
              style={styles.primaryNavBtn}
              onPress={() => navigation.replace('MyReports')}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryNavBtnText}>📋 Go to "My Safety Reports" →</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryNavBtn}
              onPress={() => navigation.replace('IncidentDetails', { id: submittedIncident.id })}
              activeOpacity={0.8}
            >
              <Text style={styles.secondaryNavBtnText}>👁️ View Full Incident Details</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.tertiaryNavBtn}
              onPress={handleResetForm}
              activeOpacity={0.8}
            >
              <Text style={styles.tertiaryNavBtnText}>+ Report Another Incident</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.homeNavBtn}
              onPress={() => navigation.navigate('Home')}
              activeOpacity={0.8}
            >
              <Text style={styles.homeNavBtnText}>🏠 Return to Home</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Header Notice */}
        <View style={styles.banner}>
          <Text style={styles.bannerTitle}>Report Neighborhood Incident</Text>
          <Text style={styles.bannerSubtitle}>
            Submit safety observations to your local network. Reports are logged in PENDING status.
          </Text>
        </View>

        {errorMessage ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        {/* 1. Category Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Incident Category *</Text>
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
                    numberOfLines={2}
                  >
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* 2. Title & Description */}
        <View style={styles.section}>
          <View style={styles.labelRow}>
            <Text style={styles.sectionTitle}>2. Incident Title *</Text>
            <Text style={styles.charCount}>{title.length}/120</Text>
          </View>
          <TextInput
            style={styles.input}
            placeholder="e.g. Fallen tree blocking left lane near market"
            placeholderTextColor={theme.colors.textMuted}
            value={title}
            onChangeText={setTitle}
            maxLength={120}
          />

          <View style={[styles.labelRow, { marginTop: 14 }]}>
            <Text style={styles.sectionTitle}>3. Detailed Description *</Text>
            <Text style={styles.charCount}>{description.length}/2000</Text>
          </View>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Provide relevant details (what happened, exact landmark, traffic impact, etc.)..."
            placeholderTextColor={theme.colors.textMuted}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            maxLength={2000}
            textAlignVertical="top"
          />
        </View>

        {/* 3. Severity Level */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. Reported Severity Level *</Text>
          <View style={styles.severityContainer}>
            {SEVERITIES.map((sev) => {
              const isSelected = severity === sev.key;
              return (
                <TouchableOpacity
                  key={sev.key}
                  style={[
                    styles.severityCard,
                    isSelected && { borderColor: sev.color, backgroundColor: `${sev.color}15` },
                  ]}
                  onPress={() => setSeverity(sev.key)}
                  activeOpacity={0.7}
                >
                  <View style={styles.severityHeader}>
                    <View style={[styles.severityDot, { backgroundColor: sev.color }]} />
                    <Text
                      style={[
                        styles.severityLabel,
                        isSelected && { color: sev.color, fontWeight: '700' },
                      ]}
                    >
                      {sev.label}
                    </Text>
                  </View>
                  <Text style={styles.severityHint}>{sev.hint}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* 4. Incident Location */}
        <View style={styles.section}>
          <View style={styles.labelRow}>
            <Text style={styles.sectionTitle}>5. Incident Location *</Text>
            <TouchableOpacity onPress={fetchCurrentLocation} disabled={locLoading}>
              <Text style={styles.refreshLocText}>
                {locLoading ? 'Acquiring GPS...' : '🔄 Refresh Location'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.locationCard}>
            <Text style={styles.locAreaText}>📍 {areaName}</Text>
            <Text style={styles.locCoordsText}>
              Lat: {coords.latitude.toFixed(4)}° N, Lon: {coords.longitude.toFixed(4)}° E (±
              {Math.round(coords.accuracy || 10)}m)
            </Text>
          </View>
        </View>

        {/* 5. Optional Photo/Evidence with Camera & Gallery */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>6. Photo Evidence (Optional)</Text>
          {imageUri ? (
            <View style={styles.imagePreviewContainer}>
              <Image source={{ uri: imageUri }} style={styles.imagePreview} resizeMode="cover" />
              <TouchableOpacity style={styles.removeImageBtn} onPress={handleRemoveImage}>
                <Text style={styles.removeImageText}>✕ Remove Photo</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.photoOptionsRow}>
              <TouchableOpacity
                style={[styles.photoOptionBtn, styles.cameraBtn]}
                onPress={handleTakePhoto}
                activeOpacity={0.8}
              >
                <Text style={styles.photoOptionIcon}>📸</Text>
                <Text style={styles.photoOptionTitle}>Take Photo</Text>
                <Text style={styles.photoOptionSubtitle}>Use Phone Camera</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.photoOptionBtn, styles.galleryBtn]}
                onPress={handlePickFromGallery}
                activeOpacity={0.8}
              >
                <Text style={styles.photoOptionIcon}>🖼️</Text>
                <Text style={styles.photoOptionTitle}>From Gallery</Text>
                <Text style={styles.photoOptionSubtitle}>Choose Existing</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Submit Action */}
        <TouchableOpacity
          style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.8}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.submitButtonText}>Submit Safety Report →</Text>
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
  banner: {
    backgroundColor: theme.colors.primaryDark,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
    ...theme.shadows.card,
  },
  bannerTitle: {
    fontSize: theme.typography.sizes.md + 1,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  bannerSubtitle: {
    fontSize: theme.typography.sizes.xs + 1,
    color: '#CBD5E1',
    lineHeight: 18,
  },
  section: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    ...theme.shadows.card,
  },
  sectionTitle: {
    fontSize: theme.typography.sizes.sm + 1,
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
    gap: 8,
    marginTop: 4,
  },
  categoryCard: {
    width: '48%',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 64,
  },
  categoryCardSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: '#EFF6FF',
    borderWidth: 2,
  },
  categoryIcon: {
    fontSize: 20,
    marginBottom: 2,
  },
  categoryLabel: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    textAlign: 'center',
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
    minHeight: 90,
  },
  severityContainer: {
    gap: 8,
    marginTop: 4,
  },
  severityCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    padding: 10,
  },
  severityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  severityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  severityLabel: {
    fontSize: theme.typography.sizes.xs + 1,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  severityHint: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginLeft: 14,
  },
  refreshLocText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  locationCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: theme.borderRadius.md,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginTop: 4,
  },
  locAreaText: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  locCoordsText: {
    fontSize: 11,
    color: theme.colors.textMuted,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },

  // Photo Options Dual Buttons
  photoOptionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  photoOptionBtn: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: theme.borderRadius.md,
    paddingVertical: 16,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraBtn: {
    borderColor: '#93C5FD',
    backgroundColor: '#EFF6FF',
  },
  galleryBtn: {
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
  },
  photoOptionIcon: {
    fontSize: 26,
    marginBottom: 4,
  },
  photoOptionTitle: {
    fontSize: theme.typography.sizes.xs + 1,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  photoOptionSubtitle: {
    fontSize: 10,
    color: theme.colors.textMuted,
    marginTop: 2,
  },

  imagePreviewContainer: {
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  imagePreview: {
    width: '100%',
    height: 180,
    backgroundColor: '#E2E8F0',
  },
  removeImageBtn: {
    backgroundColor: '#FEE2E2',
    paddingVertical: 8,
    alignItems: 'center',
  },
  removeImageText: {
    color: theme.colors.error,
    fontSize: theme.typography.sizes.xs,
    fontWeight: '700',
  },
  submitButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    marginBottom: theme.spacing.xl,
    ...theme.shadows.button,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
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

  // Success Confirmation Styles
  successContainer: {
    padding: theme.spacing.lg,
  },
  successHeroCard: {
    backgroundColor: '#064E3B',
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.xl,
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
    ...theme.shadows.card,
  },
  successIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    ...theme.shadows.button,
  },
  successIconText: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: 'bold',
  },
  successHeroTitle: {
    fontSize: theme.typography.sizes.md + 2,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 6,
  },
  successHeroSubtitle: {
    fontSize: theme.typography.sizes.xs + 1,
    color: '#A7F3D0',
    textAlign: 'center',
    lineHeight: 18,
  },
  summaryCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.card,
  },
  summaryCardHeader: {
    fontSize: theme.typography.sizes.sm + 1,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingBottom: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  summaryLabel: {
    fontSize: theme.typography.sizes.xs + 1,
    color: theme.colors.textSecondary,
    fontWeight: '600',
    width: 90,
  },
  summaryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.borderRadius.full,
  },
  summaryBadgeIcon: {
    fontSize: 12,
    marginRight: 4,
  },
  summaryBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  summaryValueTitle: {
    flex: 1,
    fontSize: theme.typography.sizes.xs + 1,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    textAlign: 'right',
  },
  summaryValueLoc: {
    flex: 1,
    fontSize: theme.typography.sizes.xs + 1,
    color: theme.colors.textPrimary,
    textAlign: 'right',
    fontWeight: '600',
  },
  severityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.borderRadius.full,
  },
  severityPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  pendingStatusBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.borderRadius.full,
  },
  pendingStatusText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#92400E',
  },
  successActionsContainer: {
    gap: 10,
    marginBottom: theme.spacing.xl,
  },
  primaryNavBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    paddingVertical: 14,
    alignItems: 'center',
    ...theme.shadows.button,
  },
  primaryNavBtnText: {
    color: '#FFFFFF',
    fontSize: theme.typography.sizes.sm + 1,
    fontWeight: '700',
  },
  secondaryNavBtn: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#93C5FD',
    borderRadius: theme.borderRadius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryNavBtnText: {
    color: theme.colors.primary,
    fontSize: theme.typography.sizes.sm,
    fontWeight: '700',
  },
  tertiaryNavBtn: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tertiaryNavBtnText: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.sizes.sm,
    fontWeight: '600',
  },
  homeNavBtn: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  homeNavBtnText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.xs + 1,
    fontWeight: '600',
  },
});
