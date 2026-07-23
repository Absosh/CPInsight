const SCHEMAS = Object.freeze({
  diagnostic: {
    schemaVersion: 1,
    schema: {
      problem: 'string',
      causes: 'array',
      evidence: 'array',
      confidence: 'number',
      recommendations: 'array'
    }
  },
  reflection: {
    schemaVersion: 1,
    schema: {
      summary: 'string',
      successes: 'array',
      mistakes: 'array',
      lessons: 'array',
      nextActions: 'array'
    }
  },
  comparison: {
    schemaVersion: 1,
    schema: {
      contestA: 'object',
      contestB: 'object',
      differences: 'array',
      trends: 'array',
      evidence: 'array'
    }
  },
  roadmap: {
    schemaVersion: 1,
    schema: {
      goal: 'string',
      currentState: 'object',
      milestones: 'array',
      practicePlan: 'array',
      confidence: 'number'
    }
  },
  explanation: {
    schemaVersion: 1,
    schema: {
      claim: 'string',
      observations: 'array',
      inferences: 'array',
      evidence: 'array',
      uncertainty: 'array'
    }
  },
  summary: {
    schemaVersion: 1,
    schema: {
      summary: 'string',
      keyPoints: 'array',
      evidence: 'array',
      uncertainty: 'array'
    }
  }
});

class OutputSchemaRegistry {
  constructor(schemas = SCHEMAS) {
    this.schemas = new Map(Object.entries(schemas));
  }

  get(name) {
    return this.schemas.get(name) || this.schemas.get('summary');
  }

  all() {
    return [...this.schemas.entries()].map(([name, value]) => ({ name, ...value }));
  }
}

module.exports = { OutputSchemaRegistry, SCHEMAS };

