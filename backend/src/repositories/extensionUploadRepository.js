const pool = require('../database/pool');

async function findLeetCodeUploadBySessionId(sessionId, db = pool) {
  const result = await db.query(
    'SELECT * FROM leetcode_extension_uploads WHERE session_id = $1',
    [sessionId]
  );
  return result.rows[0] || null;
}

async function insertLeetCodeUpload(record, db = pool) {
  const result = await db.query(
    `INSERT INTO leetcode_extension_uploads
       (user_id, platform_account_id, session_id, payload_hash, collector_version,
        provider_version, status, request_metadata, completed_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
     RETURNING *`,
    [
      record.userId,
      record.platformAccountId,
      record.sessionId,
      record.payloadHash,
      record.collectorVersion,
      record.providerVersion || null,
      record.status || 'completed',
      JSON.stringify(record.requestMetadata || {})
    ]
  );
  return result.rows[0];
}

module.exports = { findLeetCodeUploadBySessionId, insertLeetCodeUpload };
