export const SessionState = Object.freeze({
  IDLE: 'IDLE',
  CONTEST_DETECTED: 'CONTEST_DETECTED',
  SESSION_INITIALIZING: 'SESSION_INITIALIZING',
  SESSION_ACTIVE: 'SESSION_ACTIVE',
  SESSION_PAUSED: 'SESSION_PAUSED',
  SESSION_RESUMED: 'SESSION_RESUMED',
  SESSION_ENDED: 'SESSION_ENDED',
  ARCHIVED: 'ARCHIVED'
});

export const SessionEndReason = Object.freeze({
  CONTEST_FINISHED: 'contest_finished',
  USER_LEFT_CONTEST: 'user_left_contest',
  TAB_CLOSED: 'tab_closed',
  BROWSER_RESTART_RECOVERY: 'browser_restart_recovery'
});
