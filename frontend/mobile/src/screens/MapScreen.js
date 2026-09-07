import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  Platform,
  ScrollView,
  Image,
} from 'react-native';
import { WebView } from 'react-native-webview';
import locationService from '../services/locationService';
import incidentService from '../services/incidentService';
import BottomNavBar from '../components/BottomNavBar';
import { theme } from '../styles/theme';

const CATEGORY_ICONS = {
  ACCIDENT: '🚗',
  FIRE: '🔥',
  SUSPICIOUS_ACTIVITY: '🚨',
  ROAD_HAZARD: '🛣️',
  FLOOD_WATERLOGGING: '🌊',
  MEDICAL_EMERGENCY: '🏥',
  INFRASTRUCTURE_ISSUE: '💡',
  OTHER: '🆘',
};

const SEVERITY_COLORS = {
  LOW: '#10B981',
  MEDIUM: '#F59E0B',
  HIGH: '#F97316',
  CRITICAL: '#EF4444',
};

const SEVERITY_BG = {
  LOW: '#D1FAE5',
  MEDIUM: '#FEF3C7',
  HIGH: '#FFEDD5',
  CRITICAL: '#FEE2E2',
};

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
  const [incidents, setIncidents] = useState([]);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [perimeterData, setPerimeterData] = useState({
    active_residents_nearby: 0,
    safety_circle_status: 'STANDBY',
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const webViewRef = useRef(null);

  const fetchMapData = useCallback(async (pos, radius) => {
    try {
      // 1. Fetch active nearby incidents from PostGIS backend
      const incRes = await incidentService.getNearbyIncidents({
        latitude: pos.latitude,
        longitude: pos.longitude,
        radius: radius,
      });

      const incidentList = incRes?.incidents || [];
      setIncidents(incidentList);

      // 2. Fetch nearby safety perimeter resident count
      const nearby = await locationService.getNearbySafetyPerimeter({
        latitude: pos.latitude,
        longitude: pos.longitude,
        radius: radius,
      });
      if (nearby) {
        setPerimeterData(nearby);
      }
    } catch (err) {
      console.warn('[MapScreen] Data fetch error:', err.message);
    }
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

      // 3. Fetch incidents and perimeter
      await fetchMapData(pos, radiusMeters);
    } catch (err) {
      if (err.message && err.message.toLowerCase().includes('permission')) {
        setErrorMessage('Location permission is required to show nearby incidents.');
      } else {
        setErrorMessage(err.message || 'Unable to load nearby incidents. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialLocation();
  }, []);

  // Web event listener for Leaflet postMessage
  useEffect(() => {
    if (Platform.OS === 'web') {
      const handleWebMessage = (event) => {
        try {
          const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
          if (data && data.type === 'SELECT_INCIDENT' && data.incident) {
            setSelectedIncident(data.incident);
          } else if (data && data.type === 'DESELECT_INCIDENT') {
            setSelectedIncident(null);
          }
        } catch (e) {}
      };
      window.addEventListener('message', handleWebMessage);
      return () => window.removeEventListener('message', handleWebMessage);
    }
  }, []);

  const handleRefreshLocation = async () => {
    setRefreshing(true);
    setErrorMessage('');
    setSuccessMessage('');
    setSelectedIncident(null);
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

      await fetchMapData(pos, radiusMeters);
      setSuccessMessage('GPS Location and active incidents synchronized.');

      // Update map center via injected JavaScript
      if (webViewRef.current) {
        const jsCode = `if (window.updateMapData) { window.updateMapData(${pos.latitude}, ${pos.longitude}, ${radiusMeters}, ${JSON.stringify(incidents)}); }`;
        webViewRef.current.injectJavaScript(jsCode);
      }

      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setErrorMessage(err.message || 'Unable to load nearby incidents. Please try again.');
    } finally {
      setRefreshing(false);
    }
  };

  const handleRadiusChange = async (newRadius) => {
    setRadiusMeters(newRadius);
    setSelectedIncident(null);
    await fetchMapData(coordinates, newRadius);
    if (webViewRef.current) {
      const jsCode = `if (window.updateMapData) { window.updateMapData(${coordinates.latitude}, ${coordinates.longitude}, ${newRadius}, ${JSON.stringify(incidents)}); }`;
      webViewRef.current.injectJavaScript(jsCode);
    }
  };

  const handleWebViewMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'SELECT_INCIDENT' && data.incident) {
        setSelectedIncident(data.incident);
      } else if (data.type === 'DESELECT_INCIDENT') {
        setSelectedIncident(null);
      }
    } catch (e) {
      console.warn('[MapScreen WebView message error]', e);
    }
  };

  const handleViewDetails = (incident) => {
    if (!incident) return;
    if (incident.alert_id) {
      navigation.navigate('AlertDetails', { id: incident.alert_id });
    } else {
      // Direct Incident details
      navigation.navigate('IncidentDetails', { id: incident.id, incident });
    }
  };

  const formatDistance = (meters) => {
    if (meters === null || meters === undefined) return 'Nearby';
    if (meters < 1000) return `Approx. ${meters} m away`;
    return `Approx. ${(meters / 1000).toFixed(1)} km away`;
  };

  const formatTimeAgo = (dateString) => {
    if (!dateString) return '';
    const diffMs = Date.now() - new Date(dateString).getTime();
    const mins = Math.floor(diffMs / (1000 * 60));
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins} minutes ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    return new Date(dateString).toLocaleDateString();
  };

  // Generate OpenStreetMap + Leaflet HTML for WebView / Web
  const serializedIncidents = JSON.stringify(incidents);
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
          .custom-user-pin {
            background-color: #1E3A8A;
            color: #ffffff;
            border: 3px solid #ffffff;
            border-radius: 50%;
            width: 28px;
            height: 28px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 10px rgba(30, 58, 138, 0.4);
            font-size: 14px;
            font-weight: bold;
          }
          .pulse-ring {
            width: 38px;
            height: 38px;
            background: rgba(59, 130, 246, 0.35);
            border-radius: 50%;
            position: absolute;
            top: -5px;
            left: -5px;
            animation: pulse 2s infinite ease-out;
          }
          @keyframes pulse {
            0% { transform: scale(0.6); opacity: 1; }
            100% { transform: scale(2.2); opacity: 0; }
          }
          .incident-marker {
            width: 36px;
            height: 36px;
            border-radius: 18px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
            cursor: pointer;
            transition: transform 0.2s ease;
          }
          .incident-marker:hover {
            transform: scale(1.15);
          }
          .sev-CRITICAL {
            background-color: #FEE2E2;
            border: 3px solid #EF4444;
          }
          .sev-HIGH {
            background-color: #FFEDD5;
            border: 3px solid #F97316;
          }
          .sev-MEDIUM {
            background-color: #FEF3C7;
            border: 3px solid #F59E0B;
          }
          .sev-LOW {
            background-color: #D1FAE5;
            border: 3px solid #10B981;
          }
          .leaflet-popup-content-wrapper {
            border-radius: 12px;
            padding: 4px;
            box-shadow: 0 8px 24px rgba(0,0,0,0.18);
          }
          .popup-content {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          }
          .popup-title {
            font-size: 13px;
            font-weight: 700;
            color: #0F172A;
            margin-bottom: 2px;
          }
          .popup-meta {
            font-size: 11px;
            color: #64748B;
            margin-bottom: 6px;
          }
          .popup-btn {
            display: inline-block;
            background-color: #1E3A8A;
            color: #FFFFFF;
            font-size: 11px;
            font-weight: 700;
            padding: 5px 10px;
            border-radius: 6px;
            text-decoration: none;
            cursor: pointer;
          }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          var map = L.map('map', { zoomControl: false }).setView([${coordinates.latitude}, ${coordinates.longitude}], 14);
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a> contributors'
          }).addTo(map);

          var userIcon = L.divIcon({
            className: 'user-marker-container',
            html: '<div class="pulse-ring"></div><div class="custom-user-pin">📍</div>',
            iconSize: [28, 28],
            iconAnchor: [14, 14]
          });

          var userMarker = L.marker([${coordinates.latitude}, ${coordinates.longitude}], { icon: userIcon }).addTo(map);
          userMarker.bindPopup('<b>📍 You Are Here</b><br>Active Safety Node');

          var circle = L.circle([${coordinates.latitude}, ${coordinates.longitude}], {
            color: '#0F766E',
            fillColor: '#0F766E',
            fillOpacity: 0.1,
            radius: ${radiusMeters}
          }).addTo(map);

          var incidentMarkersGroup = L.layerGroup().addTo(map);

          var categoryIcons = ${JSON.stringify(CATEGORY_ICONS)};

          function postAppMessage(payload) {
            var str = JSON.stringify(payload);
            if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
              window.ReactNativeWebView.postMessage(str);
            }
            if (window.parent && window.parent.postMessage) {
              window.parent.postMessage(str, '*');
            }
          }

          function renderIncidentMarkers(incidentList) {
            incidentMarkersGroup.clearLayers();
            if (!incidentList || !incidentList.length) return;

            incidentList.forEach(function(inc) {
              var iconEmoji = categoryIcons[inc.category] || '📌';
              var sevClass = 'sev-' + (inc.severity || 'MEDIUM');

              var markerIcon = L.divIcon({
                className: 'incident-marker-container',
                html: '<div class="incident-marker ' + sevClass + '">' + iconEmoji + '</div>',
                iconSize: [36, 36],
                iconAnchor: [18, 18],
                popupAnchor: [0, -18]
              });

              var m = L.marker([inc.latitude, inc.longitude], { icon: markerIcon });
              
              m.on('click', function() {
                postAppMessage({ type: 'SELECT_INCIDENT', incident: inc });
              });

              var popupHtml = '<div class="popup-content">' +
                '<div class="popup-title">' + iconEmoji + ' ' + (inc.title || inc.category) + '</div>' +
                '<div class="popup-meta">Severity: <b>' + inc.severity + '</b> • Approx. ' + (inc.approximate_distance_meters ? inc.approximate_distance_meters + 'm' : 'Nearby') + '</div>' +
                '<div style="margin-top: 4px;"><span class="popup-btn" onclick="postAppMessage({ type: \\'SELECT_INCIDENT\\', incident: ' + JSON.stringify(inc).replace(/"/g, '&quot;') + ' })">View Details</span></div>' +
                '</div>';

              m.bindPopup(popupHtml);
              incidentMarkersGroup.addLayer(m);
            });
          }

          renderIncidentMarkers(${serializedIncidents});

          map.on('click', function(e) {
            if (e.originalEvent.target.id === 'map' || e.originalEvent.target.tagName === 'path') {
              postAppMessage({ type: 'DESELECT_INCIDENT' });
            }
          });

          window.updateMapData = function(lat, lng, radius, incidentList) {
            map.setView([lat, lng], 14, { animate: true });
            userMarker.setLatLng([lat, lng]);
            circle.setLatLng([lat, lng]);
            circle.setRadius(radius);
            renderIncidentMarkers(incidentList);
          };
        </script>
      </body>
    </html>
  `;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header Info Bar */}
      <View style={styles.topBar}>
        <View style={styles.areaInfo}>
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
            <Text style={styles.refreshBtnText}>🔄 Refresh Map</Text>
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
            <Text style={styles.mapLoadingText}>Acquiring GPS & active incidents...</Text>
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
            onMessage={handleWebViewMessage}
          />
        )}

        {/* Floating Accuracy & Active Count Badge */}
        <View style={styles.floatingBadgesContainer}>
          <View style={styles.activeIncidentsBadge}>
            <Text style={styles.activeIncidentsText}>
              {incidents.length > 0 ? `🚨 ${incidents.length} Active Incident${incidents.length > 1 ? 's' : ''}` : '🛡️ Area Safe'}
            </Text>
          </View>
          <View style={styles.accuracyBadge}>
            <Text style={styles.accuracyText}>
              GPS: ±{Math.round(coordinates.accuracy || 10)}m
            </Text>
          </View>
        </View>

        {/* INTERACTIVE MARKER TAP BOTTOM SHEET / CARD */}
        {selectedIncident && (
          <View style={styles.selectedIncidentCard}>
            <View style={styles.selectedCardHeader}>
              <View style={styles.selectedCategoryRow}>
                <Text style={styles.selectedCategoryIcon}>
                  {CATEGORY_ICONS[selectedIncident.category] || '📌'}
                </Text>
                <View>
                  <Text style={styles.selectedCategoryTitle}>
                    {selectedIncident.category?.replace(/_/g, ' ')}
                  </Text>
                  <Text style={styles.selectedReportedTime}>
                    Reported: {formatTimeAgo(selectedIncident.created_at)}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.closeCardBtn}
                onPress={() => setSelectedIncident(null)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.closeCardText}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.selectedIncidentTitle} numberOfLines={1}>
              {selectedIncident.title}
            </Text>

            {Boolean(selectedIncident.description) && (
              <Text style={styles.selectedIncidentDesc} numberOfLines={2}>
                {selectedIncident.description}
              </Text>
            )}

            <View style={styles.selectedMetaRow}>
              <View
                style={[
                  styles.selectedSeverityBadge,
                  { backgroundColor: SEVERITY_BG[selectedIncident.severity] || '#F1F5F9' },
                ]}
              >
                <Text
                  style={[
                    styles.selectedSeverityText,
                    { color: SEVERITY_COLORS[selectedIncident.severity] || '#64748B' },
                  ]}
                >
                  {selectedIncident.severity} SEVERITY
                </Text>
              </View>

              <Text style={styles.selectedDistanceText}>
                {formatDistance(selectedIncident.approximate_distance_meters || selectedIncident.distance_meters)}
              </Text>

              <View style={styles.selectedStatusBadge}>
                <Text style={styles.selectedStatusText}>
                  ● {selectedIncident.status || 'ACTIVE'}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.viewDetailsButton}
              onPress={() => handleViewDetails(selectedIncident)}
              activeOpacity={0.8}
            >
              <Text style={styles.viewDetailsButtonText}>View Details →</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Bottom Safety Perimeter & Controls Panel */}
      <ScrollView contentContainerStyle={styles.bottomPanel} keyboardShouldPersistTaps="handled">
        <View style={styles.panelHeader}>
          <Text style={styles.panelTitle}>Neighborhood Safety Perimeter</Text>
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

        {/* Status Card */}
        <View style={styles.statusCard}>
          <View style={styles.statusCardHeader}>
            <Text style={styles.statusCardTitle}>
              {incidents.length > 0
                ? `${incidents.length} Active Incident(s) in ${radiusMeters / 1000} km`
                : 'No Active Incidents'}
            </Text>
            <View
              style={[
                styles.networkStatusBadge,
                incidents.length > 0 ? styles.badgeAlert : styles.badgeSafe,
              ]}
            >
              <Text
                style={[
                  styles.networkStatusText,
                  incidents.length > 0 ? styles.textAlert : styles.textSafe,
                ]}
              >
                {incidents.length > 0 ? '● INCIDENTS ACTIVE' : '● ALL CLEAR'}
              </Text>
            </View>
          </View>

          <Text style={styles.statusCardBody}>
            {incidents.length > 0
              ? `Tap any marker (🚗, 🔥, ⚠️, etc.) on the map above to view the safety summary and distance.`
              : `No active safety incidents reported within your ${radiusMeters / 1000} km perimeter. Verified network is standing by.`}
          </Text>

          <View style={styles.coordsRow}>
            <Text style={styles.coordsText}>
              Center: {coordinates.latitude.toFixed(4)}° N, {coordinates.longitude.toFixed(4)}° E • {perimeterData.active_residents_nearby || 0} active nodes
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* BOTTOM NAVIGATION BAR */}
      <BottomNavBar navigation={navigation} activeTab="Map" />
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
  areaInfo: {
    flex: 1,
    marginRight: 10,
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
  floatingBadgesContainer: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    pointerEvents: 'none',
  },
  activeIncidentsBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...theme.shadows.card,
  },
  activeIncidentsText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.primaryDark,
  },
  accuracyBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...theme.shadows.card,
  },
  accuracyText: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },

  // Interactive Marker Tap Card
  selectedIncidentCard: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
    ...theme.shadows.card,
    elevation: 10,
  },
  selectedCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  selectedCategoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selectedCategoryIcon: {
    fontSize: 24,
  },
  selectedCategoryTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.primaryDark,
    textTransform: 'uppercase',
  },
  selectedReportedTime: {
    fontSize: 10,
    color: theme.colors.textMuted,
  },
  closeCardBtn: {
    padding: 4,
  },
  closeCardText: {
    fontSize: 16,
    color: theme.colors.textMuted,
    fontWeight: '700',
  },
  selectedIncidentTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  selectedIncidentDesc: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    lineHeight: 16,
    marginBottom: 8,
  },
  selectedMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  selectedSeverityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  selectedSeverityText: {
    fontSize: 10,
    fontWeight: '800',
  },
  selectedDistanceText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  selectedStatusBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  selectedStatusText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1E40AF',
  },
  viewDetailsButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    ...theme.shadows.button,
  },
  viewDetailsButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },

  // Bottom Panel
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
    marginBottom: 10,
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
    marginBottom: 4,
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
  badgeSafe: {
    backgroundColor: '#D1FAE5',
  },
  badgeAlert: {
    backgroundColor: '#FEE2E2',
  },
  networkStatusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  textSafe: {
    color: '#065F46',
  },
  textAlert: {
    color: '#991B1B',
  },
  statusCardBody: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textSecondary,
    lineHeight: 16,
    marginBottom: 6,
  },
  coordsRow: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: 6,
  },
  coordsText: {
    fontSize: 10,
    color: theme.colors.textMuted,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  errorBox: {
    backgroundColor: theme.colors.errorLight,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    padding: 8,
    marginHorizontal: theme.spacing.md,
    marginTop: 6,
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
    marginTop: 6,
    borderRadius: theme.borderRadius.md,
  },
  successText: {
    color: '#065F46',
    fontSize: theme.typography.sizes.xs,
    textAlign: 'center',
    fontWeight: '600',
  },
});
