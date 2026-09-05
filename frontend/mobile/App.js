import React, { useEffect } from 'react';
import { StyleSheet, View, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  // Fix web root height collapse
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const style = document.createElement('style');
      style.textContent = `
        html, body, #root {
          height: 100%;
          width: 100%;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          background-color: #F8FAFC;
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  return (
    <View style={styles.rootContainer}>
      <SafeAreaProvider style={styles.safeArea}>
        <AuthProvider>
          <StatusBar style="auto" />
          <AppNavigator />
        </AuthProvider>
      </SafeAreaProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#F8FAFC',
  },
  safeArea: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
});
