class TelemetryPipelineError extends Error {
  constructor(message, { code, status = 400, category = 'validation', transient = false, details = null } = {}) {
    super(message);
    this.code = code || 'TELEMETRY_PIPELINE_ERROR';
    this.status = status;
    this.category = category;
    this.transient = transient;
    this.details = details;
  }
}

module.exports = { TelemetryPipelineError };
