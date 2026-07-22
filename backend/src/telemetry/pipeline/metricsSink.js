class PipelineMetricsSink {
  constructor({ repository }) {
    this.repository = repository;
  }

  async record(context) {
    if (!this.repository?.insertPipelineMetrics) return null;
    return this.repository.insertPipelineMetrics({
      userId: context.userId,
      batchId: context.batch?.batchId || null,
      requestId: context.requestId || null,
      metrics: context.metrics || {},
      status: context.error ? 'failed' : 'processed',
      errorCode: context.error?.code || null,
      errorMessage: context.error?.message || null
    });
  }
}

module.exports = { PipelineMetricsSink };
