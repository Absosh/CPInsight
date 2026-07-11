const authService = require('../services/authService');

function context(req) {
  return {
    userAgent: req.get('user-agent'),
    ip: req.ip
  };
}

async function register(req, res) {
  const result = await authService.register(req.body, context(req));
  res.status(201).json(result);
}

async function login(req, res) {
  const result = await authService.login(req.body, context(req));
  res.json(result);
}

async function refresh(req, res) {
  const result = await authService.refresh(req.body.refreshToken, context(req));
  res.json(result);
}

async function logout(req, res) {
  await authService.logout(req.body.refreshToken);
  res.status(204).send();
}

module.exports = { register, login, refresh, logout };
