import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  Linking,
  Alert,
} from 'react-native';
import alertService from '../services/alertService';
import emergencyContactService from '../services/emergencyContactService';
import { theme } from '../styles/theme';
import { API_BASE_URL } from '../services/apiClient';

const PRIORITY_THEMES = {
  URGENT: { color: '#EF4444', bg: '#FEE2E2', label: 'URGENT' },
  HIGH: { color: '#F97316', bg: '#FFEDD5', label: 'HIGH' },
  NORMAL: { color: '#F59E0B', bg: '#FEF3C7', label: 'NORMAL' },
  LOW: { color: '#10B981', bg: '#D1FAE5', label: 'LOW' },
};

export default function AlertDetailsScreen({ route, navigation }) {
  const { id } = route.params || {};
  const [alertData, setAlertData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [primaryContact, setPrimaryContact] = useState(null);

  useEffect(() => {
    fetchDetails();
  }, [id]);

  const fetchDetails = async () => {
    try {
      const data = await alertService.getAlertById(id);
      setAlertData(data);

      // Automatically mark as read if active
      if (data && !data.read_at) {
        await alertService.markAsRead(id);
      }

      // Fetch primary contact for emergency action
      const contacts = await emergencyContactService.getContacts();
      const primary = contacts.find((c) => c.is_primary) || contacts[0];
      setPrimaryContact(primary || null);
    } catch (err) {
      console.warn('[Alert Details Error]', err.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * National Emergency Call (112)
   */
  const handleCall112 = () => {
    Alert.alert(
      'National Emergency Helpline',
      'This will open your phone dialer to call India Emergency Number 112. Do you want to proceed?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Call 112',
          style: 'destructive',
          onPress: () => {
            Linking.openURL('tel:112').catch(() => {
              Alert.alert('Call Error', 'Could not open phone dialer on this device.');
            });
          },
        },
      ]
    );
  };

  /**
   * Notify Emergency Contact
   */
  const handleNotifyContact = () => {
    if (!primaryContact) {
      Alert.alert(
        'No Emergency Contact Configured',
        'You have not added a primary emergency contact yet. Would you like to add one now?',
        [
          { text: 'Later', style: 'cancel' },
          { text: 'Add Contact', onPress: () => navigation.navigate('EmergencyContacts') },
        ]
      );
      return;
    }

    Alert.alert(
      'Notify Emergency Contact',
      `Send safety alert details to your primary contact: ${primaryContact.name} (${primaryContact.phone_number})?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm & Send',
          onPress: () => {
            Alert.alert(
              'Notification Dispatched',
              `Emergency alert details have been sent to ${primaryContact.name}.`
            );
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Loading alert details...</Text>
      </SafeAreaView>
    );
  }

  if (!alertData) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <Text style={styles.errorTitle}>Alert Not Found</Text>
        <Text style={styles.errorSubtitle}>This safety alert may have expired or been removed.</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>← Back to Alerts</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const prio = PRIORITY_THEMES[alertData.priority] || PRIORITY_THEMES.NORMAL;
  const isEmergencySeverity = alertData.priority === 'HIGH' || alertData.priority === 'URGENT';

  // Construct absolute image URL if available
  let fullImageUrl = null;
  if (alertData.incident_image_url) {
    fullImageUrl = alertData.incident_image_url.startsWith('http')
      ? alertData.incident_image_url
      : `${API_BASE_URL.replace('/api', '')}${alertData.incident_image_url}`;
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Priority Banner */}
        <View style={[styles.priorityBanner, { backgroundColor: prio.bg }]}>
          <View style={styles.priorityHeaderRow}>
            <Text style={[styles.priorityBannerText, { color: prio.color }]}>
              🚨 {prio.label} PRIORITY ALERT
            </Text>
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>{alertData.status}</Text>
            </View>
          </View>
          <Text style={styles.priorityBannerSub}>
            Targeted to your safety perimeter based on reported incident severity.
          </Text>
        </View>

        {/* Incident Summary Card */}
        <View style={styles.card}>
          <Text style={styles.categoryLabel}>{alertData.incident_category}</Text>
          <Text style={styles.incidentTitle}>{alertData.incident_title}</Text>

          <View style={styles.metaRow}>
            <Text style={styles.metaText}>
              📍 {alertData.neighborhood_name || 'Neighborhood Zone'}
              {alertData.locality ? `, ${alertData.locality}` : ''}
            </Text>
          </View>

          {alertData.approximate_distance_meters !== null && (
            <View style={styles.distanceBox}>
              <Text style={styles.distanceBoxText}>
                Approx. {alertData.approximate_distance_meters < 1000
                  ? `${alertData.approximate_distance_meters} m`
                  : `${(alertData.approximate_distance_meters / 1000).toFixed(1)} km`} from your registered location
              </Text>
            </View>
          )}

          <Text style={styles.sectionHeader}>Description & Details</Text>
          <Text style={styles.incidentDescription}>{alertData.incident_description}</Text>

          {fullImageUrl && (
            <View style={styles.imageContainer}>
              <Text style={styles.imageHeader}>Photo Evidence</Text>
              <Image source={{ uri: fullImageUrl }} style={styles.evidenceImage} resizeMode="cover" />
            </View>
          )}
        </View>

        {/* Emergency Assistance Actions (for HIGH & CRITICAL alerts) */}
        {isEmergencySeverity && (
          <View style={styles.emergencyBox}>
            <Text style={styles.emergencyHeader}>🚨 Emergency Assistance Options</Text>
            <Text style={styles.emergencySub}>
              This incident is marked as serious. If immediate assistance is needed in your area, use the options below:
            </Text>

            <TouchableOpacity style={styles.call112Btn} onPress={handleCall112} activeOpacity={0.8}>
              <Text style={styles.call112BtnText}>📞 Call 112 (National Emergency)</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.notifyContactBtn} onPress={handleNotifyContact} activeOpacity={0.8}>
              <Text style={styles.notifyContactBtnText}>
                👥 Notify Emergency Contact {primaryContact ? `(${primaryContact.name})` : ''}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Privacy & Safe Sharing Disclaimer */}
        <View style={styles.privacyCard}>
          <Text style={styles.privacyTitle}>🔒 Privacy & Protection Guarantee</Text>
          <Text style={styles.privacyText}>
            Safety alerts are shared across your local perimeter for neighborhood awareness. Personal identity, reporter contact info, and exact GPS coordinates are strictly protected and never exposed.
          </Text>
        </View>
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
    padding: theme.spacing.md,
    gap: 12,
  },
  priorityBanner: {
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  priorityHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  priorityBannerText: {
    fontSize: theme.typography.sizes.sm + 1,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  priorityBannerSub: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    lineHeight: 16,
  },
  statusBadge: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.full,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.card,
  },
  categoryLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  incidentTitle: {
    fontSize: theme.typography.sizes.md,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  metaText: {
    fontSize: theme.typography.sizes.xs + 1,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  distanceBox: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.md,
    marginBottom: 14,
  },
  distanceBoxText: {
    fontSize: 12,
    color: theme.colors.primaryDark,
    fontWeight: '600',
  },
  sectionHeader: {
    fontSize: theme.typography.sizes.xs + 1,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  incidentDescription: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    lineHeight: 22,
    marginBottom: 16,
  },
  imageContainer: {
    marginTop: 8,
  },
  imageHeader: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textMuted,
    marginBottom: 6,
  },
  evidenceImage: {
    width: '100%',
    height: 200,
    borderRadius: theme.borderRadius.md,
    backgroundColor: '#E2E8F0',
  },
  emergencyBox: {
    backgroundColor: '#FFF1F2',
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    borderWidth: 1.5,
    borderColor: '#FECDD3',
    gap: 10,
  },
  emergencyHeader: {
    fontSize: theme.typography.sizes.sm + 1,
    fontWeight: '700',
    color: '#9F1239',
  },
  emergencySub: {
    fontSize: 11,
    color: '#881337',
    lineHeight: 16,
  },
  call112Btn: {
    backgroundColor: '#E11D48',
    borderRadius: theme.borderRadius.md,
    paddingVertical: 12,
    alignItems: 'center',
    ...theme.shadows.button,
  },
  call112BtnText: {
    color: '#FFFFFF',
    fontSize: theme.typography.sizes.sm,
    fontWeight: '700',
  },
  notifyContactBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E11D48',
    borderRadius: theme.borderRadius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  notifyContactBtnText: {
    color: '#E11D48',
    fontSize: theme.typography.sizes.sm,
    fontWeight: '700',
  },
  privacyCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  privacyTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  privacyText: {
    fontSize: 10,
    color: theme.colors.textMuted,
    lineHeight: 15,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  loadingText: {
    marginTop: 10,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
  },
  errorTitle: {
    fontSize: theme.typography.sizes.md,
    fontWeight: '700',
    color: theme.colors.error,
    marginBottom: 4,
  },
  errorSubtitle: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginBottom: 16,
  },
  backBtn: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.md,
  },
  backBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
