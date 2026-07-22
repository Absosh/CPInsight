const { PipelineStage } = require('../stage');
const { TelemetryPipelineError } = require('../errors');

class SchemaVersionStage extends PipelineStage {
  constructor({ supportedSchemaVersion }) {
    super('schema-validation');
    this.supportedSchemaVersion = supportedSchemaVersion;
  }

  async process(context) {
    if (context.batch.schemaVersion !== this.supportedSchemaVersion) {
      throw new TelemetryPipelineError('Unsupported telemetry schema version', {
        code: 'UNSUPPORTED_SCHEMA_VERSION',
        status: 409,
        category: 'validation',
        details: {
          expected: this.supportedSchemaVersion,
          actual: context.batch.schemaVersion
        }
      });
    }
    return context;
  }
}

module.exports = { SchemaVersionStage };
