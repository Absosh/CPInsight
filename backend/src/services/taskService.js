const { AITaskOrchestrator } = require('../ai/tasks/taskOrchestrator');
const repository = require('../repositories/taskRepository');

class TaskService {
  constructor({ orchestrator = new AITaskOrchestrator(), repo = repository } = {}) {
    this.orchestrator = orchestrator;
    this.repo = repo;
  }

  route({ question, intent, reasoningContext }) {
    return {
      routedTasks: this.orchestrator.route({ question, intent, reasoningContext }).map((item) => ({
        taskType: item.task.taskType,
        priority: item.priority,
        reason: item.reason
      }))
    };
  }

  async plan(userId, input) {
    try {
      const plan = await this.orchestrator.plan(input);
      await this.repo.insertExecutionPlan(userId, plan);
      await this.repo.insertExecutionMetrics(userId, plan);
      return plan;
    } catch (error) {
      await this.repo.insertExecutionMetrics(userId, {}, 'failed', error.message).catch(() => {});
      throw error;
    }
  }

  tasks() {
    return this.orchestrator.tasks();
  }

  strategies() {
    return this.orchestrator.strategies();
  }

  schemas() {
    return this.orchestrator.schemas();
  }

  policies() {
    return this.orchestrator.policies();
  }

  getExecutionPlan(userId, executionPlanId) {
    return this.repo.getExecutionPlan(userId, executionPlanId);
  }
}

module.exports = new TaskService();
module.exports.TaskService = TaskService;

