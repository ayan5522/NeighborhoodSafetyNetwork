import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
} from 'react-native';
import alertService from '../services/alertService';
import { theme } from '../styles/theme';

const PRIORITY_THEMES = {
  URGENT: { color: '#EF4444', bg: '#FEE2E2', label: 'URGENT' },
  HIGH: { color: '#F97316', bg: '#FFEDD5', label: 'HIGH' },
  NORMAL: { color: '#F59E0B', bg: '#FEF3C7', label: 'NORMAL' },
  LOW: { color: '#10B981', bg: '#D1FAE5', label: 'LOW' },
};

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

export default function AlertsScreen({ navigation }) {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterTab, setFilterTab] = useState('ALL'); // 'ALL' | 'UNREAD' | 'URGENT'

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await alertService.getAlerts({
        unreadOnly: filterTab === 'UNREAD',
        limit: 30,
      });

      let items = res.data || [];
      if (filterTab === 'URGENT') {
        items = items.filter((a) => a.priority === 'URGENT' || a.priority === 'HIGH');
      }
      setAlerts(items);
    } catch (err) {
      console.warn('[Alerts Feed Error]', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filterTab]);

  useEffect(() => {
    setLoading(true);
    fetchAlerts();
  }, [fetchAlerts]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchAlerts();
  };

  const formatDistance = (meters) => {
    if (meters === null || meters === undefined) return 'Nearby';
    if (meters < 1000) return `~${meters} m away`;
    return `~${(meters / 1000).toFixed(1)} km away`;
  };

  const formatTimeAgo = (dateString) => {
    if (!dateString) return '';
    const diffMs = Date.now() - new Date(dateString).getTime();
    const mins = Math.floor(diffMs / (1000 * 60));
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const renderAlertItem = ({ item }) => {
    const isUnread = !item.read_at && item.status === 'ACTIVE';
    const prio = PRIORITY_THEMES[item.priority] || PRIORITY_THEMES.NORMAL;
    const catIcon = CATEGORY_ICONS[item.incident_category] || '📌';

    return (
      <TouchableOpacity
        style={[
          styles.alertCard,
          isUnread && styles.unreadAlertCard,
        ]}
        onPress={() => navigation.navigate('AlertDetails', { id: item.alert_id })}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <View style={styles.catBadge}>
            <Text style={styles.catIcon}>{catIcon}</Text>
            <Text style={styles.catText}>{item.incident_category}</Text>
          </View>

          <View style={[styles.priorityPill, { backgroundColor: prio.bg }]}>
            <Text style={[styles.priorityText, { color: prio.color }]}>
              {prio.label}
            </Text>
          </View>
        </View>

        <Text style={[styles.alertTitle, isUnread && styles.unreadTitle]} numberOfLines={2}>
          {item.incident_title}
        </Text>

        <Text style={styles.alertDesc} numberOfLines={2}>
          {item.incident_description}
        </Text>

        <View style={styles.cardFooter}>
          <View style={styles.distanceBadge}>
            <Text style={styles.distanceText}>
              📍 {formatDistance(item.approximate_distance_meters)}
              {item.neighborhood_name ? ` • ${item.neighborhood_name}` : ''}
            </Text>
          </View>

          <View style={styles.timeRow}>
            {isUnread && <View style={styles.unreadDot} />}
            <Text style={styles.timeText}>{formatTimeAgo(item.alert_created_at)}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Filter Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabBtn, filterTab === 'ALL' && styles.tabBtnActive]}
          onPress={() => setFilterTab('ALL')}
        >
          <Text style={[styles.tabBtnText, filterTab === 'ALL' && styles.tabBtnTextActive]}>
            All Alerts
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, filterTab === 'UNREAD' && styles.tabBtnActive]}
          onPress={() => setFilterTab('UNREAD')}
        >
          <Text style={[styles.tabBtnText, filterTab === 'UNREAD' && styles.tabBtnTextActive]}>
            Unread
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, filterTab === 'URGENT' && styles.tabBtnActive]}
          onPress={() => setFilterTab('URGENT')}
        >
          <Text style={[styles.tabBtnText, filterTab === 'URGENT' && styles.tabBtnTextActive]}>
            🚨 Urgent / High
          </Text>
        </TouchableOpacity>
      </View>

      {/* Alert Feed */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Fetching neighborhood alerts...</Text>
        </View>
      ) : (
        <FlatList
          data={alerts}
          keyExtractor={(item) => item.alert_id}
          renderItem={renderAlertItem}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🛡️</Text>
              <Text style={styles.emptyTitle}>All Clear in Your Area</Text>
              <Text style={styles.emptySubtitle}>
                There are no active emergency alerts targeting your location at this time.
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    gap: 8,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.full,
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
  },
  tabBtnActive: {
    backgroundColor: theme.colors.primary,
  },
  tabBtnText: {
    fontSize: theme.typography.sizes.xs + 1,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  tabBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  listContent: {
    padding: theme.spacing.md,
    gap: 12,
  },
  alertCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.card,
  },
  unreadAlertCard: {
    borderColor: '#93C5FD',
    backgroundColor: '#F8FAFF',
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.primary,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  catBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.borderRadius.full,
  },
  catIcon: {
    fontSize: 12,
    marginRight: 4,
  },
  catText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  priorityPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.borderRadius.full,
  },
  priorityText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  alertTitle: {
    fontSize: theme.typography.sizes.sm + 1,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  unreadTitle: {
    fontWeight: '700',
    color: '#0F172A',
  },
  alertDesc: {
    fontSize: theme.typography.sizes.xs + 1,
    color: theme.colors.textSecondary,
    lineHeight: 18,
    marginBottom: 10,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 8,
  },
  distanceBadge: {
    flex: 1,
  },
  distanceText: {
    fontSize: 11,
    color: theme.colors.textMuted,
    fontWeight: '500',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  unreadDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.primary,
    marginRight: 6,
  },
  timeText: {
    fontSize: 11,
    color: theme.colors.textMuted,
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
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xxl,
    marginTop: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: theme.typography.sizes.md,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
});
