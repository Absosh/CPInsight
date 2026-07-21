import { ExtensionError, ErrorKind } from '../utils/errors.js';

export class ProviderRegistry {
  constructor() {
    this.providers = new Map();
  }

  register(provider) {
    if (!provider?.id) {
      throw new ExtensionError('Provider must declare an id', { kind: ErrorKind.PROVIDER });
    }

    if (this.providers.has(provider.id)) {
      throw new ExtensionError(`Provider already registered: ${provider.id}`, { kind: ErrorKind.PROVIDER });
    }

    this.providers.set(provider.id, provider);
    return provider;
  }

  get(providerId) {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new ExtensionError(`Unknown provider: ${providerId}`, { kind: ErrorKind.PROVIDER });
    }
    return provider;
  }

  list() {
    return Array.from(this.providers.values());
  }

  has(providerId) {
    return this.providers.has(providerId);
  }
}
