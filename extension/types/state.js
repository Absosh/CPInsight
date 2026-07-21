/**
 * @typedef {'unknown'|'authenticated'|'unauthenticated'|'expired'} AuthStatus
 * @typedef {'idle'|'initializing'|'ready'|'collecting'|'syncing'|'error'} ProviderStatus
 *
 * @typedef {Object} ExtensionState
 * @property {AuthStatus} authStatus
 * @property {Object.<string, ProviderStatus>} providerStatus
 * @property {string|null} currentUsername
 * @property {Object.<string, number|null>} lastSyncTime
 * @property {Object|null} syncProgress
 * @property {string} extensionVersion
 * @property {Object.<string, Object>} providerHealth
 * @property {number} pendingUploadCount
 * @property {Object} storageMetadata
 */

export {};
