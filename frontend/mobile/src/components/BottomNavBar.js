import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import alertService from '../services/alertService';
import { theme } from '../styles/theme';

export default function BottomNavBar({ navigation, activeTab = 'Home' }) {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let isMounted = true;
    const loadUnread = async () => {
      try {
        const count = await alertService.getUnreadCount();
        if (isMounted) setUnreadCount(count || 0);
      } catch (e) {}
    };
    loadUnread();
    return () => {
      isMounted = false;
    };
  }, []);

  const tabs = [
    {
      id: 'Home',
      label: 'Home',
      icon: '🏠',
      screen: 'Home',
    },
    {
      id: 'Map',
      label: 'Map',
      icon: '🗺️',
      screen: 'Map',
    },
    {
      id: 'Alerts',
      label: 'Alerts',
      icon: '🔔',
      screen: 'Alerts',
      badge: unreadCount,
    },
    {
      id: 'Profile',
      label: 'Profile',
      icon: '👤',
      screen: 'Profile',
    },
  ];

  const handleTabPress = (screenName) => {
    if (activeTab === screenName) return;
    navigation.navigate(screenName);
  };

  return (
    <View style={styles.container}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tabItem, isActive && styles.activeTabItem]}
            onPress={() => handleTabPress(tab.screen)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`${tab.label} tab`}
            accessibilityState={{ selected: isActive }}
          >
            <View style={styles.iconContainer}>
              <Text style={[styles.tabIcon, isActive && styles.activeTabIcon]}>{tab.icon}</Text>
              {Boolean(tab.badge && tab.badge > 0) && (
                <View style={styles.badgeContainer}>
                  <Text style={styles.badgeText}>
                    {tab.badge > 9 ? '9+' : tab.badge}
                  </Text>
                </View>
              )}
            </View>
            <Text style={[styles.tabLabel, isActive && styles.activeTabLabel]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 24 : 10,
    paddingHorizontal: 8,
    justifyContent: 'space-around',
    alignItems: 'center',
    ...theme.shadows.card,
    elevation: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    borderRadius: theme.borderRadius.md,
  },
  activeTabItem: {
    backgroundColor: '#EFF6FF',
  },
  iconContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 28,
    marginBottom: 2,
  },
  tabIcon: {
    fontSize: 20,
    opacity: 0.7,
  },
  activeTabIcon: {
    opacity: 1,
    transform: [{ scale: 1.08 }],
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  activeTabLabel: {
    color: theme.colors.primary,
    fontWeight: '700',
  },
  badgeContainer: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: '#EF4444',
    borderRadius: 9,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
});
