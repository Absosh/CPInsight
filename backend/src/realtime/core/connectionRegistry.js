class ConnectionRegistry {
  constructor({ metrics }) {
    this.metrics = metrics;
    this.connections = new Map();
    this.users = new Map();
    this.channels = new Map();
  }

  add(connection) {
    this.connections.set(connection.id, connection);
    if (!this.users.has(connection.user.id)) this.users.set(connection.user.id, new Set());
    this.users.get(connection.user.id).add(connection.id);
    this.metrics.activeConnections = this.connections.size;
    this.metrics.authenticatedUsers = new Set(this.users.keys());
  }

  remove(connection) {
    this.connections.delete(connection.id);
    const userConnections = this.users.get(connection.user.id);
    userConnections?.delete(connection.id);
    if (userConnections && userConnections.size === 0) this.users.delete(connection.user.id);
    for (const channel of connection.subscriptions) {
      this.channels.get(channel)?.delete(connection.id);
      if (this.channels.get(channel)?.size === 0) this.channels.delete(channel);
    }
    this.metrics.activeConnections = this.connections.size;
    this.metrics.authenticatedUsers = new Set(this.users.keys());
    this.metrics.subscriptionCount = [...this.channels.values()].reduce((sum, set) => sum + set.size, 0);
  }

  subscribe(connection, channel) {
    if (!this.channels.has(channel)) this.channels.set(channel, new Set());
    this.channels.get(channel).add(connection.id);
    connection.subscriptions.add(channel);
    this.metrics.subscriptionCount = [...this.channels.values()].reduce((sum, set) => sum + set.size, 0);
  }

  unsubscribe(connection, channel) {
    this.channels.get(channel)?.delete(connection.id);
    if (this.channels.get(channel)?.size === 0) this.channels.delete(channel);
    connection.subscriptions.delete(channel);
    this.metrics.subscriptionCount = [...this.channels.values()].reduce((sum, set) => sum + set.size, 0);
  }

  connectionsForChannels(channels) {
    const ids = new Set();
    for (const channel of channels) {
      for (const id of this.channels.get(channel) || []) ids.add(id);
    }
    return [...ids].map((id) => this.connections.get(id)).filter(Boolean);
  }
}

module.exports = { ConnectionRegistry };
