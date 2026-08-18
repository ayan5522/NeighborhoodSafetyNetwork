const db = require('../config/db');
const logger = require('../utils/logger');
const https = require('https');

// In-memory cache for reverse geocoding to prevent excessive external requests
const geocodeCache = new Map();

/**
 * Reverse geocode coordinates to approximate Indian locality / neighborhood using OpenStreetMap Nominatim
 * with caching and graceful offline fallback.
 */
async function resolveApproximateNeighborhood(lat, lng) {
  // Round to ~100m grid for caching and privacy
  const cacheKey = `${lat.toFixed(3)},${lng.toFixed(3)}`;
  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey);
  }

  // Fallback default
  let result = {
    neighborhood_name: 'Local Neighborhood',
    locality: 'Local Area',
    city: 'Local Region',
  };

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=16&addressdetails=1`;
    const data = await new Promise((resolve) => {
      const req = https.get(
        url,
        {
          headers: {
            'User-Agent': 'NeighborhoodSafetyNetwork-CollegeROSP/1.0 (academic-safety-project)',
            'Accept': 'application/json',
          },
          timeout: 2000,
        },
        (res) => {
          let rawData = '';
          res.on('data', (chunk) => { rawData += chunk; });
          res.on('end', () => {
            try {
              resolve(JSON.parse(rawData));
            } catch (e) {
              resolve(null);
            }
          });
        }
      );
      req.on('error', () => resolve(null));
      req.on('timeout', () => {
        req.destroy();
        resolve(null);
      });
    });

    if (data && data.address) {
      const addr = data.address;
      result = {
        neighborhood_name: addr.neighbourhood || addr.suburb || addr.residential || addr.road || 'Local Neighborhood',
        locality: addr.suburb || addr.village || addr.county || addr.town || 'Local Locality',
        city: addr.city || addr.town || addr.district || addr.state_district || 'Local Region',
      };
    }
  } catch (err) {
    logger.warn(`[LocationService] Reverse geocode lookup failed: ${err.message}`);
  }

  geocodeCache.set(cacheKey, result);
  return result;
}

class LocationService {
  /**
   * Save or update the authenticated user's current GPS location.
   */
  async updateUserLocation({ userId, latitude, longitude, accuracy = 0 }) {
    const lat = Number(latitude);
    const lng = Number(longitude);
    const acc = Number(accuracy) || 0;

    // Resolve approximate area name
    const areaInfo = await resolveApproximateNeighborhood(lat, lng);

    const query = `
      INSERT INTO user_locations (
        user_id, latitude, longitude, geom, accuracy, neighborhood_name, locality, city, updated_at
      )
      VALUES (
        $1::uuid, 
        $2::numeric, 
        $3::numeric, 
        ST_SetSRID(ST_MakePoint($3::double precision, $2::double precision), 4326)::geography, 
        $4::numeric, 
        $5, 
        $6, 
        $7, 
        NOW()
      )
      ON CONFLICT (user_id) DO UPDATE SET
        latitude = EXCLUDED.latitude,
        longitude = EXCLUDED.longitude,
        geom = EXCLUDED.geom,
        accuracy = EXCLUDED.accuracy,
        neighborhood_name = COALESCE(EXCLUDED.neighborhood_name, user_locations.neighborhood_name),
        locality = COALESCE(EXCLUDED.locality, user_locations.locality),
        city = COALESCE(EXCLUDED.city, user_locations.city),
        updated_at = NOW()
      RETURNING id, user_id, latitude, longitude, accuracy, neighborhood_name, locality, city, created_at, updated_at
    `;

    const result = await db.query(query, [
      userId,
      lat,
      lng,
      acc,
      areaInfo.neighborhood_name,
      areaInfo.locality,
      areaInfo.city,
    ]);

    const location = result.rows[0];

    logger.info(`User location updated: ${userId} (lat: ${lat.toFixed(4)}, lon: ${lng.toFixed(4)})`);

    return {
      success: true,
      statusCode: 200,
      message: 'Location updated successfully.',
      data: {
        id: location.id,
        user_id: location.user_id,
        latitude: parseFloat(location.latitude),
        longitude: parseFloat(location.longitude),
        accuracy: parseFloat(location.accuracy),
        neighborhood_name: location.neighborhood_name,
        locality: location.locality,
        city: location.city,
        updated_at: location.updated_at,
      },
    };
  }

  /**
   * Get authenticated user's current stored location.
   */
  async getUserLocation(userId) {
    const query = `
      SELECT id, user_id, latitude, longitude, accuracy, neighborhood_name, locality, city, updated_at
      FROM user_locations
      WHERE user_id = $1::uuid
    `;
    const result = await db.query(query, [userId]);

    if (result.rows.length === 0) {
      return {
        success: false,
        statusCode: 404,
        message: 'No location recorded for this user yet. Please sync location first.',
      };
    }

    const location = result.rows[0];

    return {
      success: true,
      statusCode: 200,
      message: 'Location retrieved successfully.',
      data: {
        id: location.id,
        user_id: location.user_id,
        latitude: parseFloat(location.latitude),
        longitude: parseFloat(location.longitude),
        accuracy: parseFloat(location.accuracy),
        neighborhood_name: location.neighborhood_name,
        locality: location.locality,
        city: location.city,
        updated_at: location.updated_at,
      },
    };
  }

  /**
   * PostGIS Distance Calculation between two coordinate pairs (in meters).
   */
  async calculateDistance(lat1, lon1, lat2, lon2) {
    const query = `
      SELECT ST_Distance(
        ST_SetSRID(ST_MakePoint($2::double precision, $1::double precision), 4326)::geography,
        ST_SetSRID(ST_MakePoint($4::double precision, $3::double precision), 4326)::geography
      ) AS distance_meters
    `;
    const result = await db.query(query, [lat1, lon1, lat2, lon2]);
    return parseFloat(result.rows[0].distance_meters);
  }

  /**
   * Query nearby safety circle within radius with STRICT privacy protection.
   * NEVER returns exact coordinates, names, emails, or phone numbers of other users.
   */
  async getNearbySafetyPerimeter({ userId, latitude, longitude, radiusMeters = 2000 }) {
    let centerLat = latitude !== undefined && latitude !== null ? Number(latitude) : null;
    let centerLng = longitude !== undefined && longitude !== null ? Number(longitude) : null;

    // If coordinates not provided in query, use the user's stored location
    if (centerLat === null || centerLng === null) {
      const userLoc = await db.query('SELECT latitude, longitude FROM user_locations WHERE user_id = $1::uuid', [userId]);
      if (userLoc.rows.length === 0) {
        return {
          success: false,
          statusCode: 400,
          message: 'Current location coordinates required or user location must be saved first.',
        };
      }
      centerLat = parseFloat(userLoc.rows[0].latitude);
      centerLng = parseFloat(userLoc.rows[0].longitude);
    }

    const radius = Number(radiusMeters);

    // PostGIS Spatial Query using ST_DWithin and ST_Distance
    const query = `
      SELECT 
        ul.neighborhood_name,
        ul.locality,
        ul.city,
        ST_Distance(ul.geom, ST_SetSRID(ST_MakePoint($2::double precision, $1::double precision), 4326)::geography) AS distance_meters
      FROM user_locations ul
      JOIN users u ON u.id = ul.user_id
      WHERE ul.user_id != $3::uuid
        AND u.status = 'ACTIVE'
        AND ST_DWithin(ul.geom, ST_SetSRID(ST_MakePoint($2::double precision, $1::double precision), 4326)::geography, $4::double precision)
      ORDER BY distance_meters ASC
    `;

    const result = await db.query(query, [centerLat, centerLng, userId, radius]);

    // Privacy-preserving transformation:
    // 1. Group / round distances into 50m intervals (prevents trilateration)
    // 2. Count active residents in radius
    // 3. Return anonymous aggregate perimeter items
    const nearbyResidentsCount = result.rows.length;
    const privacySafePerimeter = result.rows.map((row) => ({
      approximate_distance_meters: Math.round(parseFloat(row.distance_meters) / 50) * 50,
      approximate_area: row.neighborhood_name || row.locality || row.city || 'Neighborhood Circle',
    }));

    return {
      success: true,
      statusCode: 200,
      message: 'Nearby safety perimeter retrieved.',
      data: {
        radius_meters: radius,
        active_residents_nearby: nearbyResidentsCount,
        safety_circle_status: nearbyResidentsCount > 0 ? 'PROTECTED' : 'STANDBY',
        nearby_nodes: privacySafePerimeter,
      },
    };
  }

  /**
   * Get approximate neighborhood / locality for coordinates or authenticated user.
   */
  async getNeighborhoodInfo({ userId, latitude, longitude }) {
    let lat = latitude !== undefined && latitude !== null ? Number(latitude) : null;
    let lng = longitude !== undefined && longitude !== null ? Number(longitude) : null;

    if (lat === null || lng === null) {
      const userLoc = await db.query('SELECT latitude, longitude FROM user_locations WHERE user_id = $1::uuid', [userId]);
      if (userLoc.rows.length === 0) {
        return {
          success: false,
          statusCode: 400,
          message: 'Coordinates required or user location must be saved first.',
        };
      }
      lat = parseFloat(userLoc.rows[0].latitude);
      lng = parseFloat(userLoc.rows[0].longitude);
    }

    const area = await resolveApproximateNeighborhood(lat, lng);

    return {
      success: true,
      statusCode: 200,
      message: 'Neighborhood information resolved.',
      data: {
        latitude: lat,
        longitude: lng,
        neighborhood_name: area.neighborhood_name,
        locality: area.locality,
        city: area.city,
      },
    };
  }
}

module.exports = new LocationService();
