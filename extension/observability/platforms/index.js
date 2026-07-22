import { codeforcesCollector } from './codeforces/collector.js';
import { codechefCollector } from './codechef/collector.js';

export const observabilityCollectors = Object.freeze([
  codeforcesCollector,
  codechefCollector
]);
