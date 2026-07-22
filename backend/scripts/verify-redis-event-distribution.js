const assert = require('assert/strict');
const crypto = require('crypto');
const { createDomainEvent } = require('../src/domain-events/domainEvent');
const { RedisEventPublisher } = require('../src/redis/events/publisher');
const { RedisStreamConsumer } = require('../src/redis/events/consumer');
const { STREAMS } = require('../src/redis/events/streamTopology');

class FakeRedis {
  constructor() {
    this.status = 'ready';
    this.streams = new Map();
    this.groups = new Map();
    this.deadLetters = [];
  }

  async connect() {
    this.status = 'ready';
  }

  async ping() {
    return 'PONG';
  }

  xadd(stream, ...args) {
    const fields = args.slice(args.indexOf('*') + 1);
    const id = `${Date.now()}-${this.getStream(stream).length + 1}`;
    this.getStream(stream).push({ id, fields, delivered: new Map(), ackedGroups: new Set() });
    if (stream.endsWith('.dead-letter')) this.deadLetters.push({ stream, id, fields });
    return Promise.resolve(id);
  }

  pipeline() {
    const commands = [];
    return {
      xadd: (stream, ...args) => commands.push(['xadd', stream, args]),
      exec: async () => Promise.all(commands.map(async ([, stream, args]) => [null, await this.xadd(stream, ...args)]))
    };
  }

  async xgroup(command, stream, group) {
    if (command !== 'CREATE') throw new Error(`Unsupported xgroup command ${command}`);
    const key = `${stream}:${group}`;
    if (this.groups.has(key)) throw new Error('BUSYGROUP Consumer Group name already exists');
    this.groups.set(key, { stream, group });
  }

  async xreadgroup(_groupKeyword, group, consumer, _countKeyword, count, _blockKeyword, _blockMs, _streamsKeyword, stream) {
    const messages = this.getStream(stream)
      .filter((entry) => !entry.ackedGroups.has(group))
      .filter((entry) => !entry.delivered.has(group))
      .slice(0, count);
    if (!messages.length) return null;
    for (const entry of messages) {
      entry.delivered.set(group, {
        consumer,
        count: 1,
        idleSince: Date.now() - 60000
      });
    }
    return [[stream, messages.map((entry) => [entry.id, entry.fields])]];
  }

  async xautoclaim(stream, group, consumer, idleMs, _start, _countKeyword, count) {
    const messages = this.getStream(stream)
      .filter((entry) => !entry.ackedGroups.has(group))
      .filter((entry) => {
        const delivery = entry.delivered.get(group);
        return delivery && Date.now() - delivery.idleSince >= idleMs;
      })
      .slice(0, count);
    for (const entry of messages) {
      const delivery = entry.delivered.get(group);
      entry.delivered.set(group, {
        consumer,
        count: delivery.count + 1,
        idleSince: Date.now() - 60000
      });
    }
    return ['0-0', messages.map((entry) => [entry.id, entry.fields])];
  }

  async xack(stream, group, ...ids) {
    let count = 0;
    for (const entry of this.getStream(stream)) {
      if (ids.includes(entry.id) && !entry.ackedGroups.has(group)) {
        entry.ackedGroups.add(group);
        count += 1;
      }
    }
    return count;
  }

  async xpending(stream, group, start, _end, _count) {
    const entry = this.getStream(stream).find((item) => item.id === start);
    if (!entry) return [];
    const delivery = entry.delivered.get(group);
    if (!delivery || entry.ackedGroups.has(group)) return [];
    return [[entry.id, delivery.consumer, Date.now() - delivery.idleSince, delivery.count]];
  }

  getStream(stream) {
    if (!this.streams.has(stream)) this.streams.set(stream, []);
    return this.streams.get(stream);
  }
}

class FakeConnectionManager {
  constructor(redis) {
    this.redis = redis;
    this.health = { connected: true, lastHeartbeatAt: null };
  }

  async connect() {
    return this.redis;
  }

  async heartbeat() {
    await this.redis.ping();
    this.health.lastHeartbeatAt = new Date().toISOString();
    return this.health;
  }
}

function event(index, aggregateType = 'TelemetrySession') {
  return createDomainEvent({
    eventType: index % 2 === 0 ? 'ProblemOpened' : 'SessionStarted',
    occurredAt: new Date().toISOString(),
    aggregateType,
    aggregateId: `${aggregateType.toLowerCase()}-${index % 5}`,
    source: 'redis-verification',
    payload: { index },
    metadata: { verification: true },
    correlationId: crypto.randomUUID(),
    causationId: crypto.randomUUID()
  });
}

async function run() {
  const redis = new FakeRedis();
  const connectionManager = new FakeConnectionManager(redis);
  const publisher = new RedisEventPublisher({ connectionManager, maxStreamLength: 10000 });

  await connectionManager.heartbeat();
  const published = await publisher.publish(event(1));
  assert.equal(published.stream, STREAMS.TELEMETRY);
  await publisher.publishBatch([event(2), event(3, 'User'), event(4, 'Contest')]);
  assert.equal(redis.getStream(STREAMS.TELEMETRY).length, 2);
  assert.equal(redis.getStream(STREAMS.USER).length, 1);
  assert.equal(redis.getStream(STREAMS.CONTEST).length, 1);

  const consumed = [];
  const consumer = new RedisStreamConsumer({
    connectionManager,
    stream: STREAMS.TELEMETRY,
    group: 'verification-workers',
    consumerName: 'consumer-a',
    batchSize: 10,
    blockMs: 1,
    idleMs: 1,
    maxRetries: 2
  });
  await consumer.initialize();
  const firstRead = await consumer.consumeOnce({
    consume: async ({ event: domainEvent }) => consumed.push(domainEvent.eventId)
  });
  assert.equal(firstRead.length, 2);
  assert.equal(consumer.snapshotMetrics().acknowledgedEvents, 2);

  await publisher.publish(event(5));
  const failingConsumer = new RedisStreamConsumer({
    connectionManager,
    stream: STREAMS.TELEMETRY,
    group: 'failing-workers',
    consumerName: 'consumer-b',
    batchSize: 10,
    blockMs: 1,
    idleMs: 1,
    maxRetries: 2
  });
  await failingConsumer.initialize();
  await failingConsumer.consumeOnce({
    consume: async () => {
      throw new Error('simulated consumer crash');
    }
  });
  await failingConsumer.recoverPending({
    consume: async () => {
      throw new Error('simulated consumer crash');
    }
  });
  assert.equal(redis.deadLetters.length, 3);
  assert.equal(failingConsumer.snapshotMetrics().pendingRecovered, 3);

  const duplicateConsumer = new RedisStreamConsumer({
    connectionManager,
    stream: STREAMS.TELEMETRY,
    group: 'verification-workers',
    consumerName: 'consumer-c',
    batchSize: 10,
    blockMs: 1
  });
  await duplicateConsumer.initialize();
  const duplicateRead = await duplicateConsumer.consumeOnce({
    consume: async ({ event: domainEvent }) => consumed.push(domainEvent.eventId)
  });
  assert.equal(duplicateRead.length, 1);

  const backlogEvents = Array.from({ length: 1000 }, (_, index) => event(index + 100));
  await publisher.publishBatch(backlogEvents);
  assert.equal(redis.getStream(STREAMS.TELEMETRY).length, 1003);

  console.log(JSON.stringify({
    verdict: 'PASS',
    telemetryStreamEvents: redis.getStream(STREAMS.TELEMETRY).length,
    userStreamEvents: redis.getStream(STREAMS.USER).length,
    contestStreamEvents: redis.getStream(STREAMS.CONTEST).length,
    consumedEvents: consumed.length,
    pendingRecovered: failingConsumer.snapshotMetrics().pendingRecovered,
    deadLetters: redis.deadLetters.length,
    duplicateConsumerReceived: duplicateRead.length,
    publishedEvents: publisher.snapshotMetrics().publishedEvents,
    heartbeat: Boolean(connectionManager.health.lastHeartbeatAt)
  }, null, 2));
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
