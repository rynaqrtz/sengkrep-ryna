class ValidationError extends Error {
  constructor(message, errors) {
    super(message);
    this.name   = 'ValidationError';
    this.errors = errors;
  }
}

class SchemaValidator {
  constructor(rules = {}) {
    this.rules = rules;
  }

  _type(value, type) {
    switch (type) {
      case 'string':  return typeof value === 'string';
      case 'number':  return !isNaN(parseFloat(String(value)));
      case 'boolean': return ['true', 'false', true, false].includes(value);
      case 'url':     try { new URL(value); return true; } catch { return false; }
      case 'email':   return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value));
      case 'date':    return !isNaN(Date.parse(String(value)));
      default:        return true;
    }
  }

  validate(data) {
    const errors   = [];
    const warnings = [];

    for (const [field, rules] of Object.entries(this.rules)) {
      const value   = data[field];
      const isEmpty = value === null || value === undefined || value === '';

      if (rules.required && isEmpty) {
        errors.push({ field, rule: 'required', message: `"${field}" is required but missing` });
        continue;
      }

      if (isEmpty) continue;

      if (rules.type && !this._type(value, rules.type)) {
        errors.push({ field, rule: 'type', message: `"${field}" expected ${rules.type}, got: ${String(value).slice(0, 80)}` });
      }

      if (rules.pattern && !rules.pattern.test(String(value))) {
        errors.push({ field, rule: 'pattern', message: `"${field}" does not match expected pattern: ${String(value).slice(0, 80)}` });
      }

      if (rules.minLength !== undefined && String(value).length < rules.minLength) {
        warnings.push({ field, rule: 'minLength', message: `"${field}" too short: ${String(value).length} chars (min: ${rules.minLength})` });
      }

      if (rules.maxLength !== undefined && String(value).length > rules.maxLength) {
        warnings.push({ field, rule: 'maxLength', message: `"${field}" too long: ${String(value).length} chars (max: ${rules.maxLength})` });
      }

      if (rules.notEmpty && String(value).trim() === '') {
        errors.push({ field, rule: 'notEmpty', message: `"${field}" must not be blank` });
      }

      if (Array.isArray(value) && rules.minItems !== undefined && value.length < rules.minItems) {
        warnings.push({ field, rule: 'minItems', message: `"${field}" has ${value.length} items (expected min: ${rules.minItems})` });
      }

      if (rules.custom && typeof rules.custom === 'function') {
        const result = rules.custom(value, data);
        if (result !== true) {
          errors.push({ field, rule: 'custom', message: result ?? `Custom validation failed for "${field}"` });
        }
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  validateMany(items) {
    return items.map((item, i) => {
      const result = this.validate(item);
      return { index: i, ...result };
    });
  }
}

module.exports = { SchemaValidator, ValidationError };
