const { PipelineStage } = require('../stage');
const { TelemetryPipelineError } = require('../errors');

class AuthenticationContextStage extends PipelineStage {
  constructor() {
    super('authentication-context');
  }

  async process(context) {
    if (!context.userId) {
      throw new TelemetryPipelineError('Telemetry processing requires authenticated user context', {
        code: 'MISSING_AUTH_CONTEXT',
        status: 401,
        category: 'validation'
      });
    }
    return {
      ...context,
      auth: {
        userId: context.userId
      }
    };
  }
}

module.exports = { AuthenticationContextStage };
