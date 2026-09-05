import React from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { theme } from '../styles/theme';

// Auth Screens (Module 1)
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import EmailVerificationScreen from '../screens/EmailVerificationScreen';
import MobileVerificationScreen from '../screens/MobileVerificationScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import OTPVerificationScreen from '../screens/OTPVerificationScreen';
import ResetPasswordScreen from '../screens/ResetPasswordScreen';

// Core App & Location Screens (Modules 1 & 2)
import HomeScreen from '../screens/HomeScreen';
import ProfileScreen from '../screens/ProfileScreen';
import MapScreen from '../screens/MapScreen';
import LocationPermissionScreen from '../screens/LocationPermissionScreen';

// Incident Screens (Module 3)
import ReportIncidentScreen from '../screens/ReportIncidentScreen';
import MyReportsScreen from '../screens/MyReportsScreen';
import IncidentDetailsScreen from '../screens/IncidentDetailsScreen';
import EditIncidentScreen from '../screens/EditIncidentScreen';

// Emergency Alert & Response Screens (Module 4)
import AlertsScreen from '../screens/AlertsScreen';
import AlertDetailsScreen from '../screens/AlertDetailsScreen';
import EmergencyContactsScreen from '../screens/EmergencyContactsScreen';
import AddEmergencyContactScreen from '../screens/AddEmergencyContactScreen';
import SOSConfirmationScreen from '../screens/SOSConfirmationScreen';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: {
            backgroundColor: theme.colors.primary,
          },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: {
            fontWeight: '700',
          },
          contentStyle: {
            backgroundColor: theme.colors.background,
          },
        }}
      >
        {isAuthenticated ? (
          // Authenticated App Stack
          <>
            <Stack.Screen
              name="Home"
              component={HomeScreen}
              options={{
                title: 'Neighborhood Safety',
                headerBackVisible: false,
              }}
            />

            {/* Module 4: Emergency Alert & Response Management */}
            <Stack.Screen
              name="Alerts"
              component={AlertsScreen}
              options={{
                title: 'Neighborhood Alerts',
              }}
            />
            <Stack.Screen
              name="AlertDetails"
              component={AlertDetailsScreen}
              options={{
                title: 'Alert Details',
              }}
            />
            <Stack.Screen
              name="EmergencyContacts"
              component={EmergencyContactsScreen}
              options={{
                title: 'Emergency Contacts',
              }}
            />
            <Stack.Screen
              name="AddEmergencyContact"
              component={AddEmergencyContactScreen}
              options={{
                title: 'Add Emergency Contact',
              }}
            />
            <Stack.Screen
              name="SOSConfirmation"
              component={SOSConfirmationScreen}
              options={{
                title: 'Personal Emergency SOS',
                headerStyle: {
                  backgroundColor: '#7F1D1D',
                },
              }}
            />

            {/* Module 3: Incident Reporting */}
            <Stack.Screen
              name="ReportIncident"
              component={ReportIncidentScreen}
              options={{
                title: 'Report Incident',
              }}
            />
            <Stack.Screen
              name="MyReports"
              component={MyReportsScreen}
              options={{
                title: 'My Safety Reports',
              }}
            />
            <Stack.Screen
              name="IncidentDetails"
              component={IncidentDetailsScreen}
              options={{
                title: 'Incident Details',
              }}
            />
            <Stack.Screen
              name="EditIncident"
              component={EditIncidentScreen}
              options={{
                title: 'Edit Incident Report',
              }}
            />

            {/* Module 2: Geographical Map */}
            <Stack.Screen
              name="Map"
              component={MapScreen}
              options={{
                title: 'Neighborhood Map',
              }}
            />
            <Stack.Screen
              name="LocationPermission"
              component={LocationPermissionScreen}
              options={{
                title: 'Location Services',
              }}
            />

            {/* Module 1: Profile */}
            <Stack.Screen
              name="Profile"
              component={ProfileScreen}
              options={{
                title: 'Resident Profile',
              }}
            />
          </>
        ) : (
          // Auth Stack
          <>
            <Stack.Screen
              name="Login"
              component={LoginScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Register"
              component={RegisterScreen}
              options={{
                title: 'Create Account',
              }}
            />
            <Stack.Screen
              name="EmailVerification"
              component={EmailVerificationScreen}
              options={{
                title: 'Email Verification',
              }}
            />
            <Stack.Screen
              name="MobileVerification"
              component={MobileVerificationScreen}
              options={{
                title: 'Mobile Verification',
              }}
            />
            <Stack.Screen
              name="ForgotPassword"
              component={ForgotPasswordScreen}
              options={{
                title: 'Reset Password',
              }}
            />
            <Stack.Screen
              name="OTPVerification"
              component={OTPVerificationScreen}
              options={{
                title: 'Verify Code',
              }}
            />
            <Stack.Screen
              name="ResetPassword"
              component={ResetPasswordScreen}
              options={{
                title: 'New Password',
              }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
});
