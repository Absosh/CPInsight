const Joi = require('joi');

const leetcodeCollectionSchema = Joi.object({
  provider: Joi.string().valid('leetcode').required(),
  sessionId: Joi.string().trim().min(12).max(180).required(),
  username: Joi.string().trim().min(1).max(120).required(),
  metadata: Joi.object({
    collectorVersion: Joi.string().trim().min(1).max(120).required(),
    payloadHash: Joi.string().trim().min(1).max(120).required(),
    sessionStage: Joi.string().trim().allow(null, ''),
    warnings: Joi.array().items(Joi.any()).default([])
  }).unknown(true).required(),
  profile: Joi.object().unknown(true).required(),
  progress: Joi.object({
    questionDataset: Joi.object({
      questions: Joi.array().items(Joi.object().unknown(true)).required(),
      totalNum: Joi.number().integer().min(0).required()
    }).unknown(true).required()
  }).unknown(true).required(),
  analytics: Joi.object().unknown(true).required(),
  collectionTimestamps: Joi.object({
    startedAt: Joi.date().iso().required(),
    profileCollectedAt: Joi.date().iso().allow(null),
    progressCollectedAt: Joi.date().iso().allow(null),
    mergedAt: Joi.date().iso().required()
  }).unknown(true).required(),
  source: Joi.object().unknown(true).required(),
  upload: Joi.object({
    sessionId: Joi.string().trim().min(12).max(180).required(),
    collectionDurationMs: Joi.number().integer().min(0).allow(null),
    providerVersion: Joi.string().trim().allow(null, ''),
    collectorVersion: Joi.string().trim().min(1).max(120).required()
  }).unknown(true).required()
}).unknown(true);

module.exports = { leetcodeCollectionSchema };
