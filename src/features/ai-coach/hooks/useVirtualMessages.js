import { useMemo } from 'react';

export function useVirtualMessages(messages = [], { limit = 80 } = {}) {
  return useMemo(() => {
    if (messages.length <= limit) return messages;
    return messages.slice(messages.length - limit);
  }, [messages, limit]);
}
