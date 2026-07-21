export const MessageSource = Object.freeze({
  POPUP: 'popup',
  BACKGROUND: 'background',
  CONTENT: 'content',
  INJECTED: 'injected'
});

export const MessageType = Object.freeze({
  PING: 'core:ping',
  STATE_GET: 'state:get',
  STATE_CHANGED: 'state:changed',
  PROVIDER_REGISTERED: 'provider:registered',
  PROVIDER_STATUS_GET: 'provider:status:get',
  PROVIDER_STATUS_CHANGED: 'provider:status:changed',
  PROVIDER_AUTH_CHECK: 'provider:auth:check',
  PROVIDER_COLLECT_REQUEST: 'provider:collect:request',
  PROVIDER_COLLECT_CANCEL: 'provider:collect:cancel',
  PROVIDER_COLLECT_RESULT: 'provider:collect:result',
  PAGE_STATE_CHANGED: 'page:state:changed',
  PAGE_BRIDGE_READY: 'page:bridge:ready',
  PAGE_COMMAND: 'page:command',
  PAGE_COMMAND_RESULT: 'page:command:result',
  NETWORK_EVENT: 'network:event',
  SPA_NAVIGATION: 'spa:navigation',
  SYNC_REQUESTED: 'sync:requested',
  SYNC_PROGRESS: 'sync:progress',
  SYNC_CANCELLED: 'sync:cancelled',
  QUEUE_STATUS_GET: 'queue:status:get',
  AUTH_STATUS_CHANGED: 'auth:status:changed',
  ERROR_REPORTED: 'error:reported'
});
