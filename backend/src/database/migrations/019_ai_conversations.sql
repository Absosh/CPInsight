CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(180) NOT NULL DEFAULT 'New chat',
  summary TEXT NOT NULL DEFAULT '',
  preview TEXT NOT NULL DEFAULT '',
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  pinned BOOLEAN NOT NULL DEFAULT false,
  archived_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ai_conversations_user_updated_idx
  ON ai_conversations(user_id, pinned DESC, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ai_conversations_user_status_idx
  ON ai_conversations(user_id, status)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS ai_conversation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_message_id VARCHAR(120),
  role VARCHAR(32) NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  status VARCHAR(32) NOT NULL DEFAULT 'completed',
  message_order INTEGER NOT NULL,
  sections JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (conversation_id, client_message_id)
);

CREATE INDEX IF NOT EXISTS ai_conversation_messages_conversation_order_idx
  ON ai_conversation_messages(conversation_id, message_order, created_at);

CREATE INDEX IF NOT EXISTS ai_conversation_messages_search_idx
  ON ai_conversation_messages USING GIN (to_tsvector('english', content));
