const pool = require('../database/pool');

function rowToConversation(row, messages = undefined) {
  return {
    sessionId: row.id,
    conversationId: row.id,
    title: row.title,
    summary: row.summary,
    preview: row.preview,
    status: row.status,
    pinned: row.pinned,
    archivedAt: row.archived_at,
    deletedAt: row.deleted_at,
    metadata: row.metadata || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(messages ? { messages } : {})
  };
}

function rowToMessage(row) {
  return {
    messageId: row.client_message_id || row.id,
    persistedMessageId: row.id,
    role: row.role,
    content: row.content,
    status: row.status,
    sections: row.sections || {},
    metadata: row.metadata || {},
    error: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function json(value) {
  return JSON.stringify(value || {});
}

async function list(userId, { limit = 50, offset = 0, includeArchived = false } = {}, db = pool) {
  const result = await db.query(
    `SELECT *
       FROM ai_conversations
      WHERE user_id = $1
        AND deleted_at IS NULL
        AND ($2::boolean OR status <> 'archived')
      ORDER BY pinned DESC, updated_at DESC
      LIMIT $3 OFFSET $4`,
    [userId, includeArchived, Math.max(1, Math.min(100, Number(limit) || 50)), Math.max(0, Number(offset) || 0)]
  );
  return result.rows.map((row) => rowToConversation(row));
}

async function get(userId, conversationId, db = pool) {
  const conversation = await db.query(
    `SELECT * FROM ai_conversations
      WHERE user_id = $1 AND id = $2 AND deleted_at IS NULL`,
    [userId, conversationId]
  );
  if (!conversation.rowCount) return null;

  const messages = await db.query(
    `SELECT * FROM ai_conversation_messages
      WHERE user_id = $1 AND conversation_id = $2
      ORDER BY message_order ASC, created_at ASC`,
    [userId, conversationId]
  );
  return rowToConversation(conversation.rows[0], messages.rows.map(rowToMessage));
}

async function create(userId, { title = 'New chat', summary = '', metadata = {} } = {}, db = pool) {
  const result = await db.query(
    `INSERT INTO ai_conversations (user_id, title, summary, metadata)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [userId, String(title || 'New chat').slice(0, 180), String(summary || ''), json(metadata)]
  );
  return rowToConversation(result.rows[0], []);
}

async function update(userId, conversationId, patch = {}, db = pool) {
  const allowed = [];
  const values = [userId, conversationId];
  const push = (column, value) => {
    values.push(value);
    allowed.push(`${column} = $${values.length}`);
  };
  if (patch.title !== undefined) push('title', String(patch.title || 'New chat').slice(0, 180));
  if (patch.summary !== undefined) push('summary', String(patch.summary || ''));
  if (patch.preview !== undefined) push('preview', String(patch.preview || '').slice(0, 240));
  if (patch.status !== undefined) push('status', patch.status);
  if (patch.pinned !== undefined) push('pinned', Boolean(patch.pinned));
  if (patch.metadata !== undefined) push('metadata', json(patch.metadata));
  if (patch.archivedAt !== undefined) push('archived_at', patch.archivedAt);
  if (patch.deletedAt !== undefined) push('deleted_at', patch.deletedAt);
  if (!allowed.length) return get(userId, conversationId, db);
  allowed.push('updated_at = NOW()');

  const result = await db.query(
    `UPDATE ai_conversations
        SET ${allowed.join(', ')}
      WHERE user_id = $1 AND id = $2 AND deleted_at IS NULL
      RETURNING *`,
    values
  );
  return result.rowCount ? rowToConversation(result.rows[0]) : null;
}

async function appendMessageInTransaction(userId, conversationId, message, db) {
  const conversation = await db.query(
    `SELECT id
       FROM ai_conversations
      WHERE user_id = $1 AND id = $2 AND deleted_at IS NULL
      FOR UPDATE`,
    [userId, conversationId]
  );
  if (!conversation.rowCount) throw new Error('Conversation not found');

  const orderResult = await db.query(
    `SELECT COALESCE(MAX(message_order), -1) + 1 AS next_order
       FROM ai_conversation_messages
      WHERE conversation_id = $1`,
    [conversationId]
  );
  const messageOrder = Number.isFinite(Number(message.messageOrder))
    ? Number(message.messageOrder)
    : Number(orderResult.rows[0].next_order || 0);
  const clientMessageId = message.messageId || message.clientMessageId || null;
  const result = await db.query(
    `INSERT INTO ai_conversation_messages
       (conversation_id, user_id, client_message_id, role, content, status,
        message_order, sections, metadata, error_message)
     VALUES ($1, $2, $3, $4, $5, $6,
             $7, $8, $9, $10)
     ON CONFLICT (conversation_id, client_message_id)
     DO UPDATE SET
       content = EXCLUDED.content,
       status = EXCLUDED.status,
       sections = EXCLUDED.sections,
       metadata = EXCLUDED.metadata,
       error_message = EXCLUDED.error_message,
       updated_at = NOW()
     RETURNING *`,
    [
      conversationId,
      userId,
      clientMessageId,
      message.role || 'user',
      message.content || '',
      message.status || 'completed',
      messageOrder,
      json(message.sections),
      json(message.metadata),
      message.error || message.errorMessage || null
    ]
  );

  await update(userId, conversationId, {
    preview: message.content || message.metadata?.question || '',
    summary: message.role === 'user' ? message.content : undefined
  }, db);
  return rowToMessage(result.rows[0]);
}

async function appendMessage(userId, conversationId, message = {}, db = pool) {
  if (typeof db.connect !== 'function') {
    return appendMessageInTransaction(userId, conversationId, message, db);
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const persisted = await appendMessageInTransaction(userId, conversationId, message, client);
    await client.query('COMMIT');
    return persisted;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function softDelete(userId, conversationId, db = pool) {
  return update(userId, conversationId, {
    status: 'deleted',
    deletedAt: new Date().toISOString()
  }, db);
}

async function search(userId, query, { limit = 20 } = {}, db = pool) {
  const normalized = String(query || '').trim();
  if (!normalized) return list(userId, { limit }, db);
  const result = await db.query(
    `SELECT DISTINCT c.*
       FROM ai_conversations c
       LEFT JOIN ai_conversation_messages m ON m.conversation_id = c.id
      WHERE c.user_id = $1
        AND c.deleted_at IS NULL
        AND (
          c.title ILIKE $2 OR c.summary ILIKE $2 OR c.preview ILIKE $2
          OR m.content ILIKE $2
          OR m.sections::text ILIKE $2
          OR m.metadata::text ILIKE $2
        )
      ORDER BY c.pinned DESC, c.updated_at DESC
      LIMIT $3`,
    [userId, `%${normalized}%`, Math.max(1, Math.min(50, Number(limit) || 20))]
  );
  return result.rows.map((row) => rowToConversation(row));
}

module.exports = {
  list,
  get,
  create,
  update,
  appendMessage,
  softDelete,
  search
};
