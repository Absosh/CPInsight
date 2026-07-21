import { ExtensionError, ErrorKind } from '../utils/errors.js';

export class SyncOrchestrator {
  constructor({ providerRegistry, stateStore, logger }) {
    this.providerRegistry = providerRegistry;
    this.stateStore = stateStore;
    this.logger = logger;
  }

  async requestSync(providerId) {
    const provider = this.providerRegistry.get(providerId);
    this.logger.info('Sync requested', { providerId: provider.id });
    throw new ExtensionError('Sync is intentionally not implemented in Prompt 1', {
      kind: ErrorKind.RECOVERABLE,
      metadata: { providerId }
    });
  }
}
