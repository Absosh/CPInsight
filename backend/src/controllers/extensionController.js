const extensionUploadService = require('../services/extensionUploadService');

async function uploadLeetCodeCollection(req, res) {
  const result = await extensionUploadService.persistLeetCodeCollection(req.user.id, req.body, req.headers);
  res.status(result.uploaded ? 201 : 200).json(result);
}

module.exports = { uploadLeetCodeCollection };
