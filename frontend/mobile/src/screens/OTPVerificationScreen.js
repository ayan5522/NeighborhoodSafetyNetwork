import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import authService from '../services/authService';
import { theme } from '../styles/theme';

export default function OTPVerificationScreen({ route, navigation }) {
  const { channel, identifier } = route.params || {};
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [cooldown, setCooldown] = useState(60);

  useEffect(() => {
    let timer;
    if (cooldown > 0) {
      timer = setInterval(() => setCooldown((prev) => prev - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleVerifyOtp = async () => {
    setErrorMessage('');
    setSuccessMessage('');

    if (!otp.trim() || otp.trim().length !== 6) {
      setErrorMessage('Please enter the complete 6-digit verification code.');
      return;
    }

    setLoading(true);
    try {
      await authService.verifyResetOtp({
        channel,
        identifier,
        otp: otp.trim(),
      });

      // Pass verified OTP along to the reset password screen
      navigation.navigate('ResetPassword', {
        channel,
        identifier,
        otp: otp.trim(),
      });
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (cooldown > 0) return;
    setErrorMessage('');
    setSuccessMessage('');
    setResending(true);

    try {
      await authService.resendOtp({
        purpose: 'PASSWORD_RESET',
        channel,
        identifier,
      });
      setSuccessMessage('A new reset code has been sent.');
      setCooldown(60);
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setResending(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.title}>Enter Recovery Code</Text>
            <Text style={styles.subtitle}>
              We sent a 6-digit code to your registered {channel === 'EMAIL' ? 'email' : 'mobile'}:
            </Text>
            <Text style={styles.highlight}>{identifier || 'your account'}</Text>
          </View>

          {channel === 'SMS' && (
            <View style={styles.devNoticeBox}>
              <Text style={styles.devNoticeTitle}>DEVELOPMENT MODE</Text>
              <Text style={styles.devNoticeText}>
                SMS OTP is logged in the backend console. Check your server terminal.
              </Text>
            </View>
          )}

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

          <View style={styles.form}>
            <Text style={styles.label}>Enter 6-Digit Code</Text>
            <TextInput
              style={styles.otpInput}
              placeholder="123456"
              placeholderTextColor={theme.colors.textMuted}
              value={otp}
              onChangeText={setOtp}
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
            />

            <TouchableOpacity
              style={[styles.primaryButton, loading && styles.buttonDisabled]}
              onPress={handleVerifyOtp}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>Verify & Proceed</Text>
              )}
            </TouchableOpacity>

            <View style={styles.resendSection}>
              <TouchableOpacity
                onPress={handleResendOtp}
                disabled={cooldown > 0 || resending}
              >
                <Text style={[styles.resendText, cooldown > 0 && styles.resendDisabled]}>
                  {resending
                    ? 'Resending...'
                    : cooldown > 0
                    ? `Resend Code in ${cooldown}s`
                    : 'Resend Code'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing.lg,
    flexGrow: 1,
    justifyContent: 'center',
  },
  header: {
    marginBottom: theme.spacing.xl,
    alignItems: 'center',
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
  },
  highlight: {
    fontSize: theme.typography.sizes.md,
    fontWeight: '700',
    color: theme.colors.primary,
    marginTop: 4,
  },
  devNoticeBox: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  devNoticeTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E40AF',
    marginBottom: 2,
    letterSpacing: 0.5,
  },
  devNoticeText: {
    fontSize: theme.typography.sizes.xs,
    color: '#1E3A8A',
    lineHeight: 16,
  },
  form: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    ...theme.shadows.card,
  },
  label: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  otpInput: {
    backgroundColor: theme.colors.inputBg,
    borderWidth: 2,
    borderColor: theme.colors.borderFocus,
    borderRadius: theme.borderRadius.md,
    paddingVertical: 14,
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 8,
    textAlign: 'center',
    color: theme.colors.primaryDark,
    marginBottom: theme.spacing.md,
  },
  primaryButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 14,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    marginTop: theme.spacing.sm,
    ...theme.shadows.button,
  },
  buttonDisabled: {
    backgroundColor: theme.colors.disabled,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: theme.typography.sizes.md,
    fontWeight: '700',
  },
  resendSection: {
    alignItems: 'center',
    marginTop: theme.spacing.md,
  },
  resendText: {
    color: theme.colors.primaryLight,
    fontSize: theme.typography.sizes.sm,
    fontWeight: '600',
  },
  resendDisabled: {
    color: theme.colors.textMuted,
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
  successBox: {
    backgroundColor: theme.colors.successLight,
    borderWidth: 1,
    borderColor: '#6EE7B7',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.md,
  },
  successText: {
    color: '#065F46',
    fontSize: theme.typography.sizes.sm,
    textAlign: 'center',
    fontWeight: '600',
  },
});
