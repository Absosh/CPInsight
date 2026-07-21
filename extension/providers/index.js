import { createLogger } from '../utils/logger.js';
import { leetcodeProvider } from './leetcode/provider.js';

const bootstrapLogger = createLogger('Bootstrap');
bootstrapLogger.info('Provider index imported');

export const providers = Object.freeze([
  leetcodeProvider
]);

bootstrapLogger.info(`Provider instantiated count: ${providers.length}`);
