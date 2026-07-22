const crypto = require('crypto');
const { WebSocketAuthenticator } = require('../auth/websocketAuthenticator');
const { ChannelAuthorizer } = require('../channels/channelAuthorizer');
const { ChannelRouter } = require('../channels/channelRouter');
const { RealtimeMetrics } = require('../core/metrics');
const { ConnectionRegistry } = require('../core/connectionRegistry');
const { RealtimeConnection } = require('../core/realtimeConnection');
const { acceptKey } = require('../core/websocketFraming');
const { domainEventToMessage } = require('../protocol/serializer');

class RealtimeGateway {
  constructor({
    path = '/realtime',
    authenticator = new WebSocketAuthenticator(),
    authorizer = new ChannelAuthorizer(),
    router = new ChannelRouter(),
    maxQueueSize = 1000,
    idleTimeoutMs = 60000,
    logger = null
  } = {}) {
    this.path = path;
    this.authenticator = authenticator;
    this.authorizer = authorizer;
    this.router = router;
    this.maxQueueSize = maxQueueSize;
    this.idleTimeoutMs = idleTimeoutMs;
    this.logger = logger;
    this.metrics = new RealtimeMetrics();
    this.registry = new ConnectionRegistry({ metrics: this.metrics });
    this.heartbeatTimer = null;
    this.sequenceNumber = 0;
  }

  attach(server) {
    server.on('upgrade', (request, socket) => {
      this.handleUpgrade(request, socket).catch((error) => {
        this.reject(socket, 401, error.message);
      });
    });
    this.heartbeatTimer = setInterval(() => this.heartbeat(), Math.floor(this.idleTimeoutMs / 2));
  }

  async handleUpgrade(request, socket) {
    const url = new URL(request.url, 'http://localhost');
    if (url.pathname !== this.path) return this.reject(socket, 404, 'Realtime endpoint not found');
    if (request.headers.upgrade?.toLowerCase() !== 'websocket') return this.reject(socket, 400, 'Upgrade required');
    const key = request.headers['sec-websocket-key'];
    if (!key) return this.reject(socket, 400, 'Missing WebSocket key');

    const user = await this.authenticator.authenticate(request.url, request.headers);
    const responseHeaders = [
      'HTTP/1.1 101 Switching Protocols',
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Accept: ${acceptKey(key)}`,
      '\r\n'
    ];
    socket.write(responseHeaders.join('\r\n'));
    const connection = new RealtimeConnection({
      socket,
      user,
      registry: this.registry,
      authorizer: this.authorizer,
      metrics: this.metrics,
      maxQueueSize: this.maxQueueSize,
      idleTimeoutMs: this.idleTimeoutMs,
      logger: this.logger
    });
    connection.initialize();
    return connection;
  }

  reject(socket, status, message) {
    socket.write(`HTTP/1.1 ${status} ${message}\r\nConnection: close\r\n\r\n`);
    socket.destroy();
  }

  routeDomainEvent(event) {
    const startedAt = Date.now();
    this.sequenceNumber += 1;
    const channels = this.router.channelsForEvent(event);
    const message = domainEventToMessage(event, this.sequenceNumber);
    const recipients = this.registry.connectionsForChannels(channels);
    for (const connection of recipients) {
      connection.sendEvent(message);
    }
    this.metrics.recordLatency(Date.now() - startedAt);
    return {
      messageId: crypto.randomUUID(),
      channels,
      recipientCount: recipients.length,
      sequenceNumber: this.sequenceNumber
    };
  }

  heartbeat() {
    const now = Date.now();
    for (const connection of this.registry.connections.values()) {
      connection.heartbeat(now);
    }
  }

  async shutdown() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    for (const connection of [...this.registry.connections.values()]) {
      connection.close(1001, 'Gateway shutdown');
    }
  }

  snapshotMetrics() {
    return this.metrics.snapshot();
  }
}

module.exports = { RealtimeGateway };
