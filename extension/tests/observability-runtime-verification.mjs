import assert from 'node:assert/strict';
import { ObservabilitySDK } from '../observability/core/observability-sdk.js';
import { ObservabilityRuntimeConfig } from '../observability/config/runtime-config.js';
import { TelemetryEventType } from '../observability/models/event-types.js';
import { ContestStatus, PageKind } from '../observability/models/page-context.js';
import { SessionState } from '../observability/models/session-states.js';
import { codeforcesCollector } from '../observability/platforms/codeforces/collector.js';
import { codechefCollector } from '../observability/platforms/codechef/collector.js';
import { validateCollectorContract } from '../observability/plugin-api/collector-contract.js';

class MemoryStorage {
  constructor(seed = {}) {
    this.values = structuredClone(seed);
  }

  async get(key, fallback = null) {
    return Object.prototype.hasOwnProperty.call(this.values, key)
      ? structuredClone(this.values[key])
      : fallback;
  }

  async set(key, value) {
    this.values[key] = structuredClone(value);
    return value;
  }
}

function createSdk(seed) {
  return new ObservabilitySDK({
    storage: new MemoryStorage(seed),
    config: ObservabilityRuntimeConfig,
    logger: {
      debug() {},
      info() {},
      warn() {},
      error() {}
    }
  });
}

function fakeDocument({ title = 'Contest', body = 'contest active' } = {}) {
  return {
    body: { textContent: body },
    querySelector(selector) {
      if (selector === 'title' || selector === 'h1' || selector === '.contest-name') {
        return { textContent: title };
      }
      return null;
    }
  };
}

function snapshot(overrides = {}) {
  return {
    collectorId: overrides.collectorId || 'codeforces-contest-session',
    tabId: overrides.tabId ?? 101,
    url: overrides.url || 'https://codeforces.com/contest/1999',
    source: 'runtime_verification',
    navigationType: overrides.navigationType || 'navigate',
    visibilityState: overrides.visibilityState || 'visible',
    schemaVersion: 1,
    pageContext: {
      platform: overrides.platform || 'codeforces',
      kind: overrides.kind || PageKind.CONTEST,
      contestId: overrides.contestId || '1999',
      contestName: overrides.contestName || 'Codeforces Round 1999',
      contestType: overrides.contestType || 'contest',
      contestStartTime: '2026-07-22T12:00:00.000Z',
      contestEndTime: '2026-07-22T14:00:00.000Z',
      contestStatus: overrides.contestStatus || ContestStatus.ACTIVE,
      problemCode: overrides.problemCode || null,
      problemIndex: overrides.problemIndex || null
    }
  };
}

async function events(sdk) {
  return sdk.store.getEvents();
}

async function sessions(sdk) {
  return sdk.store.getSessions();
}

async function run() {
  assert.doesNotThrow(() => validateCollectorContract(codeforcesCollector));
  assert.doesNotThrow(() => validateCollectorContract(codechefCollector));
  assert.throws(() => validateCollectorContract({
    id: 'incomplete',
    platform: 'example',
    initialize() {},
    supports() {},
    collect() {},
    destroy() {}
  }), /pause, resume/);

  const codeforcesContext = codeforcesCollector.collect({
    url: 'https://codeforces.com/contest/1999/problem/A',
    documentRef: fakeDocument({ title: 'Codeforces Round 1999' })
  });
  assert.equal(codeforcesContext.platform, 'codeforces');
  assert.equal(codeforcesContext.kind, PageKind.PROBLEM);
  assert.equal(codeforcesContext.contestId, '1999');
  assert.equal(codeforcesContext.problemIndex, 'A');

  const codechefContext = codechefCollector.collect({
    url: 'https://www.codechef.com/START200/problems/ABCXYZ',
    documentRef: fakeDocument({ title: 'Starters 200' })
  });
  assert.equal(codechefContext.platform, 'codechef');
  assert.equal(codechefContext.kind, PageKind.PROBLEM);
  assert.equal(codechefContext.contestId, 'START200');
  assert.equal(codechefContext.problemCode, 'ABCXYZ');

  const sdk = createSdk();
  await sdk.initialize({ runtime: 'test' });
  assert.equal((await sdk.store.storage.get('observability.metadata')).schemaVersion, ObservabilityRuntimeConfig.schemaVersion);
  const corruptedSdk = createSdk({
    'observability.sessions': 'not-an-object',
    'observability.events': { invalid: true },
    'observability.queue': 'not-an-array',
    'observability.tabIndex': []
  });
  assert.deepEqual(await corruptedSdk.store.getSessions(), {}, 'corrupted session storage must recover');
  assert.deepEqual(await corruptedSdk.store.getEvents(), [], 'corrupted event storage must recover');
  assert.deepEqual(await corruptedSdk.store.getQueue(), [], 'corrupted queue storage must recover');
  assert.deepEqual(await corruptedSdk.store.getTabIndex(), {}, 'corrupted tab index storage must recover');

  const contestSession = await sdk.handlePageSnapshot(snapshot());
  assert.equal(contestSession.state, SessionState.SESSION_ACTIVE);
  assert.equal(contestSession.platform, 'codeforces');

  await sdk.handlePageSnapshot(snapshot());
  assert.equal(Object.keys(await sessions(sdk)).length, 1, 'duplicate contest load must not create a second session');
  assert.equal((await events(sdk)).filter((event) => event.eventType === TelemetryEventType.SESSION_STARTED).length, 1);
  assert.match((await events(sdk))[0].eventId, /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  const emittedEvent = await sdk.eventBus.emit({
    sessionId: contestSession.sessionId,
    userId: null,
    platform: 'codeforces',
    contestId: '1999',
    contestName: 'Codeforces Round 1999',
    problemId: null,
    eventType: TelemetryEventType.PAGE_EXITED,
    pageUrl: 'https://codeforces.com/contest/1999',
    metadata: { reason: 'immutability_probe', dedupeKey: 'immutability_probe' }
  });
  assert.equal(Object.isFrozen(emittedEvent), true, 'events emitted by the pipeline must be immutable');

  await sdk.handlePageSnapshot(snapshot({
    kind: PageKind.PROBLEM,
    url: 'https://codeforces.com/contest/1999/problem/A',
    problemIndex: 'A',
    problemCode: 'A'
  }));
  await sdk.handlePageSnapshot(snapshot({
    kind: PageKind.PROBLEM,
    url: 'https://codeforces.com/contest/1999/problem/B',
    problemIndex: 'B',
    problemCode: 'B'
  }));

  await sdk.handlePageSnapshot(snapshot({
    kind: PageKind.PROBLEM,
    url: 'https://codeforces.com/contest/1999/problem/B',
    problemIndex: 'B',
    problemCode: 'B',
    navigationType: 'reload'
  }));

  await sdk.handlePageSnapshot(snapshot({
    kind: PageKind.PROBLEM,
    url: 'https://codeforces.com/contest/1999/problem/B',
    problemIndex: 'B',
    problemCode: 'B',
    visibilityState: 'hidden'
  }));
  await sdk.handlePageSnapshot(snapshot({
    kind: PageKind.PROBLEM,
    url: 'https://codeforces.com/contest/1999/problem/B',
    problemIndex: 'B',
    problemCode: 'B',
    visibilityState: 'visible'
  }));

  await sdk.handlePageSnapshot(snapshot({
    tabId: 202,
    kind: PageKind.PROBLEM,
    url: 'https://codeforces.com/contest/1999/problem/C',
    problemIndex: 'C',
    problemCode: 'C'
  }));
  assert.equal(Object.keys(await sessions(sdk)).length, 1, 'multiple tabs for one contest must share one session');
  assert.deepEqual(new Set(Object.values(await sessions(sdk))[0].tabIds), new Set(['101', '202']));

  await sdk.handleTabClosed(202);
  assert.deepEqual(Object.values(await sessions(sdk))[0].tabIds, ['101'], 'tab close must transfer ownership to remaining contest tab');
  await sdk.handlePageExit({
    tabId: 101,
    url: 'https://example.com/',
    reason: 'navigation_away'
  });

  const seeded = createSdk(sdk.store.storage.values);
  const recovered = await seeded.recoverUnfinishedSessions('browser_restart');
  assert.equal(recovered, 1, 'unfinished session must recover after restart');
  await seeded.recoverUnfinishedSessions('browser_restart');
  assert.equal((await events(seeded)).filter((event) => event.eventType === TelemetryEventType.SESSION_RECOVERED).length, 1);

  await seeded.handlePageSnapshot(snapshot({
    contestStatus: ContestStatus.FINISHED,
    url: 'https://codeforces.com/contest/1999/standings'
  }));

  const finalSession = Object.values(await sessions(seeded))[0];
  assert.equal(finalSession.state, SessionState.ARCHIVED);

  await seeded.handlePageSnapshot(snapshot({
    collectorId: 'codechef-contest-session',
    platform: 'codechef',
    contestId: 'START200',
    contestName: 'Starters 200',
    contestType: 'starters',
    url: 'https://www.codechef.com/START200',
    tabId: 303
  }));
  assert.equal(Object.keys(await sessions(seeded)).length, 2, 'different contests must create independent sessions');

  const eventTypes = (await events(seeded)).map((event) => event.eventType);
  [
    TelemetryEventType.CONTEST_DETECTED,
    TelemetryEventType.SESSION_STARTED,
    TelemetryEventType.PROBLEM_OPENED,
    TelemetryEventType.PROBLEM_SWITCHED,
    TelemetryEventType.PAGE_RELOADED,
    TelemetryEventType.TAB_HIDDEN,
    TelemetryEventType.TAB_VISIBLE,
    TelemetryEventType.TAB_CLOSED,
    TelemetryEventType.SESSION_RECOVERED,
    TelemetryEventType.SESSION_ENDED
  ].forEach((eventType) => assert.ok(eventTypes.includes(eventType), `${eventType} event should be emitted`));

  const queue = await seeded.store.getQueue();
  assert.equal(queue.length, (await events(seeded)).length, 'durable transport queue mirrors stored events');

  return {
    sessions: Object.keys(await sessions(seeded)).length,
    finalState: finalSession.state,
    eventTypes,
    queueLength: queue.length
  };
}

run()
  .then((result) => {
    console.log(JSON.stringify({
      verdict: 'PASS',
      ...result
    }, null, 2));
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
