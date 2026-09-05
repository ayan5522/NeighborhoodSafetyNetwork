/**
 * Module 4: Personal SOS Validators
 */
const validateSOSTrigger = (data) => {
  const errors = [];
  const { latitude, longitude } = data || {};

  if (latitude === undefined || latitude === null || isNaN(Number(latitude))) {
    errors.push('Latitude is required and must be a valid number.');
  } else {
    const lat = Number(latitude);
    if (lat < -90 || lat > 90) {
      errors.push('Latitude must be between -90 and 90 degrees.');
    }
  }

  if (longitude === undefined || longitude === null || isNaN(Number(longitude))) {
    errors.push('Longitude is required and must be a valid number.');
  } else {
    const lon = Number(longitude);
    if (lon < -180 || lon > 180) {
      errors.push('Longitude must be between -180 and 180 degrees.');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

module.exports = {
  validateSOSTrigger,
};
