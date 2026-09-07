import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  Image,
  Alert,
  Platform,
} from 'react-native';
import incidentService from '../services/incidentService';
import verificationService from '../services/verificationService';
import { useAuth } from '../context/AuthContext';
import { theme } from '../styles/theme';

const CATEGORY_ICONS = {
  ACCIDENT: '🚗',
  FIRE: '🔥',
  SUSPICIOUS_ACTIVITY: '👁️',
  ROAD_HAZARD: '⚠️',
  FLOOD_WATERLOGGING: '🌊',
  MEDICAL_EMERGENCY: '🏥',
  INFRASTRUCTURE_ISSUE: '🏗️',
  OTHER: '📌',
};

const SEVERITY_COLORS = {
  LOW: '#10B981',
  MEDIUM: '#F59E0B',
  HIGH: '#F97316',
  CRITICAL: '#EF4444',
};

const STATUS_CONFIG = {
  PENDING: { bg: '#FEF3C7', text: '#92400E', label: 'Pending Review' },
  ACTIVE: { bg: '#DBEAFE', text: '#1E40AF', label: 'Active in Network' },
  RESOLVED: { bg: '#D1FAE5', text: '#065F46', label: 'Resolved' },
  CANCELLED: { bg: '#F1F5F9', text: '#64748B', label: 'Cancelled' },
};

const VERIFICATION_STATUS_CONFIG = {
  UNVERIFIED: { bg: '#F1F5F9', text: '#64748B', label: 'Unverified' },
  COMMUNITY_CONFIRMED: { bg: '#D1FAE5', text: '#065F46', label: 'Community Confirmed' },
  COMMUNITY_DISPUTED: { bg: '#FEE2E2', text: '#991B1B', label: 'Community Disputed' },
};

export default function IncidentDetailsScreen({ route, navigation }) {
  const { id, incident: initialIncident } = route.params || {};
  const { user } = useAuth();

  const [incident, setIncident] = useState(initialIncident || null);
  const [loading, setLoading] = useState(!initialIncident);
  const [cancelling, setCancelling] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Module 5: Community Verification state
  const [verification, setVerification] = useState(null);
  const [loadingVerification, setLoadingVerification] = useState(true);
  const [verificationError, setVerificationError] = useState('');
  const [submittingVerification, setSubmittingVerification] = useState(false);

  const fetchVerification = useCallback(async (targetId) => {
    const incId = targetId || id || incident?.id;
    if (!incId) return;
    setLoadingVerification(true);
    setVerificationError('');
    try {
      const vData = await verificationService.getIncidentVerifications(incId);
      setVerification(vData);
    } catch (err) {
      setVerificationError(err.message || 'Unable to load verification information.');
    } finally {
      setLoadingVerification(false);
    }
  }, [id, incident?.id]);

  const fetchDetails = useCallback(async () => {
    const targetId = id || initialIncident?.id;
    if (!targetId) return;

    if (!initialIncident && !incident) {
      setLoading(true);
    }
    setErrorMessage('');

    try {
      const data = await incidentService.getIncidentById(targetId);
      setIncident(data);
    } catch (err) {
      if (!initialIncident && !incident) {
        setErrorMessage(err.message || 'Failed to load incident details.');
      }
    } finally {
      setLoading(false);
      fetchVerification(targetId);
    }
  }, [id, initialIncident, incident, fetchVerification]);

  useEffect(() => {
    fetchDetails();
    const unsubscribe = navigation.addListener('focus', () => {
      fetchDetails();
    });
    return unsubscribe;
  }, [navigation, fetchDetails]);

  // Handle Confirm or Dispute submission
  const handleVerify = async (verificationType) => {
    const incId = id || incident?.id;
    if (!incId || submittingVerification) return;

    setSubmittingVerification(true);
    setErrorMessage('');
    try {
      await verificationService.submitVerification(incId, verificationType);
      setSuccessMessage('Verification submitted successfully.');
      setTimeout(() => setSuccessMessage(''), 3500);
      // Immediately refresh verification summary from backend
      await fetchVerification(incId);
    } catch (err) {
      const msg = err.message || 'Unable to submit verification.';
      setErrorMessage(msg);
      setTimeout(() => setErrorMessage(''), 5000);
    } finally {
      setSubmittingVerification(false);
    }
  };

  const handleCancelPress = () => {
    if (Platform.OS === 'web') {
      const confirmed = window.confirm('Are you sure you want to cancel this safety incident report?');
      if (confirmed) {
        executeCancellation();
      }
    } else {
      Alert.alert(
        'Cancel Report',
        'Are you sure you want to cancel this safety report? This will change status to Cancelled and preserve an audit log.',
        [
          { text: 'No, Keep', style: 'cancel' },
          { text: 'Yes, Cancel Report', style: 'destructive', onPress: executeCancellation },
        ]
      );
    }
  };

  const executeCancellation = async () => {
    const incId = id || incident?.id;
    if (!incId) return;
    setCancelling(true);
    setErrorMessage('');
    try {
      const updated = await incidentService.cancelIncident(incId);
      setIncident(updated);
      setSuccessMessage('Report has been cancelled.');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to cancel incident.');
    } finally {
      setCancelling(false);
    }
  };

  const formatDate = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading && !incident) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading report details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (errorMessage && !incident) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerBox}>
          <Text style={styles.errorText}>{errorMessage}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchDetails}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const icon = CATEGORY_ICONS[incident?.category] || '📌';
  const sevColor = SEVERITY_COLORS[incident?.severity] || '#64748B';
  const statusCfg = STATUS_CONFIG[incident?.status] || { bg: '#F1F5F9', text: '#64748B', label: incident?.status };
  const imageUrl = incidentService.getImageUrl(incident?.image_url);

  // Self-verification check (User is reporter)
  const isReporter = !!(user?.id && incident?.reporter_id && user.id === incident.reporter_id);

  const verStatusCfg = VERIFICATION_STATUS_CONFIG[verification?.status] || VERIFICATION_STATUS_CONFIG.UNVERIFIED;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Messages */}
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

        {/* Top Badges & Status Card */}
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryIcon}>{icon}</Text>
              <Text style={styles.categoryText}>{incident?.category?.replace(/_/g, ' ')}</Text>
            </View>

            <View style={[styles.statusPill, { backgroundColor: statusCfg.bg }]}>
              <Text style={[styles.statusText, { color: statusCfg.text }]}>{statusCfg.label}</Text>
            </View>
          </View>

          <Text style={styles.title}>{incident?.title}</Text>

          <View style={styles.metaRow}>
            <View style={styles.severityTag}>
              <View style={[styles.severityDot, { backgroundColor: sevColor }]} />
              <Text style={[styles.severityTagText, { color: sevColor }]}>{incident?.severity} SEVERITY</Text>
            </View>
            <Text style={styles.dateText}>{formatDate(incident?.created_at)}</Text>
          </View>
        </View>

        {/* Attached Photo Evidence */}
        {imageUrl ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Attached Evidence Photo</Text>
            <Image
              source={{ uri: imageUrl }}
              style={styles.evidenceImage}
              resizeMode="cover"
            />
          </View>
        ) : null}

        {/* MODULE 5: Community Verification Section */}
        <View style={styles.card}>
          <View style={styles.verificationHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>Community Verification</Text>
              <Text style={styles.verificationSubTitle}>
                Peer verification by neighborhood residents
              </Text>
            </View>

            {verification?.status && (
              <View style={[styles.verificationStatusPill, { backgroundColor: verStatusCfg.bg }]}>
                <Text style={[styles.verificationStatusText, { color: verStatusCfg.text }]}>
                  {verStatusCfg.label}
                </Text>
              </View>
            )}
          </View>

          {loadingVerification && !verification ? (
            <View style={styles.verificationLoadingBox}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
              <Text style={styles.verificationLoadingText}>Loading verification...</Text>
            </View>
          ) : verificationError && !verification ? (
            <View style={styles.verificationErrorBox}>
              <Text style={styles.verificationErrorText}>{verificationError}</Text>
              <TouchableOpacity
                style={styles.verificationRetryBtn}
                onPress={() => fetchVerification(id || incident?.id)}
                activeOpacity={0.8}
              >
                <Text style={styles.verificationRetryBtnText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* Aggregated Counts */}
              <View style={styles.verificationCountsRow}>
                <View style={styles.countBadgeConfirm}>
                  <Text style={styles.countIconConfirm}>✓</Text>
                  <Text style={styles.countLabel}>Confirmed:</Text>
                  <Text style={styles.countValueConfirm}>{verification?.confirm_count ?? 0}</Text>
                </View>

                <View style={styles.countBadgeDispute}>
                  <Text style={styles.countIconDispute}>✕</Text>
                  <Text style={styles.countLabel}>Disputed:</Text>
                  <Text style={styles.countValueDispute}>{verification?.dispute_count ?? 0}</Text>
                </View>
              </View>

              {/* Status and User Verification State */}
              <View style={styles.communityStatusSummary}>
                <Text style={styles.communityStatusLabel}>
                  Status: <Text style={[styles.communityStatusValue, { color: verStatusCfg.text }]}>{verStatusCfg.label}</Text>
                </Text>
              </View>

              {/* Current User State & Verification Actions */}
              {isReporter ? (
                <View style={styles.userStateBoxReporter}>
                  <Text style={styles.userStateTextReporter}>
                    ℹ️ You cannot verify your own incident.
                  </Text>
                </View>
              ) : verification?.my_verification === 'CONFIRM' ? (
                <View style={styles.userStateBoxConfirmed}>
                  <Text style={styles.userStateTextConfirmed}>
                    ✓ You confirmed this incident.
                  </Text>
                </View>
              ) : verification?.my_verification === 'DISPUTE' ? (
                <View style={styles.userStateBoxDisputed}>
                  <Text style={styles.userStateTextDisputed}>
                    ✕ You disputed this incident.
                  </Text>
                </View>
              ) : (
                /* Action Buttons for non-reporters who haven't verified yet */
                <View style={styles.verificationActionsRow}>
                  <TouchableOpacity
                    style={[
                      styles.confirmBtn,
                      submittingVerification && styles.btnDisabled,
                    ]}
                    onPress={() => handleVerify('CONFIRM')}
                    disabled={submittingVerification}
                    activeOpacity={0.8}
                  >
                    {submittingVerification ? (
                      <View style={styles.submittingRow}>
                        <ActivityIndicator size="small" color="#FFFFFF" />
                        <Text style={styles.confirmBtnText}>Submitting...</Text>
                      </View>
                    ) : (
                      <Text style={styles.confirmBtnText}>✓ Confirm Incident</Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.disputeBtn,
                      submittingVerification && styles.btnDisabled,
                    ]}
                    onPress={() => handleVerify('DISPUTE')}
                    disabled={submittingVerification}
                    activeOpacity={0.8}
                  >
                    {submittingVerification ? (
                      <View style={styles.submittingRow}>
                        <ActivityIndicator size="small" color="#DC2626" />
                        <Text style={styles.disputeBtnText}>Submitting...</Text>
                      </View>
                    ) : (
                      <Text style={styles.disputeBtnText}>✕ Dispute Incident</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
        </View>

        {/* Description Section */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Incident Description</Text>
          <Text style={styles.descriptionText}>{incident?.description}</Text>
        </View>

        {/* Location Section */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Location & Coordinates</Text>
          <View style={styles.locationContainer}>
            <Text style={styles.locName}>
              📍 {incident?.neighborhood_name ? `${incident.neighborhood_name}, ` : ''}{incident?.locality || 'Neighborhood Zone'}, {incident?.city || 'Ratnagiri'}
            </Text>
            <Text style={styles.coordsText}>
              Latitude: {incident?.latitude?.toFixed(4)}° N | Longitude: {incident?.longitude?.toFixed(4)}° E
            </Text>
          </View>
        </View>

        {/* Audit Details */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Report Audit Information</Text>
          <View style={styles.auditRow}>
            <Text style={styles.auditLabel}>Report ID:</Text>
            <Text style={styles.auditValue}>{incident?.id}</Text>
          </View>
          <View style={styles.auditRow}>
            <Text style={styles.auditLabel}>Last Updated:</Text>
            <Text style={styles.auditValue}>{formatDate(incident?.updated_at)}</Text>
          </View>
        </View>

        {/* Reporter Action Controls (Only available if owned and PENDING) */}
        {isReporter && incident?.status === 'PENDING' ? (
          <View style={styles.actionsContainer}>
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => navigation.navigate('EditIncident', { incident })}
              activeOpacity={0.8}
            >
              <Text style={styles.editButtonText}>✏️ Edit Report</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleCancelPress}
              disabled={cancelling}
              activeOpacity={0.8}
            >
              {cancelling ? (
                <ActivityIndicator color="#EF4444" size="small" />
              ) : (
                <Text style={styles.cancelButtonText}>✕ Cancel Report</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : null}
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
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
  },
  loadingText: {
    marginTop: 10,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    ...theme.shadows.card,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: theme.borderRadius.full,
  },
  categoryIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.full,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  title: {
    fontSize: theme.typography.sizes.md + 2,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 8,
    lineHeight: 24,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: 8,
  },
  severityTag: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  severityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  severityTagText: {
    fontSize: 11,
    fontWeight: '700',
  },
  dateText: {
    fontSize: 11,
    color: theme.colors.textMuted,
  },
  sectionTitle: {
    fontSize: theme.typography.sizes.sm + 1,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  evidenceImage: {
    width: '100%',
    height: 220,
    borderRadius: theme.borderRadius.md,
    backgroundColor: '#E2E8F0',
  },
  descriptionText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    lineHeight: 22,
  },
  locationContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: theme.borderRadius.md,
    padding: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  locName: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  coordsText: {
    fontSize: 11,
    color: theme.colors.textMuted,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  auditRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  auditLabel: {
    fontSize: 11,
    color: theme.colors.textSecondary,
  },
  auditValue: {
    fontSize: 11,
    color: theme.colors.textMuted,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },

  /* Module 5: Community Verification Styles */
  verificationHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  verificationSubTitle: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  verificationStatusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.full,
    marginLeft: 8,
  },
  verificationStatusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  verificationLoadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  verificationLoadingText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  verificationErrorBox: {
    backgroundColor: '#FEE2E2',
    borderRadius: theme.borderRadius.md,
    padding: 10,
    alignItems: 'center',
    marginVertical: 6,
  },
  verificationErrorText: {
    fontSize: 12,
    color: theme.colors.error,
    marginBottom: 6,
  },
  verificationRetryBtn: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.sm,
  },
  verificationRetryBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  verificationCountsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  countBadgeConfirm: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: theme.borderRadius.md,
  },
  countIconConfirm: {
    fontSize: 14,
    fontWeight: '800',
    color: '#059669',
    marginRight: 6,
  },
  countBadgeDispute: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: theme.borderRadius.md,
  },
  countIconDispute: {
    fontSize: 14,
    fontWeight: '800',
    color: '#DC2626',
    marginRight: 6,
  },
  countLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontWeight: '600',
    marginRight: 4,
  },
  countValueConfirm: {
    fontSize: 14,
    fontWeight: '800',
    color: '#047857',
  },
  countValueDispute: {
    fontSize: 14,
    fontWeight: '800',
    color: '#B91C1C',
  },
  communityStatusSummary: {
    marginBottom: 12,
  },
  communityStatusLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontWeight: '600',
  },
  communityStatusValue: {
    fontWeight: '800',
  },
  userStateBoxReporter: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  userStateTextReporter: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontWeight: '600',
  },
  userStateBoxConfirmed: {
    backgroundColor: '#D1FAE5',
    borderWidth: 1,
    borderColor: '#6EE7B7',
    borderRadius: theme.borderRadius.md,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  userStateTextConfirmed: {
    fontSize: 12,
    color: '#065F46',
    fontWeight: '700',
  },
  userStateBoxDisputed: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: theme.borderRadius.md,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  userStateTextDisputed: {
    fontSize: 12,
    color: '#991B1B',
    fontWeight: '700',
  },
  verificationActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  confirmBtn: {
    flex: 1,
    backgroundColor: '#059669',
    paddingVertical: 12,
    minHeight: 44,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.button,
  },
  confirmBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  disputeBtn: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#DC2626',
    paddingVertical: 12,
    minHeight: 44,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disputeBtnText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '700',
  },
  submittingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  btnDisabled: {
    opacity: 0.6,
  },

  /* Report Action Buttons */
  actionsContainer: {
    gap: 10,
    marginTop: 6,
    marginBottom: theme.spacing.xl,
  },
  editButton: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: theme.borderRadius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  editButtonText: {
    color: theme.colors.primary,
    fontSize: theme.typography.sizes.sm,
    fontWeight: '700',
  },
  cancelButton: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: theme.borderRadius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: theme.colors.error,
    fontSize: theme.typography.sizes.sm,
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
  retryBtn: {
    marginTop: 12,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.md,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
