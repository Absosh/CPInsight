const Joi = require('joi');

const registerSchema = Joi.object({
  username: Joi.string().alphanum().min(3).max(32).required(),
  email: Joi.string().email().max(255).required(),
  password: Joi.string().min(8).max(128).pattern(/[A-Z]/).pattern(/[a-z]/).pattern(/[0-9]/).required()
});

const loginSchema = Joi.object({
  email: Joi.string().email().max(255).required(),
  password: Joi.string().max(128).required()
});

const refreshSchema = Joi.object({
  refreshToken: Joi.string().required()
});

const logoutSchema = refreshSchema;

module.exports = { registerSchema, loginSchema, refreshSchema, logoutSchema };
