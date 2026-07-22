function createUuid() {
  return typeof globalThis.crypto?.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : `batch_${Date.now()}_${Math.floor(Math.random() * 1e9)}`;
}

function byteLength(value) {
  return new TextEncoder().encode(JSON.stringify(value)).length;
}

function collectorVersion(events) {
  const versions = new Set(events.map((item) =>
    item.event?.metadata?.collectorVersion ||
    item.event?.metadata?.collectorId ||
    'unknown'
  ));
  return versions.size === 1 ? Array.from(versions)[0] : 'mixed';
}

export class BatchBuilder {
  constructor({
    maxEventsPerBatch = 100,
    maxPayloadBytes = 262144,
    sdkVersion = 'observability-sdk-v1',
    schemaVersion = 1
  } = {}) {
    this.maxEventsPerBatch = maxEventsPerBatch;
    this.maxPayloadBytes = maxPayloadBytes;
    this.sdkVersion = sdkVersion;
    this.schemaVersion = schemaVersion;
  }

  build(queue, batchSequenceNumber) {
    const ordered = queue
      .slice()
      .sort((a, b) => Number(a.uploadSequenceNumber || 0) - Number(b.uploadSequenceNumber || 0));
    const entries = [];
    for (const entry of ordered) {
      if (!entry?.eventId || !Number.isInteger(entry.uploadSequenceNumber)) continue;
      const candidate = {
        sequenceNumber: entry.uploadSequenceNumber,
        event: {
          eventId: entry.eventId,
          sessionId: entry.sessionId,
          userId: entry.userId || null,
          platform: entry.platform,
          contestId: entry.contestId,
          contestName: entry.contestName || null,
          problemId: entry.problemId || null,
          eventType: entry.eventType,
          timestamp: entry.timestamp,
          pageUrl: entry.pageUrl,
          metadata: entry.metadata || {}
        }
      };
      const nextEntries = [...entries, candidate];
      const candidateBatch = this.createBatch(nextEntries, batchSequenceNumber);
      if (entries.length > 0 && byteLength(candidateBatch) > this.maxPayloadBytes) break;
      if (byteLength(candidateBatch) > this.maxPayloadBytes) {
        throw new Error(`Telemetry event exceeds maximum upload payload size: ${entry.eventId}`);
      }
      entries.push(candidate);
      if (entries.length >= this.maxEventsPerBatch) break;
    }
    if (entries.length === 0) return null;
    return this.createBatch(entries, batchSequenceNumber);
  }

  createBatch(events, sequenceNumber) {
    return {
      batchId: createUuid(),
      sequenceNumber,
      createdAt: new Date().toISOString(),
      sdkVersion: this.sdkVersion,
      schemaVersion: this.schemaVersion,
      collectorVersion: collectorVersion(events),
      events
    };
  }
}
