export const LiveMonitoringState = Object.freeze({
  IDLE: 'idle',
  PREPARING: 'preparing',
  MONITORING: 'monitoring',
  PAUSED: 'paused',
  RECONNECTING: 'reconnecting',
  CONTEST_FINISHED: 'contest_finished',
  PROCESSING_REVIEW: 'processing_review',
  COMPLETED: 'completed',
  ERROR: 'error'
});

const allowed = Object.freeze({
  [LiveMonitoringState.IDLE]: new Set([LiveMonitoringState.PREPARING]),
  [LiveMonitoringState.PREPARING]: new Set([LiveMonitoringState.MONITORING, LiveMonitoringState.ERROR, LiveMonitoringState.IDLE]),
  [LiveMonitoringState.MONITORING]: new Set([LiveMonitoringState.PAUSED, LiveMonitoringState.RECONNECTING, LiveMonitoringState.CONTEST_FINISHED, LiveMonitoringState.PROCESSING_REVIEW, LiveMonitoringState.ERROR]),
  [LiveMonitoringState.PAUSED]: new Set([LiveMonitoringState.MONITORING, LiveMonitoringState.RECONNECTING, LiveMonitoringState.PROCESSING_REVIEW]),
  [LiveMonitoringState.RECONNECTING]: new Set([LiveMonitoringState.MONITORING, LiveMonitoringState.ERROR, LiveMonitoringState.PROCESSING_REVIEW]),
  [LiveMonitoringState.CONTEST_FINISHED]: new Set([LiveMonitoringState.PROCESSING_REVIEW]),
  [LiveMonitoringState.PROCESSING_REVIEW]: new Set([LiveMonitoringState.COMPLETED, LiveMonitoringState.ERROR]),
  [LiveMonitoringState.COMPLETED]: new Set([LiveMonitoringState.IDLE]),
  [LiveMonitoringState.ERROR]: new Set([LiveMonitoringState.IDLE, LiveMonitoringState.RECONNECTING])
});

export function assertLiveMonitoringTransition(current, next) {
  if (!allowed[current]?.has(next)) {
    throw new Error(`Illegal live monitoring transition: ${current} -> ${next}`);
  }
  return next;
}
