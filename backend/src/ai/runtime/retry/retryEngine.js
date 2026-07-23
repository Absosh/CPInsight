function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransient(error) {
  const status = error.response && error.response.status;
  return !status || status === 408 || status === 409 || status === 429 || status >= 500;
}

class RetryEngine {
  constructor({ maxAttempts = 3, baseDelayMs = 100, maxDelayMs = 1000 } = {}) {
    this.maxAttempts = maxAttempts;
    this.baseDelayMs = baseDelayMs;
    this.maxDelayMs = maxDelayMs;
  }

  async run(operation) {
    let lastError = null;
    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      try {
        return { result: await operation(attempt), attempts: attempt, retries: attempt - 1 };
      } catch (error) {
        lastError = error;
        if (!isTransient(error) || attempt === this.maxAttempts) break;
        const delay = Math.min(this.maxDelayMs, this.baseDelayMs * (2 ** (attempt - 1)));
        await sleep(delay);
      }
    }
    throw lastError;
  }
}

module.exports = { RetryEngine, isTransient };

