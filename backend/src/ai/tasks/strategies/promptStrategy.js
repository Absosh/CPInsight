class PromptStrategy {
  constructor({ id, strategyVersion = 1, supportedTasks, focus, instructionProfile }) {
    this.id = id;
    this.strategyVersion = strategyVersion;
    this.supportedTasks = new Set(supportedTasks);
    this.focus = focus;
    this.instructionProfile = instructionProfile;
  }

  supports(taskType) {
    return this.supportedTasks.has(taskType);
  }

  version() {
    return this.strategyVersion;
  }

  build(task, promptPackage) {
    return Object.freeze({
      strategyId: this.id,
      strategyVersion: this.strategyVersion,
      focus: this.focus,
      instructionProfile: this.instructionProfile,
      basePromptPackageId: promptPackage.promptPackageId,
      taskType: task.taskType
    });
  }
}

module.exports = { PromptStrategy };

