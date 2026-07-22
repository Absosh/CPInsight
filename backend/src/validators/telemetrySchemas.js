const Joi = require('joi');

const uuid = Joi.string().guid({ version: ['uuidv4', 'uuidv5'] });
const isoDate = Joi.date().iso();

const telemetryEventSchema = Joi.object({
  sequenceNumber: Joi.number().integer().min(1).required(),
  event: Joi.object({
    eventId: uuid.required(),
    sessionId: Joi.string().trim().min(1).max(180).required(),
    userId: Joi.string().allow(null),
    platform: Joi.string().trim().min(1).max(80).required(),
    contestId: Joi.string().trim().min(1).max(180).required(),
    contestName: Joi.string().allow(null, '').max(500),
    problemId: Joi.string().allow(null, '').max(255),
    eventType: Joi.string().trim().min(1).max(120).required(),
    timestamp: isoDate.required(),
    pageUrl: Joi.string().uri({ scheme: ['http', 'https'] }).max(2048).required(),
    metadata: Joi.object().unknown(true).default({})
  }).unknown(false).required()
}).unknown(false);

const telemetryUploadSchema = Joi.object({
  batchId: uuid.required(),
  sequenceNumber: Joi.number().integer().min(1).required(),
  createdAt: isoDate.required(),
  sdkVersion: Joi.string().trim().min(1).max(120).required(),
  schemaVersion: Joi.number().integer().min(1).max(100).required(),
  collectorVersion: Joi.string().trim().min(1).max(160).required(),
  events: Joi.array().items(telemetryEventSchema).min(1).max(500).required()
}).unknown(false);

module.exports = { telemetryUploadSchema };
