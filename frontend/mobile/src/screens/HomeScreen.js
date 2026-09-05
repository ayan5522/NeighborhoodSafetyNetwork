import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import alertService from '../services/alertService';
import { theme } from '../styles/theme';

export default function HomeScreen({ navigation }) {
  const { user, logout } = useAuth();
  const [unreadAlerts, setUnreadAlerts] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const fetchUnreadCount = async () => {
    try {
      const count = await alertService.getUnreadCount();
      setUnreadAlerts(count);
    } catch (e) {}
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchUnreadCount();
    });
    fetchUnreadCount();
    return unsubscribe;
  }, [navigation]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchUnreadCount();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
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
            Your identity and local perimeter are active. You are protected by your community network.
          </Text>
        </View>

        {/* 1. PERSONAL SOS EMERGENCY ACTION CARD */}
        <TouchableOpacity
          style={styles.sosCard}
          onPress={() => navigation.navigate('SOSConfirmation')}
          activeOpacity={0.85}
        >
          <View style={styles.sosIconCircle}>
            <Text style={styles.sosIconText}>🚨</Text>
          </View>
          <View style={styles.sosContent}>
            <Text style={styles.sosTitle}>EMERGENCY SOS</Text>
            <Text style={styles.sosSubtitle}>
              Tap if YOU need immediate help. Connects to 112 & notifies your emergency contact.
            </Text>
          </View>
          <Text style={styles.sosArrow}>→</Text>
        </TouchableOpacity>

        {/* 2. NEIGHBORHOOD ALERTS FEED CARD */}
        <TouchableOpacity
          style={[styles.alertsCard, unreadAlerts > 0 && styles.alertsCardUnread]}
          onPress={() => navigation.navigate('Alerts')}
          activeOpacity={0.8}
        >
          <View style={styles.alertCardIcon}>
            <Text style={styles.alertIconText}>🔔</Text>
          </View>
          <View style={styles.alertCardContent}>
            <View style={styles.alertCardTitleRow}>
              <Text style={styles.alertCardTitle}>Neighborhood Alerts</Text>
              {unreadAlerts > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadBadgeText}>{unreadAlerts} NEW</Text>
                </View>
              )}
            </View>
            <Text style={styles.alertCardSub}>
              {unreadAlerts > 0
                ? `You have ${unreadAlerts} unread safety alert${unreadAlerts > 1 ? 's' : ''} in your area.`
                : 'View active safety alerts targeted to your neighborhood perimeter.'}
            </Text>
          </View>
          <Text style={styles.chevron}>→</Text>
        </TouchableOpacity>

        {/* 3. SAFETY ACTIONS GRID (Report Incident & My Reports) */}
        <View style={styles.card}>
          <Text style={styles.cardHeader}>Neighborhood Safety Actions</Text>

          <TouchableOpacity
            style={styles.actionCardPrimary}
            onPress={() => navigation.navigate('ReportIncident')}
            activeOpacity={0.8}
          >
            <View style={styles.actionCardIcon}>
              <Text style={styles.actionIconText}>📢</Text>
            </View>
            <View style={styles.actionCardContent}>
              <Text style={styles.actionCardTitle}>Report Safety Incident</Text>
              <Text style={styles.actionCardSubtitle}>
                Report accidents, hazards, fires, or medical situations to nearby residents.
              </Text>
            </View>
            <Text style={styles.chevron}>→</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionCardSecondary, { marginTop: 10 }]}
            onPress={() => navigation.navigate('MyReports')}
            activeOpacity={0.8}
          >
            <View style={[styles.actionCardIcon, { backgroundColor: '#F1F5F9' }]}>
              <Text style={styles.actionIconText}>📋</Text>
            </View>
            <View style={styles.actionCardContent}>
              <Text style={styles.actionCardTitle}>My Safety Reports</Text>
              <Text style={styles.actionCardSubtitle}>
                Track the status, edit, or view audit details of your submitted incident reports.
              </Text>
            </View>
            <Text style={styles.chevron}>→</Text>
          </TouchableOpacity>
        </View>

        {/* 4. MAP & EMERGENCY CONTACTS */}
        <View style={styles.card}>
          <Text style={styles.cardHeader}>Tools & Contacts</Text>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('EmergencyContacts')}
            activeOpacity={0.7}
          >
            <View>
              <Text style={styles.actionTitle}>👥 Emergency Contacts</Text>
              <Text style={styles.actionSubtitle}>Configure primary contact for automated SOS alerts</Text>
            </View>
            <Text style={styles.chevron}>→</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('Map')}
            activeOpacity={0.7}
          >
            <View>
              <Text style={styles.actionTitle}>🗺️ Open Neighborhood Map</Text>
              <Text style={styles.actionSubtitle}>View OpenStreetMap safety perimeter and nearby nodes</Text>
            </View>
            <Text style={styles.chevron}>→</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('Profile')}
            activeOpacity={0.7}
          >
            <View>
              <Text style={styles.actionTitle}>👤 Resident Profile</Text>
              <Text style={styles.actionSubtitle}>View account details and verified identity</Text>
            </View>
            <Text style={styles.chevron}>→</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.logoutButton]}
            onPress={logout}
            activeOpacity={0.7}
          >
            <View>
              <Text style={[styles.actionTitle, styles.logoutText]}>🚪 Sign Out</Text>
              <Text style={styles.actionSubtitle}>Securely exit your session</Text>
            </View>
            <Text style={[styles.chevron, styles.logoutText]}>→</Text>
          </TouchableOpacity>
        </View>

        {/* Project Module Scope Note */}
        <View style={styles.scopeNotice}>
          <Text style={styles.scopeTitle}>MODULES 1, 2, 3 & 4 ACTIVE</Text>
          <Text style={styles.scopeText}>
            Authentication, Location, Incident Reporting & Emergency Alert Management are operational.
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
    gap: 14,
  },
  headerCard: {
    backgroundColor: theme.colors.primaryDark,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.xl,
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

  // SOS Card
  sosCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#991B1B',
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    borderWidth: 2,
    borderColor: '#DC2626',
    ...theme.shadows.button,
    elevation: 6,
  },
  sosIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  sosIconText: {
    fontSize: 24,
  },
  sosContent: {
    flex: 1,
  },
  sosTitle: {
    fontSize: theme.typography.sizes.md + 1,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  sosSubtitle: {
    fontSize: 11,
    color: '#FEE2E2',
    lineHeight: 16,
  },
  sosArrow: {
    fontSize: 22,
    color: '#FFFFFF',
    fontWeight: '900',
  },

  // Alerts Card
  alertsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md + 2,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.card,
  },
  alertsCardUnread: {
    borderColor: '#93C5FD',
    backgroundColor: '#F8FAFF',
    borderLeftWidth: 5,
    borderLeftColor: theme.colors.primary,
  },
  alertCardIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  alertIconText: {
    fontSize: 22,
  },
  alertCardContent: {
    flex: 1,
  },
  alertCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  alertCardTitle: {
    fontSize: theme.typography.sizes.sm + 1,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  unreadBadge: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.full,
  },
  unreadBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  alertCardSub: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    lineHeight: 16,
  },

  // Actions Grid
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.card,
  },
  cardHeader: {
    fontSize: theme.typography.sizes.sm + 1,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.md,
  },
  actionCardPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
  },
  actionCardSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
  },
  actionCardIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  actionIconText: {
    fontSize: 22,
  },
  actionCardContent: {
    flex: 1,
  },
  actionCardTitle: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: '700',
    color: theme.colors.primaryDark,
    marginBottom: 2,
  },
  actionCardSubtitle: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    lineHeight: 16,
  },
  actionButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
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
    fontSize: 11,
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
    paddingVertical: theme.spacing.md,
  },
  scopeTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.textMuted,
    letterSpacing: 1,
  },
  scopeText: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 2,
    textAlign: 'center',
  },
});
