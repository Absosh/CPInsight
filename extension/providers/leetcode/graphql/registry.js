import { LeetCodeGraphQLOperation, LeetCodeGraphQLQueries } from './queries.js';

export class LeetCodeGraphQLRegistry {
  constructor(queries = LeetCodeGraphQLQueries) {
    this.queries = queries;
  }

  get(operationKey) {
    return this.queries[operationKey] || null;
  }

  has(operationKey) {
    return Boolean(this.get(operationKey));
  }

  list() {
    return Object.values(LeetCodeGraphQLOperation);
  }
}

export const leetcodeGraphQLRegistry = new LeetCodeGraphQLRegistry();
