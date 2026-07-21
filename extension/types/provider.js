/**
 * @typedef {Object} ProviderRuntimeContext
 * @property {import('../storage/storage-service.js').StorageService} storage
 * @property {import('../messaging/message-bus.js').MessageBus} messageBus
 * @property {import('../network/http-client.js').HttpClient} httpClient
 * @property {import('../core/state-store.js').StateStore} stateStore
 * @property {Object} config
 */

/**
 * @typedef {Object} ProviderModule
 * @property {string} id
 * @property {string} displayName
 * @property {(context: ProviderRuntimeContext) => Promise<void>|void} initialize
 * @property {() => Promise<boolean>|boolean} isAuthenticated
 * @property {() => Promise<unknown>} [getCurrentUser]
 * @property {() => Promise<unknown>} collectProfile
 * @property {() => Promise<unknown[]>} collectSubmissions
 * @property {() => Promise<unknown[]>} [collectSubmissionHistory]
 * @property {() => Promise<unknown[]>} [collectRecentSubmissions]
 * @property {() => Promise<unknown[]>} [collectProblemMetadata]
 * @property {() => Promise<unknown[]>} collectContests
 * @property {() => Promise<unknown[]>} [collectContestHistory]
 * @property {() => Promise<unknown[]>} [collectLanguageStatistics]
 * @property {() => Promise<unknown>} collectActivity
 * @property {() => Promise<unknown>} [collectAll]
 * @property {() => Promise<void>} sync
 * @property {() => Promise<void>|void} cleanup
 */

export {};
