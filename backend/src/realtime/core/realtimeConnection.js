const crypto = require('crypto');
const { REALTIME_MESSAGE_TYPES } = require('../protocol/messageTypes');
const { serializeMessage } = require('../protocol/serializer');
const { decodeFrames, encodeFrame } = require('./websocketFraming');

class RealtimeConnection {
  constructor({
    socket,
    user,
    registry,
    authorizer,
    metrics,
    maxQueueSize = 1000,
    idleTimeoutMs = 60000,
    logger = null
  }) {
    this.id = crypto.randomUUID();
    this.socket = socket;
    this.user = user;
    this.registry = registry;
    this.authorizer = authorizer;
    this.metrics = metrics;
    this.maxQueueSize = maxQueueSize;
    this.idleTimeoutMs = idleTimeoutMs;
    this.logger = logger;
    this.subscriptions = new Set();
    this.queue = [];
    this.sequenceNumber = 0;
    this.lastSeenSequenceNumber = 0;
    this.lastActivityAt = Date.now();
    this.closed = false;
    this.buffer = Buffer.alloc(0);
  }

  initialize() {
    this.registry.add(this);
    this.sendControl(REALTIME_MESSAGE_TYPES.WELCOME, {
      connectionId: this.id,
      userId: this.user.id,
      heartbeatIntervalMs: Math.floor(this.idleTimeoutMs / 2)
    });

    this.socket.on('data', (chunk) => this.onData(chunk));
    this.socket.on('close', () => this.close());
    this.socket.on('error', () => this.close());
  }

  onData(chunk) {
    this.lastActivityAt = Date.now();
    const decoded = decodeFrames(Buffer.concat([this.buffer, chunk]));
    this.buffer = decoded.remaining;
    for (const frame of decoded.frames) {
      if (frame.opcode === 0x8) {
        this.close();
      } else if (frame.opcode === 0x9) {
        this.socket.write(encodeFrame(frame.payload, 0xA));
      } else if (frame.opcode === 0x1) {
        this.handleText(frame.payload.toString('utf8'));
      }
    }
  }

  handleText(text) {
    let message;
    try {
      message = JSON.parse(text);
    } catch {
      this.sendError('MALFORMED_MESSAGE', 'Message must be valid JSON');
      return;
    }

    if (message.messageType === REALTIME_MESSAGE_TYPES.SUBSCRIBE) {
      this.subscribe(message.payload?.channel);
    } else if (message.messageType === REALTIME_MESSAGE_TYPES.UNSUBSCRIBE) {
      this.unsubscribe(message.payload?.channel);
    } else if (message.messageType === REALTIME_MESSAGE_TYPES.PING) {
      this.sendControl(REALTIME_MESSAGE_TYPES.PONG, {});
    } else if (message.messageType === REALTIME_MESSAGE_TYPES.RESUME) {
      this.resume(message.payload?.lastSequenceNumber || 0);
    } else if (message.messageType === REALTIME_MESSAGE_TYPES.REPLAY_REQUEST) {
      this.sendControl(REALTIME_MESSAGE_TYPES.REPLAY_ACK, {
        accepted: true,
        lastSequenceNumber: this.lastSeenSequenceNumber
      });
    } else {
      this.sendError('UNSUPPORTED_MESSAGE_TYPE', 'Unsupported realtime message type');
    }
  }

  subscribe(channel) {
    if (!this.authorizer.canSubscribe(this.user, channel)) {
      this.sendError('UNAUTHORIZED_CHANNEL', 'Subscription is not authorized');
      return false;
    }
    this.registry.subscribe(this, channel);
    this.sendControl(REALTIME_MESSAGE_TYPES.SUBSCRIBED, { channel });
    return true;
  }

  unsubscribe(channel) {
    this.registry.unsubscribe(this, channel);
    this.sendControl(REALTIME_MESSAGE_TYPES.UNSUBSCRIBED, { channel });
  }

  resume(lastSequenceNumber) {
    this.lastSeenSequenceNumber = Number(lastSequenceNumber) || 0;
    this.metrics.reconnectCount += 1;
    this.sendControl(REALTIME_MESSAGE_TYPES.RESUME_ACK, {
      connectionId: this.id,
      lastSequenceNumber: this.lastSeenSequenceNumber
    });
  }

  sendControl(messageType, payload) {
    return this.sendSerialized(serializeMessage({
      messageType,
      payload,
      metadata: { connectionId: this.id, userId: this.user.id },
      sequenceNumber: this.sequenceNumber
    }));
  }

  sendError(code, message) {
    return this.sendControl(REALTIME_MESSAGE_TYPES.ERROR, { code, message });
  }

  sendEvent(serializedMessage) {
    return this.sendSerialized(serializedMessage);
  }

  sendSerialized(serializedMessage) {
    if (this.closed) return false;
    if (this.queue.length >= this.maxQueueSize) {
      this.metrics.droppedMessages += 1;
      this.close(1009, 'Outbound queue exceeded');
      return false;
    }
    this.queue.push(serializedMessage);
    this.flush();
    return true;
  }

  flush() {
    while (this.queue.length && !this.closed) {
      const message = this.queue.shift();
      const frame = encodeFrame(message);
      this.socket.write(frame);
      this.sequenceNumber += 1;
      this.metrics.messagesSent += 1;
      this.metrics.bytesSent += frame.length;
    }
  }

  heartbeat(now = Date.now()) {
    if (this.closed) return;
    if (now - this.lastActivityAt > this.idleTimeoutMs) {
      this.metrics.heartbeatFailures += 1;
      this.close(1001, 'Idle timeout');
      return;
    }
    this.socket.write(encodeFrame('', 0x9));
  }

  close(_code = 1000, _reason = 'Normal closure') {
    if (this.closed) return;
    this.closed = true;
    this.registry.remove(this);
    try {
      this.socket.end();
    } catch (error) {
      this.logger?.warn?.('Realtime socket close failed', { message: error.message });
    }
  }
}

module.exports = { RealtimeConnection };
