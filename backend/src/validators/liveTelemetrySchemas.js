const Joi = require('joi');

const uuid = Joi.string().guid({ version: ['uuidv4', 'uuidv5'] });
const isoDate = Joi.date().iso();

const platform = Joi.string().valid('codeforces', 'codechef', 'leetcode').required();

const startLiveTelemetrySessionSchema = Joi.object({
  platform,
  contestId: Joi.string().trim().min(1).max(180).required(),
  contestName: Joi.string().allow(null, '').max(500),
  contestUrl: Joi.string().uri({ scheme: ['http', 'https'] }).max(2048).required(),
  userHandle: Joi.string().trim().min(1).max(180).required(),
  contestStartTime: isoDate.allow(null),
  contestEndTime: isoDate.allow(null),
  metadata: Joi.object().unknown(true).default({})
}).unknown(false);

const liveEventSchema = Joi.object({
  eventId: uuid.required(),
  eventType: Joi.string().trim().min(1).max(120).required(),
  timestamp: isoDate.required(),
  pageUrl: Joi.string().uri({ scheme: ['http', 'https'] }).max(2048).required(),
  problemId: Joi.string().allow(null, '').max(255),
  metadata: Joi.object().unknown(true).default({})
}).unknown(false);

const liveTelemetryEventsSchema = Joi.object({
  liveSessionId: uuid.required(),
  sessionToken: Joi.string().trim().min(32).max(512).required(),
  sequenceNumber: Joi.number().integer().min(1).required(),
  events: Joi.array().items(liveEventSchema).min(1).max(200).required(),
  metadata: Joi.object().unknown(true).default({})
}).unknown(false);

const liveTelemetryHeartbeatSchema = Joi.object({
  liveSessionId: uuid.required(),
  sessionToken: Joi.string().trim().min(32).max(512).required(),
  connectionStatus: Joi.string().valid('connected', 'offline', 'reconnecting', 'stopped').required(),
  eventCount: Joi.number().integer().min(0).default(0),
  queueDepth: Joi.number().integer().min(0).default(0),
  metadata: Joi.object().unknown(true).default({})
}).unknown(false);

const stopLiveTelemetrySessionSchema = Joi.object({
  liveSessionId: uuid.required(),
  sessionToken: Joi.string().trim().min(32).max(512).required(),
  reason: Joi.string().trim().max(240).default('manual_stop'),
  finalStatistics: Joi.object().unknown(true).default({})
}).unknown(false);

module.exports = {
  startLiveTelemetrySessionSchema,
  liveTelemetryEventsSchema,
  liveTelemetryHeartbeatSchema,
  stopLiveTelemetrySessionSchema
};
