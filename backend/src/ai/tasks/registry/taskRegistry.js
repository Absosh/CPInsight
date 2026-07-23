class AITaskRegistry {
  constructor() {
    this.tasks = new Map();
  }

  register(task) {
    if (!task || typeof task.supports !== 'function' || typeof task.reasoningMode !== 'function') {
      throw new Error('Invalid AI task');
    }
    if (this.tasks.has(task.taskType)) throw new Error(`Duplicate AI task: ${task.taskType}`);
    this.tasks.set(task.taskType, task);
    return this;
  }

  all() {
    return [...this.tasks.values()];
  }

  get(taskType) {
    return this.tasks.get(taskType) || null;
  }

  supporting(context) {
    return this.all().filter((task) => task.supports(context));
  }
}

module.exports = { AITaskRegistry };

