function normalizeHandle(handle) {
  return String(handle || '').trim().toLowerCase();
}

module.exports = { normalizeHandle };
