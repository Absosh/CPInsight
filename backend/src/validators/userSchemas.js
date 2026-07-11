const Joi = require('joi');

const updateProfileSchema = Joi.object({
  displayName: Joi.string().min(1).max(80),
  timezone: Joi.string().min(1).max(64),
  country: Joi.string().length(2).uppercase(),
  avatarUrl: Joi.string().uri(),
  preferences: Joi.object()
}).min(1);

module.exports = { updateProfileSchema };
