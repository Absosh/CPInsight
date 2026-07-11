const userService = require('../services/userService');

async function getProfile(req, res) {
  res.json(await userService.getProfile(req.user.id));
}

async function updateProfile(req, res) {
  res.json(await userService.updateProfile(req.user.id, req.body));
}

module.exports = { getProfile, updateProfile };
