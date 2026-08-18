/**
 * Location validation helpers for Module 2.
 * Pure JavaScript, zero-dependency validator following project conventions.
 */

function validateUpdateLocationInput(data) {
  const errors = [];
  const { latitude, longitude, accuracy } = data || {};

  // 1. Latitude Validation (-90.0 to 90.0)
  if (latitude === undefined || latitude === null || latitude === '') {
    errors.push('Latitude is required.');
  } else {
    const latNum = Number(latitude);
    if (isNaN(latNum) || latNum < -90.0 || latNum > 90.0) {
      errors.push('Latitude must be a valid number between -90 and 90 degrees.');
    }
  }

  // 2. Longitude Validation (-180.0 to 180.0)
  if (longitude === undefined || longitude === null || longitude === '') {
    errors.push('Longitude is required.');
  } else {
    const lngNum = Number(longitude);
    if (isNaN(lngNum) || lngNum < -180.0 || lngNum > 180.0) {
      errors.push('Longitude must be a valid number between -180 and 180 degrees.');
    }
  }

  // 3. Accuracy Validation (optional non-negative number)
  if (accuracy !== undefined && accuracy !== null && accuracy !== '') {
    const accNum = Number(accuracy);
    if (isNaN(accNum) || accNum < 0) {
      errors.push('Accuracy radius must be a non-negative number.');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: errors.length === 0 ? {
      latitude: Number(latitude),
      longitude: Number(longitude),
      accuracy: accuracy !== undefined ? Number(accuracy) : 0,
    } : null,
  };
}

function validateNearbyQuery(query) {
  const errors = [];
  const { radius, latitude, longitude } = query || {};

  // 1. Radius validation (50m to 50000m)
  if (radius !== undefined && radius !== null && radius !== '') {
    const radNum = Number(radius);
    if (isNaN(radNum) || radNum < 50 || radNum > 50000) {
      errors.push('Search radius must be a number between 50 and 50,000 meters.');
    }
  }

  // 2. Latitude validation (if supplied)
  if (latitude !== undefined && latitude !== null && latitude !== '') {
    const latNum = Number(latitude);
    if (isNaN(latNum) || latNum < -90.0 || latNum > 90.0) {
      errors.push('Latitude must be a valid number between -90 and 90 degrees.');
    }
  }

  // 3. Longitude validation (if supplied)
  if (longitude !== undefined && longitude !== null && longitude !== '') {
    const lngNum = Number(longitude);
    if (isNaN(lngNum) || lngNum < -180.0 || lngNum > 180.0) {
      errors.push('Longitude must be a valid number between -180 and 180 degrees.');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: errors.length === 0 ? {
      radius: radius ? Number(radius) : 2000,
      latitude: latitude ? Number(latitude) : undefined,
      longitude: longitude ? Number(longitude) : undefined,
    } : null,
  };
}

function validateNeighborhoodQuery(query) {
  const errors = [];
  const { latitude, longitude } = query || {};

  if (latitude !== undefined && latitude !== null && latitude !== '') {
    const latNum = Number(latitude);
    if (isNaN(latNum) || latNum < -90.0 || latNum > 90.0) {
      errors.push('Latitude must be a valid number between -90 and 90 degrees.');
    }
  }

  if (longitude !== undefined && longitude !== null && longitude !== '') {
    const lngNum = Number(longitude);
    if (isNaN(lngNum) || lngNum < -180.0 || lngNum > 180.0) {
      errors.push('Longitude must be a valid number between -180 and 180 degrees.');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: errors.length === 0 ? {
      latitude: latitude ? Number(latitude) : undefined,
      longitude: longitude ? Number(longitude) : undefined,
    } : null,
  };
}

module.exports = {
  validateUpdateLocationInput,
  validateNearbyQuery,
  validateNeighborhoodQuery,
};
