import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  SafeAreaView,
} from 'react-native';
import emergencyContactService from '../services/emergencyContactService';
import { theme } from '../styles/theme';

export default function EmergencyContactsScreen({ navigation }) {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchContacts();
    });
    fetchContacts();
    return unsubscribe;
  }, [navigation]);

  const fetchContacts = async () => {
    setLoading(true);
    try {
      const data = await emergencyContactService.getContacts();
      setContacts(data || []);
    } catch (err) {
      console.warn('[Emergency Contacts Error]', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteContact = (contact) => {
    Alert.alert(
      'Remove Emergency Contact',
      `Are you sure you want to remove ${contact.name} (${contact.phone_number}) from your emergency contacts?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await emergencyContactService.deleteContact(contact.id);
              fetchContacts();
            } catch (err) {
              Alert.alert('Error', 'Failed to remove contact.');
            }
          },
        },
      ]
    );
  };

  const renderContactCard = ({ item }) => (
    <View style={styles.contactCard}>
      <View style={styles.contactHeader}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
        </View>

        <View style={styles.contactInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.contactName}>{item.name}</Text>
            {item.is_primary && (
              <View style={styles.primaryBadge}>
                <Text style={styles.primaryText}>PRIMARY</Text>
              </View>
            )}
          </View>
          <Text style={styles.phoneText}>📞 {item.phone_number}</Text>
          <Text style={styles.relText}>Relationship: {item.relationship || 'Emergency Contact'}</Text>
        </View>
      </View>

      <View style={styles.cardActions}>
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={() => handleDeleteContact(item)}
          activeOpacity={0.7}
        >
          <Text style={styles.deleteBtnText}>🗑️ Remove</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header Info Banner */}
      <View style={styles.infoBanner}>
        <Text style={styles.infoTitle}>🛡️ Your Emergency Contacts</Text>
        <Text style={styles.infoSubtitle}>
          Your primary emergency contact will receive automatic alerts when you trigger a Personal SOS or request emergency assistance.
        </Text>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading contacts...</Text>
        </View>
      ) : (
        <FlatList
          data={contacts}
          keyExtractor={(item) => item.id}
          renderItem={renderContactCard}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>👥</Text>
              <Text style={styles.emptyTitle}>No Emergency Contact Set</Text>
              <Text style={styles.emptySubtitle}>
                Add a trusted family member or neighbor. You can select directly from your phone contacts or enter details manually.
              </Text>
            </View>
          }
        />
      )}

      {/* Add / Change Contact Action Button */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => navigation.navigate('AddEmergencyContact')}
          activeOpacity={0.8}
        >
          <Text style={styles.addBtnText}>+ Add / Select Emergency Contact</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  infoBanner: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  infoTitle: {
    fontSize: theme.typography.sizes.md,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  infoSubtitle: {
    fontSize: theme.typography.sizes.xs + 1,
    color: theme.colors.textSecondary,
    lineHeight: 18,
  },
  listContent: {
    padding: theme.spacing.md,
    gap: 12,
  },
  contactCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.card,
  },
  contactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  contactInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  contactName: {
    fontSize: theme.typography.sizes.sm + 1,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  primaryBadge: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.full,
  },
  primaryText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#065F46',
  },
  phoneText: {
    fontSize: theme.typography.sizes.xs + 1,
    color: theme.colors.textPrimary,
    fontWeight: '500',
    marginBottom: 2,
  },
  relText: {
    fontSize: 11,
    color: theme.colors.textMuted,
  },
  cardActions: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 8,
    alignItems: 'flex-end',
  },
  deleteBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  deleteBtnText: {
    fontSize: 12,
    color: theme.colors.error,
    fontWeight: '600',
  },
  bottomBar: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  addBtn: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 14,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    ...theme.shadows.button,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontSize: theme.typography.sizes.sm + 1,
    fontWeight: '700',
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
