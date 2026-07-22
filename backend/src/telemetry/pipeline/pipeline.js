const { TelemetryPipelineError } = require('./errors');

function nowIso() {
  return new Date().toISOString();
}

class TelemetryProcessingPipeline {
  constructor({ stages = [], metricsSink = null, logger = null } = {}) {
    this.stages = stages;
    this.metricsSink = metricsSink;
    this.logger = logger;
  }

  async initialize() {
    for (const stage of this.stages) {
      await stage.initialize();
    }
  }

  async process(initialContext) {
    const startedAt = Date.now();
    let context = {
      ...initialContext,
      metrics: {
        eventsReceived: initialContext.batch?.events?.length || 0,
        eventsProcessed: 0,
        duplicatesRemoved: 0,
        validationFailures: 0,
        processingErrors: 0,
        retryCount: 0,
        queueDepth: initialContext.batch?.events?.length || 0,
        pipelineThroughput: 0,
        averageProcessingLatency: 0
      },
      processing: {
        startedAt: nowIso(),
        stageTimings: []
      },
      failures: [],
      acknowledgedEventIds: []
    };

    try {
      for (const stage of this.stages) {
        const stageStartedAt = Date.now();
        context = await stage.process(Object.freeze({ ...context }));
        context.processing.stageTimings.push({
          stage: stage.name,
          durationMs: Date.now() - stageStartedAt
        });
      }
      context.metrics.averageProcessingLatency = Date.now() - startedAt;
      context.metrics.pipelineThroughput = context.metrics.averageProcessingLatency > 0
        ? Math.round((context.metrics.eventsProcessed / context.metrics.averageProcessingLatency) * 1000)
        : context.metrics.eventsProcessed;
      await this.metricsSink?.record?.(context);
      return context;
    } catch (error) {
      const normalized = error instanceof TelemetryPipelineError
        ? error
        : new TelemetryPipelineError(error?.message || 'Telemetry pipeline failed', {
          code: 'PIPELINE_TRANSIENT_FAILURE',
          status: 500,
          category: 'transient',
          transient: true
        });
      context.metrics.processingErrors += 1;
      context.error = normalized;
      await this.metricsSink?.record?.(context).catch(() => {});
      this.logger?.warn?.('Telemetry processing pipeline failed', {
        code: normalized.code,
        message: normalized.message
      });
      throw normalized;
    }
  }

  async flush() {
    for (const stage of this.stages) {
      await stage.flush();
    }
  }

  async shutdown() {
    for (const stage of this.stages.slice().reverse()) {
      await stage.shutdown();
    }
  }
}

module.exports = { TelemetryProcessingPipeline };
