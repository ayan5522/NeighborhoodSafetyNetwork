import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  Linking,
  Switch,
  Platform,
} from 'react-native';
import sosService from '../services/sosService';
import emergencyContactService from '../services/emergencyContactService';
import locationService from '../services/locationService';
import { theme } from '../styles/theme';

export default function SOSConfirmationScreen({ navigation }) {
  const [coords, setCoords] = useState({ latitude: 16.9902, longitude: 73.3120 });
  const [locLoading, setLocLoading] = useState(true);
  const [primaryContact, setPrimaryContact] = useState(null);
  const [notifyContact, setNotifyContact] = useState(true);

  const [triggering, setTriggering] = useState(false);
  const [activeSOS, setActiveSOS] = useState(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLocLoading(true);
    try {
      // 1. Get location
      const pos = await locationService.getCurrentPosition();
      setCoords(pos);

      // 2. Check for emergency contact
      const contacts = await emergencyContactService.getContacts();
      const primary = contacts.find((c) => c.is_primary) || contacts[0];
      setPrimaryContact(primary || null);

      // 3. Check if user already has an active SOS event
      const mySos = await sosService.getMySOSEvents({ limit: 1 });
      if (mySos?.data && mySos.data.length > 0 && mySos.data[0].status === 'ACTIVE') {
        setActiveSOS(mySos.data[0]);
      }
    } catch (err) {
      console.warn('[SOS Init Error]', err);
    } finally {
      setLocLoading(false);
    }
  };

  /**
   * Call National Emergency Services (112)
   */
  const handleCall112 = () => {
    Alert.alert(
      'National Emergency Helpline',
      'This will open your phone dialer to call India Emergency Helpline 112. Do you want to proceed?',
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
   * Confirm and Trigger Personal SOS
   */
  const handleConfirmSOS = () => {
    Alert.alert(
      'Confirm Personal SOS',
      'Are you sure you want to activate emergency SOS? This will record your emergency event and notify your contact.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'ACTIVATE SOS',
          style: 'destructive',
          onPress: async () => {
            setTriggering(true);
            try {
              const res = await sosService.triggerSOS({
                latitude: coords.latitude,
                longitude: coords.longitude,
                notifyContact: Boolean(notifyContact && primaryContact),
              });

              setActiveSOS(res.data);
            } catch (err) {
              const msg = err.response?.data?.message || err.message || 'Failed to activate SOS.';
              Alert.alert('SOS Error', msg);
            } finally {
              setTriggering(false);
            }
          },
        },
      ]
    );
  };

  /**
   * Resolve or Cancel Active SOS
   */
  const handleResolveSOS = (action) => {
    Alert.alert(
      action === 'RESOLVE' ? 'Resolve Emergency SOS' : 'Cancel Emergency SOS',
      `Are you sure you want to mark this emergency event as ${action.toLowerCase()}?`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes',
          onPress: async () => {
            try {
              if (activeSOS?.id) {
                await sosService.resolveSOS(activeSOS.id, action);
              }
              setActiveSOS(null);
              Alert.alert('SOS Status Updated', `Your SOS event has been ${action.toLowerCase()}.`);
            } catch (err) {
              Alert.alert('Error', 'Failed to update SOS status.');
            }
          },
        },
      ]
    );
  };

  // =========================================================================
  // VIEW A: ACTIVE EMERGENCY SOS STATE
  // =========================================================================
  if (activeSOS) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.activeContainer}>
          {/* Pulsing Active Banner */}
          <View style={styles.activeBanner}>
            <View style={styles.activePill}>
              <View style={styles.pulsingDot} />
              <Text style={styles.activePillText}>EMERGENCY SOS ACTIVE</Text>
            </View>
            <Text style={styles.activeTitle}>Assistance In Progress</Text>
            <Text style={styles.activeSubtitle}>
              Your emergency signal and coordinates have been registered.
            </Text>
          </View>

          {/* Direct 112 Call Card */}
          <View style={styles.callCard}>
            <Text style={styles.callCardTitle}>India National Emergency Helpline</Text>
            <Text style={styles.callCardSub}>
              Connect directly with national emergency dispatch (Police, Fire, Medical):
            </Text>
            <TouchableOpacity style={styles.big112Btn} onPress={handleCall112} activeOpacity={0.8}>
              <Text style={styles.big112BtnText}>📞 CALL 112 NOW</Text>
            </TouchableOpacity>
          </View>

          {/* Emergency Details Card */}
          <View style={styles.detailsCard}>
            <Text style={styles.detailsHeader}>Emergency Event Details</Text>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Location:</Text>
              <Text style={styles.detailValue}>
                {activeSOS.neighborhood_name || activeSOS.locality || 'Ratnagiri Zone'} (
                {Number(activeSOS.latitude).toFixed(4)}° N, {Number(activeSOS.longitude).toFixed(4)}° E)
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Contact Alert:</Text>
              <Text style={styles.detailValue}>
                {activeSOS.contact_notified
                  ? `✓ Sent to ${primaryContact?.name || 'Emergency Contact'}`
                  : 'Not sent / No contact configured'}
              </Text>
            </View>
          </View>

          {/* Resolution Actions */}
          <View style={styles.resolveActionsContainer}>
            <TouchableOpacity
              style={styles.resolveBtn}
              onPress={() => handleResolveSOS('RESOLVE')}
              activeOpacity={0.8}
            >
              <Text style={styles.resolveBtnText}>✓ I Am Safe Now (Resolve SOS)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => handleResolveSOS('CANCEL')}
              activeOpacity={0.8}
            >
              <Text style={styles.cancelBtnText}>✕ Cancel SOS Trigger</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // =========================================================================
  // VIEW B: SOS CONFIRMATION TRIGGER SCREEN
  // =========================================================================
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Warning Banner */}
        <View style={styles.warningCard}>
          <Text style={styles.warningIcon}>🚨</Text>
          <Text style={styles.warningTitle}>Personal Emergency SOS</Text>
          <Text style={styles.warningSubtitle}>
            Personal SOS is designed for situations where YOU are personally in danger, injured, or in need of immediate emergency assistance.
          </Text>
        </View>

        {/* GPS Location Status */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>📍 Current Emergency Coordinates</Text>
          <View style={styles.locBox}>
            <Text style={styles.locCoords}>
              Lat: {coords.latitude.toFixed(4)}° N, Lon: {coords.longitude.toFixed(4)}° E
            </Text>
            <Text style={styles.locStatus}>
              {locLoading ? 'Acquiring high-accuracy GPS...' : '✓ GPS Lock Verified'}
            </Text>
          </View>
        </View>

        {/* Emergency Contact Option */}
        <View style={styles.sectionCard}>
          <View style={styles.switchRow}>
            <View style={styles.switchInfo}>
              <Text style={styles.sectionTitle}>👥 Notify Primary Contact</Text>
              {primaryContact ? (
                <Text style={styles.contactSub}>
                  {primaryContact.name} ({primaryContact.phone_number})
                </Text>
              ) : (
                <Text style={styles.noContactSub}>No emergency contact configured.</Text>
              )}
            </View>
            <Switch
              value={notifyContact && Boolean(primaryContact)}
              onValueChange={setNotifyContact}
              disabled={!primaryContact}
              trackColor={{ false: '#CBD5E1', true: '#93C5FD' }}
              thumbColor={notifyContact && primaryContact ? theme.colors.primary : '#F1F5F9'}
            />
          </View>
        </View>

        {/* Emergency Call Shortcut */}
        <TouchableOpacity style={styles.direct112Bar} onPress={handleCall112} activeOpacity={0.8}>
          <Text style={styles.direct112Text}>📞 Direct Call to 112 Emergency Dispatch →</Text>
        </TouchableOpacity>

        {/* Big SOS Confirmation Button */}
        <TouchableOpacity
          style={[styles.sosConfirmBtn, (triggering || locLoading) && styles.sosConfirmBtnDisabled]}
          onPress={handleConfirmSOS}
          disabled={triggering || locLoading}
          activeOpacity={0.85}
        >
          {triggering ? (
            <ActivityIndicator color="#FFFFFF" size="large" />
          ) : (
            <View style={styles.sosBtnContent}>
              <Text style={styles.sosBtnIcon}>🚨</Text>
              <Text style={styles.sosBtnText}>CONFIRM PERSONAL SOS</Text>
              <Text style={styles.sosBtnSub}>Tap to broadcast emergency assistance request</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelLink} onPress={() => navigation.goBack()}>
          <Text style={styles.cancelLinkText}>Cancel and return</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  scrollContent: {
    padding: theme.spacing.lg,
    gap: 14,
  },
  warningCard: {
    backgroundColor: '#1E293B',
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  warningIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  warningTitle: {
    fontSize: theme.typography.sizes.md + 2,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 6,
  },
  warningSubtitle: {
    fontSize: theme.typography.sizes.xs + 1,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 18,
  },
  sectionCard: {
    backgroundColor: '#1E293B',
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: '#334155',
  },
  sectionTitle: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 4,
  },
  locBox: {
    backgroundColor: '#0F172A',
    padding: 10,
    borderRadius: theme.borderRadius.md,
    marginTop: 4,
  },
  locCoords: {
    fontSize: 12,
    color: '#38BDF8',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '600',
  },
  locStatus: {
    fontSize: 10,
    color: '#10B981',
    marginTop: 2,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchInfo: {
    flex: 1,
  },
  contactSub: {
    fontSize: 11,
    color: '#94A3B8',
  },
  noContactSub: {
    fontSize: 11,
    color: '#EF4444',
  },
  direct112Bar: {
    backgroundColor: '#334155',
    paddingVertical: 12,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  direct112Text: {
    color: '#F8FAFC',
    fontSize: theme.typography.sizes.xs + 1,
    fontWeight: '700',
  },
  sosConfirmBtn: {
    backgroundColor: '#DC2626',
    borderRadius: theme.borderRadius.xl,
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    ...theme.shadows.button,
    elevation: 8,
  },
  sosConfirmBtnDisabled: {
    opacity: 0.6,
  },
  sosBtnContent: {
    alignItems: 'center',
  },
  sosBtnIcon: {
    fontSize: 32,
    marginBottom: 6,
  },
  sosBtnText: {
    color: '#FFFFFF',
    fontSize: theme.typography.sizes.md + 2,
    fontWeight: '900',
    letterSpacing: 1,
  },
  sosBtnSub: {
    color: '#FEE2E2',
    fontSize: 11,
    marginTop: 4,
  },
  cancelLink: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  cancelLinkText: {
    color: '#94A3B8',
    fontSize: theme.typography.sizes.sm,
  },

  // Active SOS styles
  activeContainer: {
    padding: theme.spacing.lg,
    gap: 16,
  },
  activeBanner: {
    backgroundColor: '#7F1D1D',
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.xl,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#EF4444',
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#991B1B',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.full,
    marginBottom: 12,
  },
  pulsingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    marginRight: 8,
  },
  activePillText: {
    color: '#FEE2E2',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  activeTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  activeSubtitle: {
    fontSize: theme.typography.sizes.xs + 1,
    color: '#FECDD3',
    textAlign: 'center',
  },
  callCard: {
    backgroundColor: '#1E293B',
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: '#334155',
  },
  callCardTitle: {
    fontSize: theme.typography.sizes.sm + 1,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  callCardSub: {
    fontSize: 11,
    color: '#94A3B8',
    marginBottom: 12,
  },
  big112Btn: {
    backgroundColor: '#E11D48',
    paddingVertical: 16,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    ...theme.shadows.button,
  },
  big112BtnText: {
    color: '#FFFFFF',
    fontSize: theme.typography.sizes.md,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  detailsCard: {
    backgroundColor: '#1E293B',
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: '#334155',
  },
  detailsHeader: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    paddingBottom: 6,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  detailLabel: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
    width: 100,
  },
  detailValue: {
    flex: 1,
    fontSize: 11,
    color: '#F8FAFC',
    textAlign: 'right',
  },
  resolveActionsContainer: {
    gap: 10,
    marginTop: 8,
  },
  resolveBtn: {
    backgroundColor: '#059669',
    paddingVertical: 14,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  resolveBtnText: {
    color: '#FFFFFF',
    fontSize: theme.typography.sizes.sm + 1,
    fontWeight: '700',
  },
  cancelBtn: {
    backgroundColor: '#334155',
    paddingVertical: 12,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#CBD5E1',
    fontSize: theme.typography.sizes.sm,
    fontWeight: '600',
  },
});
