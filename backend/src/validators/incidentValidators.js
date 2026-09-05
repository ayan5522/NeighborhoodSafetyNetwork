const { VALID_CATEGORIES } = require('../constants/incidentCategories');
const { VALID_SEVERITIES } = require('../constants/incidentSeverities');

/**
 * Validate input for creating a new safety incident.
 */
function validateCreateIncidentInput(data) {
  const errors = [];
  const { category, title, description, severity, latitude, longitude } = data || {};

  // 1. Category
  if (!category || typeof category !== 'string' || !category.trim()) {
    errors.push('Incident category is required.');
  } else if (!VALID_CATEGORIES.includes(category.trim().toUpperCase())) {
    errors.push(`Invalid incident category. Allowed: ${VALID_CATEGORIES.join(', ')}.`);
  }

  // 2. Title (3 - 120 chars)
  if (!title || typeof title !== 'string' || !title.trim()) {
    errors.push('Incident title is required.');
  } else {
    const trimmedTitle = title.trim();
    if (trimmedTitle.length < 3) {
      errors.push('Incident title must be at least 3 characters long.');
    } else if (trimmedTitle.length > 120) {
      errors.push('Incident title cannot exceed 120 characters.');
    }
  }

  // 3. Description (10 - 2000 chars)
  if (!description || typeof description !== 'string' || !description.trim()) {
    errors.push('Incident description is required.');
  } else {
    const trimmedDesc = description.trim();
    if (trimmedDesc.length < 10) {
      errors.push('Incident description must be at least 10 characters long.');
    } else if (trimmedDesc.length > 2000) {
      errors.push('Incident description cannot exceed 2000 characters.');
    }
  }

  // 4. Severity
  if (!severity || typeof severity !== 'string' || !severity.trim()) {
    errors.push('Incident severity level is required.');
  } else if (!VALID_SEVERITIES.includes(severity.trim().toUpperCase())) {
    errors.push(`Invalid severity level. Allowed: ${VALID_SEVERITIES.join(', ')}.`);
  }

  // 5. Latitude (-90.0 to 90.0)
  if (latitude === undefined || latitude === null || latitude === '') {
    errors.push('Incident latitude is required.');
  } else {
    const latNum = Number(latitude);
    if (isNaN(latNum) || latNum < -90.0 || latNum > 90.0) {
      errors.push('Latitude must be a valid number between -90 and 90 degrees.');
    }
  }

  // 6. Longitude (-180.0 to 180.0)
  if (longitude === undefined || longitude === null || longitude === '') {
    errors.push('Incident longitude is required.');
  } else {
    const lngNum = Number(longitude);
    if (isNaN(lngNum) || lngNum < -180.0 || lngNum > 180.0) {
      errors.push('Longitude must be a valid number between -180 and 180 degrees.');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: errors.length === 0 ? {
      category: category.trim().toUpperCase(),
      title: title.trim(),
      description: description.trim(),
      severity: severity.trim().toUpperCase(),
      latitude: Number(latitude),
      longitude: Number(longitude),
    } : null,
  };
}

/**
 * Validate input for updating a pending incident.
 */
function validateUpdateIncidentInput(data) {
  const errors = [];
  const { category, title, description, severity, status, reporter_id, id, created_at } = data || {};

  // Reject unauthorized field manipulation
  if (status !== undefined || reporter_id !== undefined || id !== undefined || created_at !== undefined) {
    errors.push('System fields (status, reporter_id, id, timestamps) cannot be modified directly.');
  }

  const updates = {};

  if (category !== undefined) {
    if (typeof category !== 'string' || !category.trim()) {
      errors.push('Category cannot be empty.');
    } else if (!VALID_CATEGORIES.includes(category.trim().toUpperCase())) {
      errors.push(`Invalid category. Allowed: ${VALID_CATEGORIES.join(', ')}.`);
    } else {
      updates.category = category.trim().toUpperCase();
    }
  }

  if (title !== undefined) {
    if (typeof title !== 'string' || !title.trim()) {
      errors.push('Title cannot be empty.');
    } else {
      const trimmedTitle = title.trim();
      if (trimmedTitle.length < 3 || trimmedTitle.length > 120) {
        errors.push('Title must be between 3 and 120 characters.');
      } else {
        updates.title = trimmedTitle;
      }
    }
  }

  if (description !== undefined) {
    if (typeof description !== 'string' || !description.trim()) {
      errors.push('Description cannot be empty.');
    } else {
      const trimmedDesc = description.trim();
      if (trimmedDesc.length < 10 || trimmedDesc.length > 2000) {
        errors.push('Description must be between 10 and 2000 characters.');
      } else {
        updates.description = trimmedDesc;
      }
    }
  }

  if (severity !== undefined) {
    if (typeof severity !== 'string' || !severity.trim()) {
      errors.push('Severity cannot be empty.');
    } else if (!VALID_SEVERITIES.includes(severity.trim().toUpperCase())) {
      errors.push(`Invalid severity level. Allowed: ${VALID_SEVERITIES.join(', ')}.`);
    } else {
      updates.severity = severity.trim().toUpperCase();
    }
  }

  if (Object.keys(updates).length === 0 && errors.length === 0) {
    errors.push('At least one field (title, description, category, severity) must be provided to update.');
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: errors.length === 0 ? updates : null,
  };
}

module.exports = {
  validateCreateIncidentInput,
  validateUpdateIncidentInput,
};
