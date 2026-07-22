const { RedisStreamConsumer } = require('../../redis/events/consumer');
const { STREAMS } = require('../../redis/events/streamTopology');

class RedisGatewayConsumer {
  constructor({
    connectionManager,
    gateway,
    group = 'websocket-gateway',
    consumerName,
    streams = Object.values(STREAMS),
    batchSize = 100,
    blockMs = 5000,
    idleMs = 30000,
    logger = null
  }) {
    this.gateway = gateway;
    this.consumers = streams.map((stream) => new RedisStreamConsumer({
      connectionManager,
      stream,
      group,
      consumerName,
      batchSize,
      blockMs,
      idleMs,
      logger
    }));
  }

  async start() {
    await Promise.all(this.consumers.map((consumer) => consumer.initialize()));
    this.running = true;
    this.loops = this.consumers.map((consumer) => consumer.consume({
      consume: async ({ event }) => {
        this.gateway.routeDomainEvent(event);
      }
    }));
  }

  async consumeOnce() {
    const results = await Promise.all(this.consumers.map((consumer) => consumer.consumeOnce({
      consume: async ({ event }) => {
        this.gateway.routeDomainEvent(event);
      }
    })));
    return results.flat();
  }

  async shutdown() {
    await Promise.all(this.consumers.map((consumer) => consumer.shutdown()));
    await Promise.allSettled(this.loops || []);
  }

  snapshotMetrics() {
    return Object.freeze({
      consumers: this.consumers.map((consumer) => consumer.snapshotMetrics())
    });
  }
}

module.exports = { RedisGatewayConsumer };
