WITH ordered_messages AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY conversation_id
           ORDER BY message_order ASC, created_at ASC, id ASC
         ) - 1 AS normalized_order
    FROM ai_conversation_messages
)
UPDATE ai_conversation_messages AS messages
   SET message_order = ordered_messages.normalized_order
  FROM ordered_messages
 WHERE messages.id = ordered_messages.id
   AND messages.message_order <> ordered_messages.normalized_order;

CREATE UNIQUE INDEX IF NOT EXISTS ai_conversation_messages_unique_order_idx
  ON ai_conversation_messages(conversation_id, message_order);
