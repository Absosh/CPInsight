export class ManagedMutationObserver {
  constructor(callback, {
    target = document.documentElement,
    options = { childList: true, subtree: true },
    debounceMs = 100,
    autoDisconnectMs = 0
  } = {}) {
    this.callback = callback;
    this.target = target;
    this.options = options;
    this.debounceMs = debounceMs;
    this.autoDisconnectMs = autoDisconnectMs;
    this.timer = null;
    this.autoTimer = null;
    this.observer = new MutationObserver(this.handleMutations);
  }

  start() {
    if (!this.target) return this;
    this.observer.observe(this.target, this.options);
    if (this.autoDisconnectMs > 0) {
      this.autoTimer = setTimeout(() => this.disconnect(), this.autoDisconnectMs);
    }
    return this;
  }

  disconnect() {
    clearTimeout(this.timer);
    clearTimeout(this.autoTimer);
    this.observer.disconnect();
  }

  handleMutations = (mutations) => {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.callback(mutations), this.debounceMs);
  };
}

export function waitForDomSettled({ timeoutMs = 10000, quietMs = 250 } = {}) {
  return new Promise((resolve) => {
    let settledTimer = null;
    const finish = () => {
      observer.disconnect();
      resolve();
    };
    const timeoutTimer = setTimeout(finish, timeoutMs);
    const observer = new ManagedMutationObserver(() => {
      clearTimeout(settledTimer);
      settledTimer = setTimeout(() => {
        clearTimeout(timeoutTimer);
        finish();
      }, quietMs);
    }, { debounceMs: 50 }).start();

    settledTimer = setTimeout(() => {
      clearTimeout(timeoutTimer);
      finish();
    }, quietMs);
  });
}
