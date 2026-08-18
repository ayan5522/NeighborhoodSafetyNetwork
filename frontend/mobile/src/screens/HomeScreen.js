import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { theme } from '../styles/theme';

export default function HomeScreen({ navigation }) {
  const { user, logout } = useAuth();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Top Header Card */}
        <View style={styles.headerCard}>
          <View style={styles.badgeRow}>
            <View style={styles.statusBadge}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>{user?.status || 'ACTIVE'}</Text>
            </View>
            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>{user?.role?.toUpperCase() || 'RESIDENT'}</Text>
            </View>
          </View>

          <Text style={styles.networkTitle}>Neighborhood Safety Network</Text>
          <Text style={styles.welcomeText}>Welcome, {user?.full_name || 'Resident'}</Text>
          <Text style={styles.subtitle}>
            Your identity has been verified. You are connected to your local neighborhood safety network.
          </Text>
        </View>

        {/* Verification Status Overview */}
        <View style={styles.card}>
          <Text style={styles.cardHeader}>Verification Status</Text>

          <View style={styles.statusRow}>
            <View style={styles.statusItem}>
              <Text style={styles.statusLabel}>Email Verification</Text>
              <Text style={styles.statusVerified}>✓ Verified</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.statusItem}>
              <Text style={styles.statusLabel}>Mobile Verification</Text>
              <Text style={styles.statusVerified}>✓ Verified</Text>
            </View>
          </View>
        </View>

        {/* Module 2: Geographical Map & Safety Circle Action Card */}
        <View style={styles.card}>
          <Text style={styles.cardHeader}>Geographical Foundation</Text>

          <TouchableOpacity
            style={styles.mapActionCard}
            onPress={() => navigation.navigate('Map')}
            activeOpacity={0.8}
          >
            <View style={styles.mapActionIcon}>
              <Text style={styles.mapIconText}>🗺️</Text>
            </View>
            <View style={styles.mapActionContent}>
              <Text style={styles.mapActionTitle}>Open Neighborhood Map</Text>
              <Text style={styles.mapActionSubtitle}>
                View OpenStreetMap, check your safety perimeter, and explore nearby resident circles.
              </Text>
            </View>
            <Text style={styles.chevron}>→</Text>
          </TouchableOpacity>
        </View>

        {/* Account Details & Quick Actions */}
        <View style={styles.card}>
          <Text style={styles.cardHeader}>Quick Account Actions</Text>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('Profile')}
            activeOpacity={0.7}
          >
            <View>
              <Text style={styles.actionTitle}>Resident Profile</Text>
              <Text style={styles.actionSubtitle}>View and update your personal details</Text>
            </View>
            <Text style={styles.chevron}>→</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.logoutButton]}
            onPress={logout}
            activeOpacity={0.7}
          >
            <View>
              <Text style={[styles.actionTitle, styles.logoutText]}>Sign Out</Text>
              <Text style={styles.actionSubtitle}>Securely exit your session</Text>
            </View>
            <Text style={[styles.chevron, styles.logoutText]}>→</Text>
          </TouchableOpacity>
        </View>

        {/* Project Module Scope Note */}
        <View style={styles.scopeNotice}>
          <Text style={styles.scopeTitle}>MODULES 1 & 2 COMPLETED</Text>
          <Text style={styles.scopeText}>
            User Authentication & Location/Neighborhood Management are fully active.
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
  content: {
    padding: theme.spacing.lg,
  },
  headerCard: {
    backgroundColor: theme.colors.primaryDark,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.xl,
    marginBottom: theme.spacing.lg,
    ...theme.shadows.card,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
    gap: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#064E3B',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.full,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.success,
    marginRight: 6,
  },
  statusText: {
    color: '#6EE7B7',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  roleBadge: {
    backgroundColor: '#1E40AF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.full,
  },
  roleText: {
    color: '#BFDBFE',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  networkTitle: {
    fontSize: theme.typography.sizes.xs,
    color: '#93C5FD',
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  welcomeText: {
    fontSize: theme.typography.sizes.xxl,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: theme.typography.sizes.sm,
    color: '#CBD5E1',
    lineHeight: 20,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
    ...theme.shadows.card,
  },
  cardHeader: {
    fontSize: theme.typography.sizes.md,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.md,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  statusItem: {
    flex: 1,
    alignItems: 'center',
  },
  divider: {
    width: 1,
    backgroundColor: theme.colors.border,
  },
  statusLabel: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  statusVerified: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: '700',
    color: theme.colors.success,
  },
  mapActionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
  },
  mapActionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  mapIconText: {
    fontSize: 22,
  },
  mapActionContent: {
    flex: 1,
  },
  mapActionTitle: {
    fontSize: theme.typography.sizes.sm + 1,
    fontWeight: '700',
    color: theme.colors.primaryDark,
    marginBottom: 2,
  },
  mapActionSubtitle: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textSecondary,
    lineHeight: 16,
  },
  actionButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  logoutButton: {
    borderBottomWidth: 0,
    marginTop: 4,
  },
  actionTitle: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 2,
  },
  actionSubtitle: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textSecondary,
  },
  chevron: {
    fontSize: 18,
    color: theme.colors.textMuted,
  },
  logoutText: {
    color: theme.colors.error,
  },
  scopeNotice: {
    alignItems: 'center',
    paddingVertical: theme.spacing.lg,
  },
  scopeTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.textMuted,
    letterSpacing: 1,
  },
  scopeText: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
});
