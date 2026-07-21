const userService = require('../services/userService');

async function getProfile(req, res) {
  res.json(await userService.getProfile(req.user.id));
}

async function updateProfile(req, res) {
  res.json(await userService.updateProfile(req.user.id, req.body));
}

async function searchColleges(req, res) {
  res.json(await userService.searchColleges(req.query.search || ''));
}

async function uploadAvatar(req, res) {
  res.json(await userService.uploadAvatar(req.user.id, req.body.imageData));
}

async function deleteAvatar(req, res) {
  res.json(await userService.deleteAvatar(req.user.id));
}

module.exports = {
  getProfile,
  updateProfile,
  searchColleges,
  uploadAvatar,
  deleteAvatar
};
