const os = require('os');
const crypto = require('crypto');
const { PipelineStage } = require('../stage');

class MetadataEnrichmentStage extends PipelineStage {
  constructor({ serverNode = os.hostname, now = () => new Date() } = {}) {
    super('metadata-enrichment');
    this.serverNode = typeof serverNode === 'function' ? serverNode : () => serverNode;
    this.now = now;
  }

  async process(context) {
    const receivedAt = context.receivedAt || this.now().toISOString();
    const requestId = context.requestId || crypto.randomUUID();
    const processableItems = context.processableItems.map((item) => {
      const processingLatency = Date.now() - Date.parse(item.event.timestamp);
      return Object.freeze({
        ...item,
        processed: Object.freeze({
          receivedAt,
          ingestedAt: this.now().toISOString(),
          processingLatency,
          sdkVersion: context.batch.sdkVersion,
          collectorVersion: context.batch.collectorVersion,
          schemaVersion: context.batch.schemaVersion,
          platform: item.event.platform,
          userId: context.userId,
          batchId: context.batch.batchId,
          requestId,
          serverNode: this.serverNode()
        })
      });
    });
    return {
      ...context,
      requestId,
      receivedAt,
      processableItems
    };
  }
}

module.exports = { MetadataEnrichmentStage };
