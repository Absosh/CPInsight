const conversationService = require('../services/conversationService');

async function list(req, res) {
  const conversations = await conversationService.list(req.user.id, req.query);
  res.json({ conversations });
}

async function get(req, res) {
  res.json(await conversationService.get(req.user.id, req.params.id));
}

async function create(req, res) {
  res.status(201).json(await conversationService.create(req.user.id, req.body));
}

async function addMessage(req, res) {
  res.status(201).json(await conversationService.addMessage(req.user.id, req.params.id, req.body));
}

async function update(req, res) {
  res.json(await conversationService.update(req.user.id, req.params.id, req.body));
}

async function remove(req, res) {
  res.json(await conversationService.delete(req.user.id, req.params.id));
}

async function archive(req, res) {
  res.json(await conversationService.archive(req.user.id, req.params.id));
}

async function pin(req, res) {
  const pinned = req.body?.pinned === undefined ? true : Boolean(req.body.pinned);
  res.json(await conversationService.pin(req.user.id, req.params.id, pinned));
}

async function rename(req, res) {
  res.json(await conversationService.rename(req.user.id, req.params.id, req.body?.title));
}

async function search(req, res) {
  const conversations = await conversationService.search(req.user.id, req.body);
  res.json({ conversations });
}

module.exports = {
  list,
  get,
  create,
  addMessage,
  update,
  remove,
  archive,
  pin,
  rename,
  search
};
