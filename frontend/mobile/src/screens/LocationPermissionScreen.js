import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import locationService from '../services/locationService';
import { theme } from '../styles/theme';

export default function LocationPermissionScreen({ navigation }) {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleRequestPermission = async () => {
    setErrorMessage('');
    setLoading(true);

    try {
      const isEnabled = await locationService.isLocationServicesEnabled();
      if (!isEnabled) {
        setErrorMessage('Location services (GPS) are currently turned off on your device. Please turn on GPS in your phone settings.');
        setLoading(false);
        return;
      }

      const result = await locationService.requestPermission();
      if (result.granted) {
        // Permission granted, navigate to MapScreen
        navigation.replace('Map');
      } else {
        setErrorMessage('Location permission was denied. To enable safety alerts in your area, please grant location access in device app settings.');
      }
    } catch (err) {
      setErrorMessage(err.message || 'An error occurred while requesting location permissions.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header Icon / Badge */}
        <View style={styles.header}>
          <View style={styles.iconCircle}>
            <Text style={styles.iconText}>📍</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>GEOGRAPHICAL SAFETY PERIMETER</Text>
          </View>
          <Text style={styles.title}>Enable Location Access</Text>
          <Text style={styles.subtitle}>
            Neighborhood Safety Network connects verified residents within geographical safety circles to coordinate emergency responses.
          </Text>
        </View>

        {errorMessage ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        {/* Value Propositions / Privacy Card */}
        <View style={styles.card}>
          <View style={styles.featureRow}>
            <Text style={styles.featureIcon}>🛡️</Text>
            <View style={styles.featureTextContainer}>
              <Text style={styles.featureTitle}>Localized Safety Circles</Text>
              <Text style={styles.featureDescription}>
                Receive and verify neighborhood alerts relevant to your immediate 1–5 km radius.
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.featureRow}>
            <Text style={styles.featureIcon}>🔒</Text>
            <View style={styles.featureTextContainer}>
              <Text style={styles.featureTitle}>Strict Privacy & Zero Tracking</Text>
              <Text style={styles.featureDescription}>
                Your exact coordinates are never shown to other users. We only use PostGIS spatial bounds for aggregate circle stats.
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.featureRow}>
            <Text style={styles.featureIcon}>⚡</Text>
            <View style={styles.featureTextContainer}>
              <Text style={styles.featureTitle}>On-Demand Foreground GPS</Text>
              <Text style={styles.featureDescription}>
                GPS is only checked when you open the map or manually refresh your location.
              </Text>
            </View>
          </View>
        </View>

        {/* Actions */}
        <TouchableOpacity
          style={[styles.primaryButton, loading && styles.buttonDisabled]}
          onPress={handleRequestPermission}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>Allow Location Access</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => navigation.goBack()}
          disabled={loading}
        >
          <Text style={styles.secondaryButtonText}>Not Now (Return Home)</Text>
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
    flexGrow: 1,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
    ...theme.shadows.card,
  },
  iconText: {
    fontSize: 36,
  },
  badge: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.full,
    marginBottom: theme.spacing.sm,
  },
  badgeText: {
    color: '#0369A1',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  title: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: '700',
    color: theme.colors.primaryDark,
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.xl,
    ...theme.shadows.card,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 8,
  },
  featureIcon: {
    fontSize: 24,
    marginRight: 14,
    marginTop: 2,
  },
  featureTextContainer: {
    flex: 1,
  },
  featureTitle: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 3,
  },
  featureDescription: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textSecondary,
    lineHeight: 18,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: 10,
  },
  primaryButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 14,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    ...theme.shadows.button,
    marginBottom: 12,
  },
  buttonDisabled: {
    backgroundColor: theme.colors.disabled,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: theme.typography.sizes.md,
    fontWeight: '700',
  },
  secondaryButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.sm,
    fontWeight: '600',
  },
  errorBox: {
    backgroundColor: theme.colors.errorLight,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.md,
  },
  errorText: {
    color: theme.colors.error,
    fontSize: theme.typography.sizes.sm,
    textAlign: 'center',
  },
});
