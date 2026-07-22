const assert = require('assert/strict');
const crypto = require('crypto');
const EventEmitter = require('events');
const { createDomainEvent } = require('../src/domain-events/domainEvent');
const { RealtimeGateway } = require('../src/realtime/gateway/realtimeGateway');
const { RealtimeConnection } = require('../src/realtime/core/realtimeConnection');
const { RedisGatewayConsumer } = require('../src/realtime/gateway/redisGatewayConsumer');
const { STREAMS } = require('../src/redis/events/streamTopology');
const { RedisEventPublisher } = require('../src/redis/events/publisher');

class FakeSocket extends EventEmitter {
  constructor({ blocked = false } = {}) {
    super();
    this.blocked = blocked;
    this.frames = [];
    this.closed = false;
  }

  write(frame) {
    if (!this.blocked) this.frames.push(frame);
    return !this.blocked;
  }

  end() {
    this.closed = true;
    this.emit('close');
  }

  destroy() {
    this.closed = true;
    this.emit('close');
  }
}

class FakeRedis {
  constructor() {
    this.status = 'ready';
    this.streams = new Map();
    this.groups = new Map();
  }

  async connect() {}

  async ping() {
    return 'PONG';
  }

  async xgroup(_command, stream, group) {
    const key = `${stream}:${group}`;
    if (this.groups.has(key)) throw new Error('BUSYGROUP');
    this.groups.set(key, true);
  }

  async xadd(stream, ...args) {
    const fields = args.slice(args.indexOf('*') + 1);
    const entry = {
      id: `${Date.now()}-${this.getStream(stream).length + 1}`,
      fields,
      delivered: new Set(),
      acked: new Set()
    };
    this.getStream(stream).push(entry);
    return entry.id;
  }

  pipeline() {
    const commands = [];
    return {
      xadd: (stream, ...args) => commands.push([stream, args]),
      exec: async () => Promise.all(commands.map(async ([stream, args]) => [null, await this.xadd(stream, ...args)]))
    };
  }

  async xreadgroup(_groupKeyword, group, consumer, _countKeyword, count, _blockKeyword, _blockMs, _streamsKeyword, stream) {
    const entries = this.getStream(stream)
      .filter((entry) => !entry.acked.has(group))
      .filter((entry) => !entry.delivered.has(group))
      .slice(0, count);
    if (!entries.length) return null;
    for (const entry of entries) {
      entry.delivered.add(group);
      entry.consumer = consumer;
    }
    return [[stream, entries.map((entry) => [entry.id, entry.fields])]];
  }

  async xautoclaim() {
    return ['0-0', []];
  }

  async xack(stream, group, ...ids) {
    let count = 0;
    for (const entry of this.getStream(stream)) {
      if (ids.includes(entry.id)) {
        entry.acked.add(group);
        count += 1;
      }
    }
    return count;
  }

  async xpending() {
    return [];
  }

  getStream(stream) {
    if (!this.streams.has(stream)) this.streams.set(stream, []);
    return this.streams.get(stream);
  }
}

class FakeConnectionManager {
  constructor(redis) {
    this.redis = redis;
    this.health = { lastHeartbeatAt: null };
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

function event({ userId, contestId = '1999', index = 1 }) {
  return createDomainEvent({
    eventType: 'ProblemOpened',
    occurredAt: new Date().toISOString(),
    aggregateType: 'TelemetrySession',
    aggregateId: `session-${userId}`,
    source: 'realtime-verification',
    payload: {
      index,
      contestId,
      userId
    },
    metadata: {
      userId,
      sequenceNumber: index
    },
    correlationId: crypto.randomUUID(),
    causationId: crypto.randomUUID()
  });
}

function addConnection(gateway, user, options = {}) {
  const socket = new FakeSocket(options);
  const connection = new RealtimeConnection({
    socket,
    user,
    registry: gateway.registry,
    authorizer: gateway.authorizer,
    metrics: gateway.metrics,
    maxQueueSize: options.maxQueueSize || gateway.maxQueueSize,
    idleTimeoutMs: gateway.idleTimeoutMs
  });
  connection.initialize();
  return connection;
}

async function run() {
  const gateway = new RealtimeGateway({ maxQueueSize: 5, idleTimeoutMs: 1000 });
  const userA = { id: '00000000-0000-4000-8000-000000000001', username: 'alice' };
  const userB = { id: '00000000-0000-4000-8000-000000000002', username: 'bob' };

  const connections = Array.from({ length: 100 }, () => addConnection(gateway, userA));
  const secondUser = addConnection(gateway, userB);
  for (const connection of connections) {
    assert.equal(connection.subscribe(`telemetry:${userA.id}`), true);
  }
  assert.equal(secondUser.subscribe(`telemetry:${userB.id}`), true);
  assert.equal(secondUser.subscribe(`telemetry:${userA.id}`), false, 'cross-user telemetry channel must be denied');

  const secondUserFramesBeforeRoute = secondUser.socket.frames.length;
  const firstRoute = gateway.routeDomainEvent(event({ userId: userA.id, index: 1 }));
  assert.equal(firstRoute.recipientCount, 100);
  assert.equal(
    secondUser.socket.frames.length,
    secondUserFramesBeforeRoute,
    'unauthorized user must not receive another user telemetry event'
  );

  for (let index = 2; index < 52; index += 1) {
    gateway.routeDomainEvent(event({ userId: userA.id, index }));
  }
  assert.equal(gateway.snapshotMetrics().activeConnections, 101);
  assert.equal(gateway.snapshotMetrics().messagesSent > 100, true);

  const reconnecting = connections[0];
  reconnecting.resume(25);
  assert.equal(gateway.snapshotMetrics().reconnectCount, 1);

  const slowConnection = addConnection(gateway, userA, { blocked: true, maxQueueSize: 1 });
  slowConnection.flush = () => {};
  slowConnection.subscribe(`telemetry:${userA.id}`);
  gateway.routeDomainEvent(event({ userId: userA.id, index: 60 }));
  gateway.routeDomainEvent(event({ userId: userA.id, index: 61 }));
  assert.equal(slowConnection.closed, true);
  assert.equal(gateway.snapshotMetrics().droppedMessages, 1);

  const idleConnection = addConnection(gateway, userA);
  idleConnection.lastActivityAt = Date.now() - 5000;
  gateway.heartbeat();
  assert.equal(idleConnection.closed, true);
  assert.equal(gateway.snapshotMetrics().heartbeatFailures >= 1, true);

  const redis = new FakeRedis();
  const connectionManager = new FakeConnectionManager(redis);
  const publisher = new RedisEventPublisher({ connectionManager });
  await publisher.publish(event({ userId: userA.id, index: 100 }));
  const redisConsumer = new RedisGatewayConsumer({
    connectionManager,
    gateway,
    streams: [STREAMS.TELEMETRY],
    group: 'gateway-verification',
    batchSize: 10,
    blockMs: 1
  });
  await redisConsumer.consumeOnce();
  assert.equal(redis.getStream(STREAMS.TELEMETRY)[0].acked.has('gateway-verification'), true);

  const beforeShutdown = gateway.snapshotMetrics();
  await redisConsumer.shutdown();
  await gateway.shutdown();
  assert.equal(gateway.snapshotMetrics().activeConnections, 0);

  console.log(JSON.stringify({
    verdict: 'PASS',
    simultaneousConnections: 101,
    routedRecipients: firstRoute.recipientCount,
    reconnects: beforeShutdown.reconnectCount,
    droppedMessages: beforeShutdown.droppedMessages,
    heartbeatFailures: beforeShutdown.heartbeatFailures,
    redisDelivered: true,
    redisAcknowledged: true,
    activeAfterShutdown: gateway.snapshotMetrics().activeConnections,
    unauthorizedSubscriptionRejected: true
  }, null, 2));
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
