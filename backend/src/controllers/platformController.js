const platformService = require('../services/platformService');
const syncService = require('../services/syncService');

async function connect(req, res) {
  const account = await platformService.connect(req.user.id, req.body);

  res.status(201).json(account);
}

async function disconnect(req, res) {
  await platformService.disconnect(req.user.id, req.body.platform);
  res.status(204).send();
}

async function list(req, res) {
  res.json({ accounts: await platformService.list(req.user.id) });
}

async function syncAccounts(req, res) {
  const result = await syncService.syncUserPlatforms(req.user.id);
  res.json(result);
}

module.exports = { connect, disconnect, list, syncAccounts };
