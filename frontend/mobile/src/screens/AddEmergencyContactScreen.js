import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  Platform,
  Modal,
  FlatList,
} from 'react-native';
import * as Contacts from 'expo-contacts';
import emergencyContactService from '../services/emergencyContactService';
import { theme } from '../styles/theme';

const RELATIONSHIPS = [
  'Mother',
  'Father',
  'Spouse',
  'Sibling',
  'Child',
  'Friend',
  'Neighbor',
  'Emergency Contact',
];

export default function AddEmergencyContactScreen({ navigation }) {
  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [relationship, setRelationship] = useState('Emergency Contact');
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Device Contacts Picker State
  const [contactListModalVisible, setContactListModalVisible] = useState(false);
  const [deviceContacts, setDeviceContacts] = useState([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  /**
   * Request device contact permission and open contact picker
   */
  const handleSelectFromPhone = async () => {
    setErrorMessage('');
    try {
      if (Platform.OS === 'web') {
        Alert.alert('Device Contacts', 'Device contact picker is available on physical mobile devices. Please enter details manually below.');
        return;
      }

      setContactsLoading(true);
      const { status } = await Contacts.requestPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert(
          'Contacts Permission',
          'Contact permission was not granted. You can still easily type your contact details below manually.'
        );
        setContactsLoading(false);
        return;
      }

      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers],
      });

      if (data && data.length > 0) {
        // Filter contacts that have valid phone numbers
        const validContacts = data.filter((c) => c.phoneNumbers && c.phoneNumbers.length > 0);
        setDeviceContacts(validContacts);
        setContactListModalVisible(true);
      } else {
        Alert.alert('No Contacts Found', 'No phone contacts were found on this device.');
      }
    } catch (err) {
      console.warn('[Contacts Picker Error]', err);
      Alert.alert('Error', 'Could not open device contacts.');
    } finally {
      setContactsLoading(false);
    }
  };

  /**
   * User selects a contact from the device contact list
   */
  const handlePickDeviceContact = (contact) => {
    const contactName = contact.name || 'Emergency Contact';
    const rawNumber = contact.phoneNumbers[0]?.number || '';

    // Sanitize phone number (strip whitespace, dashes, parens)
    let cleanNumber = rawNumber.replace(/[\s\-\(\)]/g, '');

    setName(contactName);
    setPhoneNumber(cleanNumber);
    setContactListModalVisible(false);
  };

  /**
   * Submit and save primary emergency contact
   */
  const handleSaveContact = async () => {
    setErrorMessage('');

    if (!name.trim() || name.trim().length < 2) {
      setErrorMessage('Please enter a valid contact name (minimum 2 characters).');
      return;
    }

    const phoneRegex = /^(\+91[\-\s]?)?[6789]\d{9}$/;
    if (!phoneNumber.trim() || !phoneRegex.test(phoneNumber.trim())) {
      setErrorMessage('Please enter a valid 10-digit Indian mobile number (e.g. +919876543210 or 9876543210).');
      return;
    }

    setSaving(true);
    try {
      await emergencyContactService.addContact({
        name: name.trim(),
        phoneNumber: phoneNumber.trim(),
        relationship,
        isPrimary: true,
      });

      Alert.alert(
        'Emergency Contact Saved',
        `${name} has been set as your primary emergency contact.`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to save emergency contact.';
      setErrorMessage(msg);
    } finally {
      setSaving(false);
    }
  };

  const filteredContacts = deviceContacts.filter((c) =>
    (c.name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Device Picker Banner */}
        <View style={styles.devicePickerCard}>
          <Text style={styles.devicePickerTitle}>📖 Fast Setup from Phone Book</Text>
          <Text style={styles.devicePickerSub}>
            Select an existing contact from your device without retyping. Only the single selected contact will be saved.
          </Text>

          <TouchableOpacity
            style={styles.pickPhoneBtn}
            onPress={handleSelectFromPhone}
            disabled={contactsLoading}
            activeOpacity={0.8}
          >
            {contactsLoading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.pickPhoneBtnText}>📱 Select from Phone Contacts</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>OR ENTER MANUALLY</Text>
          <View style={styles.dividerLine} />
        </View>

        {errorMessage ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        {/* Contact Input Form */}
        <View style={styles.formCard}>
          <Text style={styles.inputLabel}>Full Name *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Sunita Deshmukh"
            placeholderTextColor={theme.colors.textMuted}
            value={name}
            onChangeText={setName}
            maxLength={100}
          />

          <Text style={[styles.inputLabel, { marginTop: 14 }]}>Indian Mobile Number *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. +919876543210 or 9876543210"
            placeholderTextColor={theme.colors.textMuted}
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            keyboardType="phone-pad"
            maxLength={15}
          />

          <Text style={[styles.inputLabel, { marginTop: 14 }]}>Relationship</Text>
          <View style={styles.relPillsContainer}>
            {RELATIONSHIPS.map((rel) => {
              const isSelected = relationship === rel;
              return (
                <TouchableOpacity
                  key={rel}
                  style={[styles.relPill, isSelected && styles.relPillSelected]}
                  onPress={() => setRelationship(rel)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.relPillText, isSelected && styles.relPillTextSelected]}>
                    {rel}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSaveContact}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.saveButtonText}>Save Primary Emergency Contact ✓</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Device Contact Selection Modal */}
      <Modal visible={contactListModalVisible} animationType="slide">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select a Contact</Text>
            <TouchableOpacity onPress={() => setContactListModalVisible(false)}>
              <Text style={styles.modalCloseText}>✕ Close</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.modalSearchBox}>
            <TextInput
              style={styles.modalSearchInput}
              placeholder="Search contacts by name..."
              placeholderTextColor={theme.colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          <FlatList
            data={filteredContacts}
            keyExtractor={(item, index) => item.id || String(index)}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.modalContactItem}
                onPress={() => handlePickDeviceContact(item)}
              >
                <View style={styles.modalAvatar}>
                  <Text style={styles.modalAvatarText}>{(item.name || 'C').charAt(0).toUpperCase()}</Text>
                </View>
                <View style={styles.modalContactInfo}>
                  <Text style={styles.modalContactName}>{item.name || 'Unnamed'}</Text>
                  <Text style={styles.modalContactPhone}>{item.phoneNumbers?.[0]?.number}</Text>
                </View>
                <Text style={styles.modalSelectArrow}>Select →</Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={styles.emptyModalState}>
                <Text style={styles.emptyModalText}>No matching contacts found.</Text>
              </View>
            }
          />
        </SafeAreaView>
      </Modal>
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
  },
  devicePickerCard: {
    backgroundColor: '#EFF6FF',
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    borderWidth: 1.5,
    borderColor: '#93C5FD',
    marginBottom: theme.spacing.md,
  },
  devicePickerTitle: {
    fontSize: theme.typography.sizes.sm + 1,
    fontWeight: '700',
    color: theme.colors.primaryDark,
    marginBottom: 4,
  },
  devicePickerSub: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    lineHeight: 16,
    marginBottom: 12,
  },
  pickPhoneBtn: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 12,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    ...theme.shadows.button,
  },
  pickPhoneBtnText: {
    color: '#FFFFFF',
    fontSize: theme.typography.sizes.sm,
    fontWeight: '700',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 14,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: theme.colors.border,
  },
  dividerText: {
    paddingHorizontal: 10,
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.textMuted,
    letterSpacing: 0.5,
  },
  formCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.lg,
    ...theme.shadows.card,
  },
  inputLabel: {
    fontSize: theme.typography.sizes.xs + 1,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 6,
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
  relPillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  relPill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  relPillSelected: {
    backgroundColor: '#EFF6FF',
    borderColor: theme.colors.primary,
  },
  relPillText: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    fontWeight: '600',
  },
  relPillTextSelected: {
    color: theme.colors.primary,
    fontWeight: '700',
  },
  saveButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 14,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    ...theme.shadows.button,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
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

  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  modalTitle: {
    fontSize: theme.typography.sizes.md,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  modalCloseText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.primary,
    fontWeight: '700',
  },
  modalSearchBox: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  modalSearchInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textPrimary,
  },
  modalContactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  modalAvatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  modalContactInfo: {
    flex: 1,
  },
  modalContactName: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  modalContactPhone: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  modalSelectArrow: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  emptyModalState: {
    padding: theme.spacing.xxl,
    alignItems: 'center',
  },
  emptyModalText: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.sizes.sm,
  },
});
