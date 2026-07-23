export function createLiveTelemetryClient({ url, token, userId, contestId, WebSocketImpl = globalThis.WebSocket } = {}) {
  let socket = null;
  const listeners = new Set();

  function emit(event) {
    listeners.forEach((listener) => listener(event));
  }

  function subscribe(channel) {
    socket?.send(JSON.stringify({ messageType: 'SUBSCRIBE', payload: { channel } }));
  }

  return Object.freeze({
    connect() {
      const separator = url.includes('?') ? '&' : '?';
      socket = new WebSocketImpl(`${url}${separator}token=${encodeURIComponent(token)}`);
      socket.addEventListener('open', () => {
        if (userId) subscribe(`telemetry:${userId}`);
        if (contestId) subscribe(`contest:${contestId}`);
        emit({ type: 'telemetry.connected' });
      });
      socket.addEventListener('message', (message) => {
        const payload = JSON.parse(message.data);
        emit({ type: payload.metadata?.domainEventType || payload.messageType, payload });
      });
      socket.addEventListener('close', () => emit({ type: 'telemetry.disconnected' }));
      socket.addEventListener('error', () => emit({ type: 'telemetry.disconnected' }));
      return socket;
    },
    onEvent(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    disconnect() {
      socket?.close();
    }
  });
}
