const STREAM_VERSION = 'v1';

const STREAMS = Object.freeze({
  TELEMETRY: `cpinsight:${STREAM_VERSION}:telemetry.events`,
  CONTEST: `cpinsight:${STREAM_VERSION}:contest.events`,
  USER: `cpinsight:${STREAM_VERSION}:user.events`,
  ANALYTICS: `cpinsight:${STREAM_VERSION}:analytics.events`,
  SYSTEM: `cpinsight:${STREAM_VERSION}:system.events`
});

function streamForEvent(event) {
  if (event.aggregateType === 'TelemetrySession') return STREAMS.TELEMETRY;
  if (event.aggregateType === 'Contest') return STREAMS.CONTEST;
  if (event.aggregateType === 'User') return STREAMS.USER;
  if (event.eventType.startsWith('Analytics')) return STREAMS.ANALYTICS;
  return STREAMS.SYSTEM;
}

module.exports = {
  STREAM_VERSION,
  STREAMS,
  streamForEvent
};
