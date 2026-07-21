import { ExtensionError, ErrorKind } from '../../../utils/errors.js';
import { LeetCodeConfig } from '../config.js';
import { AppConfig } from '../../../config/defaults.js';
import { leetcodeGraphQLRegistry } from './registry.js';
import { asObject } from '../validators/schema.js';
import { createLogger } from '../../../utils/logger.js';

const graphQLLogger = createLogger('GraphQL');

function defaultFetch(url, options) {
  return window.fetch.call(window, url, options);
}

function redactHeaders(headers) {
  return Object.fromEntries(Object.entries(headers).map(([key, value]) => {
    const normalized = key.toLowerCase();
    if (normalized.includes('cookie') || normalized.includes('authorization') || normalized.includes('token')) {
      return [key, '[redacted]'];
    }
    return [key, value];
  }));
}

function getExecutionContext() {
  return {
    hasWindow: typeof window !== 'undefined',
    href: typeof window !== 'undefined' ? window.location?.href : null,
    origin: typeof window !== 'undefined' ? window.location?.origin : null,
    isPageContext: typeof window !== 'undefined' && window.location?.hostname?.endsWith('leetcode.com')
  };
}

function classifyFailure({ response = null, payload = null, parseError = null, fetchError = null, endpoint, context }) {
  if (fetchError) return 'Other';
  if (!String(endpoint).includes('/graphql')) return 'Wrong endpoint';
  if (!context.isPageContext) return 'Wrong execution context';
  if (response && !response.ok) {
    if (response.status === 401 || response.status === 403) return 'GraphQL authorization failure';
    if (response.status === 400) return 'GraphQL validation failure or missing CSRF/header';
    return 'HTTP failure';
  }
  if (parseError) return 'HTTP failure';
  if (Array.isArray(payload?.errors) && payload.errors.length) {
    const text = JSON.stringify(payload.errors).toLowerCase();
    if (text.includes('csrf')) return 'Missing CSRF token';
    if (text.includes('credential') || text.includes('unauthor') || text.includes('login')) {
      return 'GraphQL authorization failure';
    }
    return 'GraphQL validation failure';
  }
  return 'Other';
}

export class LeetCodeGraphQLClient {
  constructor({
    endpoint = `${LeetCodeConfig.origin}${LeetCodeConfig.graphqlPath}`,
    fetchImpl = defaultFetch,
    timeoutMs = LeetCodeConfig.requestTimeoutMs,
    logger = null
  } = {}) {
    this.endpoint = endpoint;
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
    this.registry = leetcodeGraphQLRegistry;
    this.logger = logger;
    this.activeControllers = new Set();
  }

  cancelActiveRequests(reason = 'LeetCode collection cancelled') {
    const abortReason = typeof DOMException === 'function'
      ? new DOMException(reason, 'AbortError')
      : undefined;
    for (const controller of this.activeControllers) {
      controller.abort(abortReason);
    }
    this.activeControllers.clear();
  }

  async execute(operationKey, input = {}) {
    const isProgressQuestionList = operationKey === 'userProgressQuestionList';
    if (isProgressQuestionList) {
      this.logger?.debug('Loading GraphQL query');
      this.logger?.debug('Operation: userProgressQuestionList');
    }

    const definition = this.registry.get(operationKey);
    if (!definition) {
      const error = new ExtensionError(`Unknown LeetCode GraphQL operation: ${operationKey}`, {
        kind: ErrorKind.PROVIDER,
        metadata: { operationKey }
      });
      if (isProgressQuestionList) {
        this.logger?.error(`GraphQL registry lookup failed: ${error.message}`);
        this.logger?.error(`Complete stack trace: ${error.stack || 'No stack trace available'}`);
      }
      throw error;
    }

    const controller = new AbortController();
    this.activeControllers.add(controller);
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);
    const startedAt = performance.now();
    const headers = {
      accept: 'application/json',
      'content-type': 'application/json'
    };
    const body = JSON.stringify({
      operationName: definition.operationName,
      query: definition.query,
      variables: definition.variables(input)
    });
    const requestOptions = {
      method: 'POST',
      credentials: 'include',
      headers,
      body,
      signal: controller.signal
    };
    const executionContext = getExecutionContext();

    try {
      if (isProgressQuestionList) {
        this.logger?.debug('Preparing GraphQL request');
        this.logger?.debug(`Operation: ${definition.operationName}`);
        this.logger?.debug(`Current skip: ${input.skip ?? 'not set'}`);
        this.logger?.debug(`Current limit: ${input.limit ?? 'not set'}`);
        this.logger?.debug(`Sort field: ${input.sortField ?? 'not set'}`);
        this.logger?.debug(`Sort order: ${input.sortOrder ?? 'not set'}`);
        this.logger?.debug('Sending GraphQL request');
      }

      if (AppConfig.debug.verbose) {
        graphQLLogger.info('Before GraphQL request');
        graphQLLogger.info(`Operation name: ${definition.operationName}`);
        graphQLLogger.info(`Endpoint URL: ${this.endpoint}`);
        graphQLLogger.info(`HTTP method: ${requestOptions.method}`);
        graphQLLogger.info('Headers being sent', redactHeaders(headers));
        graphQLLogger.info(`Request body: ${body}`);
        graphQLLogger.info('Variables', definition.variables(input));
        graphQLLogger.info(`credentials:"include" enabled: ${requestOptions.credentials === 'include'}`);
        graphQLLogger.info(`Fetch executed from page context: ${executionContext.isPageContext}`);
        graphQLLogger.info('Execution context', executionContext);
      }

      let response;
      try {
        response = await this.fetchImpl(this.endpoint, requestOptions);
      } catch (error) {
        graphQLLogger.error(`Fetch threw error type: ${error?.name || 'UnknownError'}`);
        graphQLLogger.error(`Fetch error message: ${error?.message || 'Unknown fetch error'}`);
        graphQLLogger.error(`Fetch error stack: ${error?.stack || 'No stack trace available'}`);
        graphQLLogger.error(`Failure classification: ${classifyFailure({ fetchError: error, endpoint: this.endpoint, context: executionContext })}`);
        throw error;
      }

      const durationMs = Math.round(performance.now() - startedAt);
      if (AppConfig.debug.verbose) {
        graphQLLogger.info(`HTTP status: ${response.status}`);
        graphQLLogger.info(`statusText: ${response.statusText}`);
        graphQLLogger.info(`response.ok: ${response.ok}`);
        graphQLLogger.info(`redirected: ${response.redirected}`);
        graphQLLogger.info(`response URL: ${response.url}`);
      }

      if (isProgressQuestionList) {
        this.logger?.debug(`HTTP Status: ${response.status}`);
        this.logger?.debug(`Request duration: ${durationMs}ms`);
        this.logger?.debug(`Response OK: ${response.ok}`);
      }

      const responseText = await response.text();
      if (AppConfig.debug.verbose) {
        graphQLLogger.info(`Response body first 500 chars: ${responseText.slice(0, 500)}`);
      }

      if (isProgressQuestionList) {
        this.logger?.debug('Parsing response');
      }

      let json;
      let parseError = null;
      try {
        json = JSON.parse(responseText);
        if (AppConfig.debug.verbose) graphQLLogger.info('JSON parse succeeded');
        if (Array.isArray(json.errors)) {
          graphQLLogger.error('GraphQL errors field present', json.errors);
        }
      } catch (error) {
        parseError = error;
        graphQLLogger.error(`JSON parse failed: ${error?.message || 'Unknown JSON parse error'}`);
        if (AppConfig.debug.verbose) graphQLLogger.error(`Raw response text: ${responseText}`);
        graphQLLogger.error(`Failure classification: ${classifyFailure({ response, parseError, endpoint: this.endpoint, context: executionContext })}`);
        if (isProgressQuestionList) {
          this.logger?.error(`Stage name: Response parsing`);
          this.logger?.error(`Exception message: ${error?.message || 'Unknown JSON parse error'}`);
          this.logger?.error(`Complete stack trace: ${error?.stack || 'No stack trace available'}`);
        }
        throw error;
      }

      if (!response.ok) {
        graphQLLogger.error(`Failure classification: ${classifyFailure({ response, payload: json, endpoint: this.endpoint, context: executionContext })}`);
        throw new ExtensionError(`LeetCode GraphQL failed with HTTP ${response.status}`, {
          kind: response.status === 401 || response.status === 403 ? ErrorKind.AUTHENTICATION : ErrorKind.NETWORK,
          metadata: { status: response.status, statusText: response.statusText, operationKey, responseBody: responseText.slice(0, 500) }
        });
      }

      if (isProgressQuestionList) {
        this.logger?.debug('Response parsed successfully');
      }

      const payload = asObject(json, 'LeetCode GraphQL response');
      if (Array.isArray(payload.errors) && payload.errors.length) {
        graphQLLogger.error('Complete GraphQL errors array', payload.errors);
        graphQLLogger.error(`Failure classification: ${classifyFailure({ response, payload, endpoint: this.endpoint, context: executionContext })}`);
        throw new ExtensionError('LeetCode GraphQL returned server errors', {
          kind: ErrorKind.PROVIDER,
          metadata: {
            operationKey,
            errors: payload.errors
          }
        });
      }

      if (AppConfig.debug.verbose) {
        graphQLLogger.info(`Failure classification: ${classifyFailure({ response, payload, endpoint: this.endpoint, context: executionContext })}`);
      }

      return asObject(payload.data || {}, 'LeetCode GraphQL data');
    } catch (error) {
      if (isProgressQuestionList) {
        this.logger?.error(`Stage name: GraphQL request execution`);
        this.logger?.error(`Exception message: ${error?.message || 'Unknown GraphQL request error'}`);
        this.logger?.error(`Complete stack trace: ${error?.stack || 'No stack trace available'}`);
      }
      if (error.name === 'AbortError') {
        const abortMessage = controller.signal.reason?.message || 'LeetCode GraphQL request timed out';
        throw new ExtensionError(abortMessage, {
          kind: ErrorKind.NETWORK,
          cause: error,
          metadata: { operationKey }
        });
      }
      if (error instanceof ExtensionError) throw error;
      throw new ExtensionError('LeetCode GraphQL request failed', {
        kind: ErrorKind.NETWORK,
        cause: error,
        metadata: { operationKey }
      });
    } finally {
      clearTimeout(timeoutId);
      this.activeControllers.delete(controller);
    }
  }
}
