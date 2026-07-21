const Joi = require('joi');

const platformSchema = Joi.string().valid('codeforces', 'codechef', 'leetcode', 'atcoder').required();

const connectSchema = Joi.object({
  platform: platformSchema,
  handle: Joi.string().trim().min(1).max(120).required()
});

const disconnectSchema = Joi.object({
  platform: platformSchema
});

const platformParamSchema = Joi.object({
  platform: platformSchema
});

module.exports = { connectSchema, disconnectSchema, platformParamSchema };
