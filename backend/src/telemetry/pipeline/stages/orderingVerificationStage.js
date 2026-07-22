const { PipelineStage } = require('../stage');
const { TelemetryPipelineError } = require('../errors');

class OrderingVerificationStage extends PipelineStage {
  constructor() {
    super('ordering-verification');
  }

  async process(context) {
    let previous = 0;
    const seen = new Set();
    for (const item of context.batch.events) {
      if (seen.has(item.sequenceNumber)) {
        throw new TelemetryPipelineError('Telemetry batch contains duplicate sequenceNumber', {
          code: 'DUPLICATE_SEQUENCE_NUMBER',
          status: 400,
          category: 'ordering',
          details: { sequenceNumber: item.sequenceNumber }
        });
      }
      seen.add(item.sequenceNumber);
      if (item.sequenceNumber <= previous) {
        throw new TelemetryPipelineError('Telemetry events must be ordered by increasing sequenceNumber', {
          code: 'OUT_OF_ORDER_EVENTS',
          status: 400,
          category: 'ordering'
        });
      }
      if (item.sequenceNumber !== previous + 1 && previous !== 0) {
        throw new TelemetryPipelineError('Telemetry batch contains missing sequence numbers', {
          code: 'MISSING_SEQUENCE_NUMBER',
          status: 400,
          category: 'ordering',
          details: { previousSequenceNumber: previous, sequenceNumber: item.sequenceNumber }
        });
      }
      previous = item.sequenceNumber;
    }
    return {
      ...context,
      highestSequenceNumber: previous
    };
  }
}

module.exports = { OrderingVerificationStage };
