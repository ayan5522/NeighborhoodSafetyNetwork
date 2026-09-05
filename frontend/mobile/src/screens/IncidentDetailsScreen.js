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

export default function IncidentDetailsScreen({ route, navigation }) {
  const { id } = route.params || {};
  const [incident, setIncident] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const fetchDetails = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setErrorMessage('');
    try {
      const data = await incidentService.getIncidentById(id);
      setIncident(data);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to load incident details.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDetails();
    const unsubscribe = navigation.addListener('focus', () => {
      fetchDetails();
    });
    return unsubscribe;
  }, [navigation, fetchDetails]);

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
    setCancelling(true);
    setErrorMessage('');
    try {
      const updated = await incidentService.cancelIncident(id);
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

  if (loading) {
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

        {/* Action Controls */}
        {incident?.status === 'PENDING' ? (
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
    marginBottom: 8,
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
