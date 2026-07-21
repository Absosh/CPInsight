const Joi = require('joi');

const updateProfileSchema = Joi.object({
  displayName: Joi.string().min(1).max(80),
  display_name: Joi.string().min(1).max(80),
  timezone: Joi.string().min(1).max(64),
  country: Joi.string().allow(null, '').max(80),
  collegeId: Joi.string().allow(null, '').max(120),
  college_id: Joi.string().allow(null, '').max(120),
  preferences: Joi.object()
}).min(1).custom((value) => {
  const normalized = {};

  if (Object.prototype.hasOwnProperty.call(value, 'displayName') || Object.prototype.hasOwnProperty.call(value, 'display_name')) {
    normalized.displayName = value.displayName ?? value.display_name;
  }

  if (Object.prototype.hasOwnProperty.call(value, 'timezone')) {
    normalized.timezone = value.timezone;
  }

  if (Object.prototype.hasOwnProperty.call(value, 'country')) {
    normalized.country = value.country || null;
  }

  if (Object.prototype.hasOwnProperty.call(value, 'collegeId') || Object.prototype.hasOwnProperty.call(value, 'college_id')) {
    normalized.collegeId = (value.collegeId ?? value.college_id) || null;
  }

  if (Object.prototype.hasOwnProperty.call(value, 'preferences')) {
    normalized.preferences = value.preferences;
  }

  return normalized;
});

const avatarUploadSchema = Joi.object({
  imageData: Joi.string().max(3_000_000).required()
});

const collegeQuerySchema = Joi.object({
  search: Joi.string().allow('').max(120)
});

module.exports = {
  updateProfileSchema,
  avatarUploadSchema,
  collegeQuerySchema
};
