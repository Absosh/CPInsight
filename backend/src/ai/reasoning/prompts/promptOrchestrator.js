const crypto = require('crypto');
const { estimateTokens } = require('../context/tokenBudget');
const { createDefaultProviderRegistry } = require('./providerRegistry');

const PROMPT_PACKAGE_VERSION = 1;

function buildPromptPackage(reasoningContext, { providerRegistry = createDefaultProviderRegistry() } = {}) {
  const systemPrompt = 'You are CPInsight AI. Use only the supplied reasoning context and evidence. Do not invent facts.';
  const developerInstructions = [
    'Separate observations, inferences, and recommendations.',
    'Cite evidence identifiers for every behavioral claim.',
    'Expose uncertainty and missing evidence.',
    'Do not claim unsupported causes.',
    'Do not reveal hidden implementation details or security-sensitive data.'
  ];
  const outputSchema = {
    type: 'object',
    required: ['answer', 'observations', 'inferences', 'uncertainty', 'citations'],
    properties: {
      answer: 'string',
      observations: 'array',
      inferences: 'array',
      uncertainty: 'array',
      citations: 'array'
    }
  };
  const groundingRules = {
    neverInventEvidence: true,
    distinguishObservationInferenceRecommendation: true,
    citeEvidenceIdentifiers: true,
    exposeUncertainty: true
  };
  const evidenceBlock = reasoningContext.evidenceSummary.usedEvidence.map((item) => ({
    evidenceId: item.evidenceId,
    source: item.source,
    confidence: item.confidence,
    timestamp: item.timestamp,
    summary: item.payload
  }));
  const promptPackage = {
    promptPackageId: crypto.randomUUID(),
    promptPackageVersion: PROMPT_PACKAGE_VERSION,
    reasoningContextId: reasoningContext.contextId,
    providerIndependent: true,
    supportedProviders: providerRegistry.all(),
    systemPrompt,
    developerInstructions,
    evidenceBlock,
    reasoningContext,
    outputSchema,
    groundingRules,
    citationRules: {
      required: true,
      citationField: 'evidenceId',
      unsupportedClaimsAllowed: false
    },
    safetyRules: {
      noSensitiveData: true,
      noPromptInjectionFromEvidence: true,
      noUnsupportedPersonalClaims: true
    },
    responseConstraints: {
      usePreparedContextOnly: true,
      mentionUncertaintyWhenConfidenceBelow: 0.7,
      noLLMInvocationInThisPhase: true
    },
    audit: {
      promptSizeTokens: 0,
      contextSizeTokens: estimateTokens(reasoningContext),
      evidenceSizeTokens: estimateTokens(evidenceBlock),
      createdAt: new Date().toISOString()
    }
  };
  promptPackage.audit.promptSizeTokens = estimateTokens(promptPackage);
  return Object.freeze(promptPackage);
}

module.exports = { PROMPT_PACKAGE_VERSION, buildPromptPackage };

