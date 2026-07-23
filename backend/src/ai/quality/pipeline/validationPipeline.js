const crypto = require('crypto');
const { normalize } = require('../normalization/responseNormalizer');
const { validateSchema } = require('../validation/schemaValidator');
const { validateGrounding } = require('../validation/groundingValidator');
const { validateCitations } = require('../validation/citationValidator');
const { validateRecommendations } = require('../validation/recommendationValidator');
const { validateConfidence } = require('../validation/confidenceValidator');
const { validateConsistency } = require('../validation/consistencyValidator');
const { score } = require('../evaluation/qualityEvaluator');
const { generateReflections } = require('../reflection/reflectionGenerator');

function finalResponse(response, confidence) {
  return Object.freeze({
    observations: response.observations,
    inferences: response.inferences,
    recommendations: response.recommendations,
    citations: response.citations,
    confidence: confidence.finalConfidence,
    uncertainty: response.uncertainty,
    summary: response.summary,
    metadata: response.metadata
  });
}

class ValidationPipeline {
  constructor({ qualityThreshold = 0.7, maxRegenerationRequests = 1 } = {}) {
    this.qualityThreshold = qualityThreshold;
    this.maxRegenerationRequests = maxRegenerationRequests;
  }

  validate({ executionPlan, reasoningContext, evidencePackage, rawResponse }) {
    const startedAt = Date.now();
    const normalized = normalize(rawResponse);
    const schema = validateSchema(normalized);
    const response = schema.repaired;
    const grounding = validateGrounding(response, evidencePackage, reasoningContext);
    const citations = validateCitations(response, evidencePackage, reasoningContext);
    const recommendations = validateRecommendations(response, evidencePackage, reasoningContext);
    const confidence = validateConfidence(response, evidencePackage, reasoningContext);
    const consistency = validateConsistency(response);
    const validation = { response, schema, grounding, citations, recommendations, confidence, consistency, evidencePackage };
    const qualityReport = score(validation);
    const regeneration = {
      requested: qualityReport.overallQualityScore < this.qualityThreshold || !schema.valid || !grounding.valid || !citations.valid,
      reasons: [
        ...(qualityReport.overallQualityScore < this.qualityThreshold ? ['quality_below_threshold'] : []),
        ...(!schema.valid ? ['schema_failure'] : []),
        ...(!grounding.valid ? ['grounding_failure'] : []),
        ...(!citations.valid ? ['citation_failure'] : [])
      ],
      maxRetries: this.maxRegenerationRequests
    };
    const validatedResponse = finalResponse(response, confidence);
    const reflections = qualityReport.overallQualityScore >= this.qualityThreshold
      ? generateReflections({ reasoningContext, qualityReport })
      : [];
    return Object.freeze({
      validationId: crypto.randomUUID(),
      executionPlanId: executionPlan.executionPlanId,
      reasoningContextId: reasoningContext.contextId,
      evidencePackageId: evidencePackage.packageId,
      validatedResponse,
      validationReport: {
        schema,
        grounding,
        citations,
        recommendations,
        confidence,
        consistency,
        regeneration
      },
      qualityReport,
      behaviorReflections: reflections,
      metadata: {
        validationLatencyMs: Date.now() - startedAt,
        createdAt: new Date().toISOString(),
        validationVersion: 1
      }
    });
  }
}

module.exports = { ValidationPipeline };

