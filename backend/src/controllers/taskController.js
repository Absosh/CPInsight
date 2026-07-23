const taskService = require('../services/taskService');

function requirePlanningInput(req) {
  const { question, intent, reasoningContext, promptPackage } = req.body || {};
  if (!question || !reasoningContext) {
    const error = new Error('question and reasoningContext are required');
    error.status = 400;
    throw error;
  }
  return { question, intent: intent || {}, reasoningContext, promptPackage };
}

async function route(req, res) {
  const { question, intent, reasoningContext } = requirePlanningInput(req);
  res.json(taskService.route({ question, intent, reasoningContext }));
}

async function plan(req, res) {
  const input = requirePlanningInput(req);
  if (!input.promptPackage) {
    const error = new Error('promptPackage is required');
    error.status = 400;
    throw error;
  }
  res.status(202).json(await taskService.plan(req.user.id, input));
}

function tasks(_req, res) {
  res.json({ tasks: taskService.tasks() });
}

function strategies(_req, res) {
  res.json({ strategies: taskService.strategies() });
}

function schemas(_req, res) {
  res.json({ schemas: taskService.schemas() });
}

function policies(_req, res) {
  res.json(taskService.policies());
}

async function execution(req, res) {
  const row = await taskService.getExecutionPlan(req.user.id, req.params.id);
  if (!row) {
    res.status(404).json({ error: 'AI execution plan not found' });
    return;
  }
  res.json(row);
}

module.exports = { route, plan, tasks, strategies, schemas, policies, execution };

