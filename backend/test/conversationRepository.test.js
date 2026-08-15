const { after, test } = require('node:test');
const assert = require('node:assert/strict');

const pool = require('../src/database/pool');
const repository = require('../src/repositories/conversationRepository');

after(async () => {
  await pool.end();
});

test('message append locks the conversation and commits ordering atomically', async () => {
  const calls = [];
  const messageRow = {
    id: 'persisted-message',
    client_message_id: 'client-message',
    role: 'user',
    content: 'How should I practice DP?',
    status: 'completed',
    message_order: 4,
    sections: {},
    metadata: {},
    error_message: null,
    created_at: new Date('2026-08-15T00:00:00.000Z'),
    updated_at: new Date('2026-08-15T00:00:00.000Z')
  };
  const conversationRow = {
    id: 'conversation',
    title: 'New chat',
    summary: '',
    preview: '',
    status: 'active',
    pinned: false,
    archived_at: null,
    deleted_at: null,
    metadata: {},
    created_at: new Date('2026-08-15T00:00:00.000Z'),
    updated_at: new Date('2026-08-15T00:00:00.000Z')
  };
  const client = {
    async query(sql) {
      const normalized = String(sql).replace(/\s+/g, ' ').trim();
      calls.push(normalized);
      if (normalized === 'BEGIN' || normalized === 'COMMIT' || normalized === 'ROLLBACK') return {};
      if (normalized.includes('FROM ai_conversations') && normalized.includes('FOR UPDATE')) {
        return { rowCount: 1, rows: [{ id: 'conversation' }] };
      }
      if (normalized.includes('MAX(message_order)')) return { rows: [{ next_order: 4 }] };
      if (normalized.startsWith('INSERT INTO ai_conversation_messages')) return { rows: [messageRow] };
      if (normalized.startsWith('UPDATE ai_conversations')) return { rowCount: 1, rows: [conversationRow] };
      throw new Error(`Unexpected query: ${normalized}`);
    },
    release() {
      calls.push('RELEASE');
    }
  };
  const db = { connect: async () => client };

  const result = await repository.appendMessage('user', 'conversation', {
    messageId: 'client-message',
    role: 'user',
    content: 'How should I practice DP?'
  }, db);

  assert.equal(result.messageId, 'client-message');
  assert.deepEqual(
    calls.map((query) => {
      if (query.includes('FOR UPDATE')) return 'LOCK';
      if (query.includes('MAX(message_order)')) return 'ORDER';
      if (query.startsWith('INSERT INTO ai_conversation_messages')) return 'INSERT';
      if (query.startsWith('UPDATE ai_conversations')) return 'UPDATE';
      return query;
    }),
    ['BEGIN', 'LOCK', 'ORDER', 'INSERT', 'UPDATE', 'COMMIT', 'RELEASE']
  );
});
