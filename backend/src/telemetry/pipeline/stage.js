class PipelineStage {
  constructor(name) {
    this.name = name;
  }

  async initialize() {}

  async process(context) {
    return context;
  }

  async flush() {}

  async shutdown() {}
}

module.exports = { PipelineStage };
