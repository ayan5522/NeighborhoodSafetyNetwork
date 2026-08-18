import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  Platform,
  ScrollView,
} from 'react-native';
import { WebView } from 'react-native-webview';
import locationService from '../services/locationService';
import { theme } from '../styles/theme';

export default function MapScreen({ navigation }) {
  // Default coordinate center (Ratnagiri college ROSP initial coordinates)
  const [coordinates, setCoordinates] = useState({
    latitude: 16.9902,
    longitude: 73.3120,
    accuracy: 10,
  });
  const [neighborhood, setNeighborhood] = useState({
    neighborhood_name: 'Detecting area...',
    locality: 'Locality',
    city: 'Ratnagiri',
  });
  const [radiusMeters, setRadiusMeters] = useState(2000);
  const [perimeterData, setPerimeterData] = useState({
    active_residents_nearby: 0,
    safety_circle_status: 'STANDBY',
  });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const webViewRef = useRef(null);

  useEffect(() => {
    fetchInitialLocation();
  }, []);

  const fetchInitialLocation = async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      // 1. Get GPS coordinates
      const pos = await locationService.getCurrentPosition();
      setCoordinates(pos);

      // 2. Automatically sync with backend PostGIS database
      const savedLoc = await locationService.syncLocationWithBackend(pos);
      if (savedLoc) {
        setNeighborhood({
          neighborhood_name: savedLoc.neighborhood_name || 'Neighborhood Area',
          locality: savedLoc.locality || 'Locality',
          city: savedLoc.city || 'Region',
        });
      }

      // 3. Fetch nearby safety circle status for this radius
      await fetchNearbyCircle(pos.latitude, pos.longitude, radiusMeters);
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchNearbyCircle = async (lat, lng, radius) => {
    try {
      const nearby = await locationService.getNearbySafetyPerimeter({
        latitude: lat,
        longitude: lng,
        radius,
      });
      if (nearby) {
        setPerimeterData(nearby);
      }
    } catch (err) {
      console.warn('[MapScreen] Nearby perimeter fetch error:', err.message);
    }
  };

  const handleRefreshLocation = async () => {
    setRefreshing(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const pos = await locationService.getCurrentPosition();
      setCoordinates(pos);

      const savedLoc = await locationService.syncLocationWithBackend(pos);
      if (savedLoc) {
        setNeighborhood({
          neighborhood_name: savedLoc.neighborhood_name || neighborhood.neighborhood_name,
          locality: savedLoc.locality || neighborhood.locality,
          city: savedLoc.city || neighborhood.city,
        });
      }

      await fetchNearbyCircle(pos.latitude, pos.longitude, radiusMeters);
      setSuccessMessage('GPS Location synchronized with safety network.');

      // Update map center via injected JavaScript
      if (webViewRef.current) {
        const jsCode = `if (window.updateMapLocation) { window.updateMapLocation(${pos.latitude}, ${pos.longitude}, ${pos.accuracy || 10}); }`;
        webViewRef.current.injectJavaScript(jsCode);
      }

      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setRefreshing(false);
    }
  };

  const handleRadiusChange = async (newRadius) => {
    setRadiusMeters(newRadius);
    await fetchNearbyCircle(coordinates.latitude, coordinates.longitude, newRadius);
    if (webViewRef.current) {
      const jsCode = `if (window.updateCircleRadius) { window.updateCircleRadius(${newRadius}); }`;
      webViewRef.current.injectJavaScript(jsCode);
    }
  };

  // Generate OpenStreetMap + Leaflet HTML for WebView / Web
  const leafletMapHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>
          html, body, #map { height: 100%; width: 100%; margin: 0; padding: 0; background-color: #F8FAFC; }
          .custom-pin {
            background-color: #1E3A8A;
            color: #ffffff;
            border: 3px solid #ffffff;
            border-radius: 50%;
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 10px rgba(30, 58, 138, 0.4);
            font-size: 11px;
            font-weight: bold;
          }
          .pulse-ring {
            width: 32px;
            height: 32px;
            background: rgba(59, 130, 246, 0.35);
            border-radius: 50%;
            position: absolute;
            top: -4px;
            left: -4px;
            animation: pulse 2s infinite ease-out;
          }
          @keyframes pulse {
            0% { transform: scale(0.6); opacity: 1; }
            100% { transform: scale(2.2); opacity: 0; }
          }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          var map = L.map('map', { zoomControl: false }).setView([${coordinates.latitude}, ${coordinates.longitude}], 15);
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a> contributors'
          }).addTo(map);

          var userIcon = L.divIcon({
            className: 'user-marker-container',
            html: '<div class="pulse-ring"></div><div class="custom-pin">📍</div>',
            iconSize: [24, 24],
            iconAnchor: [12, 12]
          });

          var marker = L.marker([${coordinates.latitude}, ${coordinates.longitude}], { icon: userIcon }).addTo(map);
          marker.bindPopup('<b>You Are Here</b><br>Active Safety Node').openPopup();

          var circle = L.circle([${coordinates.latitude}, ${coordinates.longitude}], {
            color: '#0F766E',
            fillColor: '#0F766E',
            fillOpacity: 0.12,
            radius: ${radiusMeters}
          }).addTo(map);

          window.updateMapLocation = function(lat, lng, acc) {
            map.setView([lat, lng], 15, { animate: true });
            marker.setLatLng([lat, lng]);
            circle.setLatLng([lat, lng]);
          };

          window.updateCircleRadius = function(newRadius) {
            circle.setRadius(newRadius);
            map.fitBounds(circle.getBounds(), { padding: [30, 30] });
          };
        </script>
      </body>
    </html>
  `;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header Info Bar */}
      <View style={styles.topBar}>
        <View>
          <View style={styles.areaRow}>
            <View style={styles.statusDot} />
            <Text style={styles.areaTitle} numberOfLines={1}>
              {neighborhood.neighborhood_name}
            </Text>
          </View>
          <Text style={styles.areaSubtitle}>
            {neighborhood.locality ? `${neighborhood.locality}, ` : ''}{neighborhood.city || 'Ratnagiri'}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={handleRefreshLocation}
          disabled={refreshing}
          activeOpacity={0.8}
        >
          {refreshing ? (
            <ActivityIndicator color={theme.colors.primary} size="small" />
          ) : (
            <Text style={styles.refreshBtnText}>🔄 Refresh GPS</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Messages */}
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

      {/* Map Display Container */}
      <View style={styles.mapContainer}>
        {loading ? (
          <View style={styles.mapLoading}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={styles.mapLoadingText}>Acquiring GPS coordinates...</Text>
          </View>
        ) : Platform.OS === 'web' ? (
          <iframe
            title="OpenStreetMap"
            srcDoc={leafletMapHtml}
            style={{ width: '100%', height: '100%', border: 'none' }}
          />
        ) : (
          <WebView
            ref={webViewRef}
            originWhitelist={['*']}
            source={{ html: leafletMapHtml }}
            style={styles.webView}
            javaScriptEnabled={true}
            domStorageEnabled={true}
          />
        )}

        {/* Floating Accuracy Badge */}
        <View style={styles.accuracyBadge}>
          <Text style={styles.accuracyText}>
            GPS Accuracy: ±{Math.round(coordinates.accuracy || 10)}m
          </Text>
        </View>
      </View>

      {/* Bottom Safety Perimeter & Controls Panel */}
      <ScrollView contentContainerStyle={styles.bottomPanel}>
        <View style={styles.panelHeader}>
          <Text style={styles.panelTitle}>Safety Perimeter Settings</Text>
          <View style={styles.privacyPill}>
            <Text style={styles.privacyPillText}>🔒 PostGIS Protected</Text>
          </View>
        </View>

        {/* Radius Selector Tabs */}
        <View style={styles.radiusSelector}>
          {[
            { label: '1 km', value: 1000 },
            { label: '2 km', value: 2000 },
            { label: '5 km', value: 5000 },
          ].map((item) => (
            <TouchableOpacity
              key={item.value}
              style={[
                styles.radiusTab,
                radiusMeters === item.value && styles.radiusTabActive,
              ]}
              onPress={() => handleRadiusChange(item.value)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.radiusTabText,
                  radiusMeters === item.value && styles.radiusTabTextActive,
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Safety Circle Status Card */}
        <View style={styles.statusCard}>
          <View style={styles.statusCardHeader}>
            <Text style={styles.statusCardTitle}>Active Neighborhood Network</Text>
            <View
              style={[
                styles.networkStatusBadge,
                perimeterData.active_residents_nearby > 0
                  ? styles.badgeProtected
                  : styles.badgeStandby,
              ]}
            >
              <Text
                style={[
                  styles.networkStatusText,
                  perimeterData.active_residents_nearby > 0
                    ? styles.textProtected
                    : styles.textStandby,
                ]}
              >
                {perimeterData.active_residents_nearby > 0 ? '● PROTECTED' : '● STANDBY'}
              </Text>
            </View>
          </View>

          <Text style={styles.statusCardBody}>
            {perimeterData.active_residents_nearby > 0
              ? `${perimeterData.active_residents_nearby} verified resident(s) active within your ${radiusMeters / 1000} km perimeter.`
              : `No other active residents found within ${radiusMeters / 1000} km. You are the safety anchor for this area.`}
          </Text>

          <View style={styles.coordsRow}>
            <Text style={styles.coordsText}>
              Lat: {coordinates.latitude.toFixed(4)}° N, Lon: {coordinates.longitude.toFixed(4)}° E
            </Text>
          </View>
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
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  areaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.success,
    marginRight: 6,
  },
  areaTitle: {
    fontSize: theme.typography.sizes.sm + 1,
    fontWeight: '700',
    color: theme.colors.primaryDark,
    maxWidth: 200,
  },
  areaSubtitle: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textSecondary,
    marginTop: 1,
  },
  refreshBtn: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  refreshBtnText: {
    color: theme.colors.primary,
    fontSize: theme.typography.sizes.xs,
    fontWeight: '700',
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#E2E8F0',
  },
  webView: {
    flex: 1,
  },
  mapLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapLoadingText: {
    marginTop: 8,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
  },
  accuracyBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.full,
    ...theme.shadows.card,
  },
  accuracyText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  bottomPanel: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderTopLeftRadius: theme.borderRadius.lg,
    borderTopRightRadius: theme.borderRadius.lg,
    ...theme.shadows.card,
  },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  panelTitle: {
    fontSize: theme.typography.sizes.sm + 1,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  privacyPill: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.full,
  },
  privacyPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#065F46',
  },
  radiusSelector: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: theme.borderRadius.md,
    padding: 3,
    marginBottom: 12,
  },
  radiusTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: theme.borderRadius.sm,
  },
  radiusTabActive: {
    backgroundColor: '#FFFFFF',
    ...theme.shadows.card,
  },
  radiusTabText: {
    fontSize: theme.typography.sizes.xs + 1,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  radiusTabTextActive: {
    color: theme.colors.primary,
    fontWeight: '700',
  },
  statusCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: theme.borderRadius.md,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  statusCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  statusCardTitle: {
    fontSize: theme.typography.sizes.xs + 1,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  networkStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.full,
  },
  badgeProtected: {
    backgroundColor: '#D1FAE5',
  },
  badgeStandby: {
    backgroundColor: '#FEF3C7',
  },
  networkStatusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  textProtected: {
    color: '#065F46',
  },
  textStandby: {
    color: '#92400E',
  },
  statusCardBody: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textSecondary,
    lineHeight: 16,
    marginBottom: 8,
  },
  coordsRow: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: 6,
  },
  coordsText: {
    fontSize: 11,
    color: theme.colors.textMuted,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  errorBox: {
    backgroundColor: theme.colors.errorLight,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    padding: 10,
    marginHorizontal: theme.spacing.md,
    marginTop: 8,
    borderRadius: theme.borderRadius.md,
  },
  errorText: {
    color: theme.colors.error,
    fontSize: theme.typography.sizes.xs,
    textAlign: 'center',
  },
  successBox: {
    backgroundColor: theme.colors.successLight,
    borderWidth: 1,
    borderColor: '#6EE7B7',
    padding: 8,
    marginHorizontal: theme.spacing.md,
    marginTop: 8,
    borderRadius: theme.borderRadius.md,
  },
  successText: {
    color: '#065F46',
    fontSize: theme.typography.sizes.xs,
    textAlign: 'center',
    fontWeight: '600',
  },
});
