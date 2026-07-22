const { PipelineStage } = require('../stage');

class AcknowledgementStage extends PipelineStage {
  constructor() {
    super('acknowledgement');
  }

  async process(context) {
    return {
      ...context,
      acknowledgement: Object.freeze({
        batchId: context.batch.batchId,
        acknowledgedEventIds: context.acknowledgedEventIds,
        highestSequenceNumber: context.highestSequenceNumber,
        serverTimestamp: new Date().toISOString()
      })
    };
  }
}

module.exports = { AcknowledgementStage };
