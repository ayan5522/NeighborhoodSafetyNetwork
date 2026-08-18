const { apiError } = require('../utils/response');

/**
 * Higher-order middleware to run a validator function or Zod schema on req.body or req.query.
 * @param {Function|Object} schemaOrFn - Validator function returning { isValid, errors, sanitized } or Zod schema
 * @param {'body'|'query'|'params'} source - Property on req to validate (default: 'body')
 */
function validate(schemaOrFn, source = 'body') {
  return (req, res, next) => {
    const target = req[source] || {};

    // If it's a Zod schema (has .safeParse)
    if (schemaOrFn && typeof schemaOrFn.safeParse === 'function') {
      const result = schemaOrFn.safeParse(target);
      if (!result.success) {
        const errorMessages = result.error.errors.map((e) => e.message);
        return apiError(res, 400, errorMessages[0] || 'Validation failed', errorMessages);
      }
      if (source === 'body') {
        req.sanitizedBody = result.data;
      }
      return next();
    }

    // Otherwise treat as custom function returning { isValid, errors, sanitized }
    if (typeof schemaOrFn === 'function') {
      const result = schemaOrFn(target);
      if (!result.isValid) {
        return apiError(res, 400, result.errors[0] || 'Validation failed', result.errors);
      }
      if (source === 'body') {
        req.sanitizedBody = result.sanitized;
      }
      return next();
    }

    next();
  };
}

module.exports = validate;
