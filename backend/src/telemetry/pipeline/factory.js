const { TelemetryProcessingPipeline } = require('./pipeline');
const { PipelineMetricsSink } = require('./metricsSink');
const { SchemaVersionStage } = require('./stages/schemaVersionStage');
const { AuthenticationContextStage } = require('./stages/authenticationContextStage');
const { OrderingVerificationStage } = require('./stages/orderingVerificationStage');
const { IdempotencyStage } = require('./stages/idempotencyStage');
const { TimestampNormalizationStage } = require('./stages/timestampNormalizationStage');
const { MetadataEnrichmentStage } = require('./stages/metadataEnrichmentStage');
const { EventClassificationStage } = require('./stages/eventClassificationStage');
const { PersistenceStage } = require('./stages/persistenceStage');
const { AcknowledgementStage } = require('./stages/acknowledgementStage');

const SUPPORTED_SCHEMA_VERSION = 1;

function createTelemetryProcessingPipeline({ repository, logger = null, serverNode = null } = {}) {
  const metricsSink = new PipelineMetricsSink({ repository });
  return new TelemetryProcessingPipeline({
    logger,
    metricsSink,
    stages: [
      new SchemaVersionStage({ supportedSchemaVersion: SUPPORTED_SCHEMA_VERSION }),
      new AuthenticationContextStage(),
      new OrderingVerificationStage(),
      new IdempotencyStage({ repository }),
      new TimestampNormalizationStage(),
      new MetadataEnrichmentStage(serverNode ? { serverNode } : {}),
      new EventClassificationStage(),
      new PersistenceStage({ repository }),
      new AcknowledgementStage()
    ]
  });
}

module.exports = { createTelemetryProcessingPipeline, SUPPORTED_SCHEMA_VERSION };
