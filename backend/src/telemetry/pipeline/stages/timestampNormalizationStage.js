const { PipelineStage } = require('../stage');
const { TelemetryPipelineError } = require('../errors');

class TimestampNormalizationStage extends PipelineStage {
  constructor({ maxFutureSkewMs = 5 * 60 * 1000 } = {}) {
    super('timestamp-normalization');
    this.maxFutureSkewMs = maxFutureSkewMs;
  }

  async process(context) {
    const now = Date.now();
    const batchCreatedAt = Date.parse(context.batch.createdAt);
    if (!Number.isFinite(batchCreatedAt) || batchCreatedAt > now + this.maxFutureSkewMs) {
      throw new TelemetryPipelineError('Telemetry batch createdAt is invalid', {
        code: 'INVALID_BATCH_TIMESTAMP',
        status: 400,
        category: 'validation'
      });
    }
    const processableItems = context.processableItems.map((item) => {
      const eventTimestamp = Date.parse(item.event.timestamp);
      if (!Number.isFinite(eventTimestamp) || eventTimestamp > now + this.maxFutureSkewMs) {
        throw new TelemetryPipelineError('Telemetry event timestamp is invalid', {
          code: 'INVALID_EVENT_TIMESTAMP',
          status: 400,
          category: 'validation',
          details: { eventId: item.event.eventId }
        });
      }
      return {
        ...item,
        normalizedTimestamp: new Date(eventTimestamp).toISOString()
      };
    });
    return {
      ...context,
      batchCreatedAt: new Date(batchCreatedAt).toISOString(),
      processableItems
    };
  }
}

module.exports = { TimestampNormalizationStage };
