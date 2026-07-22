class RealtimeMetrics {
  constructor(startedAt = Date.now()) {
    this.startedAt = startedAt;
    this.activeConnections = 0;
    this.authenticatedUsers = new Set();
    this.messagesSent = 0;
    this.bytesSent = 0;
    this.droppedMessages = 0;
    this.reconnectCount = 0;
    this.subscriptionCount = 0;
    this.heartbeatFailures = 0;
    this.latencySamples = [];
  }

  recordLatency(ms) {
    this.latencySamples.push(ms);
    if (this.latencySamples.length > 1000) this.latencySamples.shift();
  }

  snapshot() {
    const latency = this.latencySamples.length
      ? Math.round(this.latencySamples.reduce((sum, value) => sum + value, 0) / this.latencySamples.length)
      : 0;
    return Object.freeze({
      activeConnections: this.activeConnections,
      authenticatedUsers: this.authenticatedUsers.size,
      messagesSent: this.messagesSent,
      bytesSent: this.bytesSent,
      droppedMessages: this.droppedMessages,
      reconnectCount: this.reconnectCount,
      subscriptionCount: this.subscriptionCount,
      gatewayUptimeMs: Date.now() - this.startedAt,
      heartbeatFailures: this.heartbeatFailures,
      averageLatencyMs: latency
    });
  }
}

module.exports = { RealtimeMetrics };
