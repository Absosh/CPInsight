import { ExtensionError, ErrorKind } from '../utils/errors.js';

export function createProviderContract(provider) {
  const required = [
    'id',
    'displayName',
    'initialize',
    'isAuthenticated',
    'collectProfile',
    'collectSubmissions',
    'collectContests',
    'collectActivity',
    'sync',
    'cleanup'
  ];

  required.forEach((key) => {
    if (!(key in provider)) {
      throw new ExtensionError(`Provider missing required member: ${key}`, { kind: ErrorKind.PROVIDER });
    }
  });

  return Object.freeze(provider);
}
