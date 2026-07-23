export class PopupView {
  constructor(root) {
    this.root = root;
    this.handlers = {};
  }

  bind(handlers) {
    this.handlers = handlers;
  }

  render(state) {
    this.root.dataset.state = state.loading ? 'loading' : 'ready';
    const live = state.extensionState || {};
    const detected = live.detected || {};
    const isMonitoring = live.state === 'monitoring' || live.state === 'reconnecting' || live.state === 'paused';
    const elapsedMs = live.startedAt ? Math.max(0, Date.now() - Date.parse(live.startedAt)) : 0;
    const elapsed = new Date(elapsedMs).toISOString().slice(11, 19);
    this.root.innerHTML = `
      <section class="popup-shell">
        <header>
          <strong>CPInsight Live</strong>
          <span data-health="${live.connectionHealth || 'unknown'}">${live.connectionHealth || 'idle'}</span>
        </header>
        <dl>
          <dt>Connection</dt><dd>${navigator.onLine ? 'Online' : 'Offline'}</dd>
          <dt>Page</dt><dd>${detected.supported ? 'Supported contest' : detected.reason || 'No contest detected'}</dd>
          <dt>Contest</dt><dd>${detected.contestName || live.detected?.contestName || 'Not detected'}</dd>
          <dt>Duration</dt><dd>${elapsed}</dd>
          <dt>Status</dt><dd>${live.state || 'idle'}</dd>
          <dt>Events Sent</dt><dd>${live.eventsSent || 0}</dd>
          <dt>Queue</dt><dd>${live.queueDepth || 0}</dd>
        </dl>
        ${state.error ? `<p class="popup-error">${state.error.message || state.error}</p>` : ''}
        <label>
          <span>Codeforces handle</span>
          <input id="liveHandle" value="${live.userHandle || ''}" placeholder="tourist" ${isMonitoring ? 'disabled' : ''}>
        </label>
        <div class="popup-actions">
          <button id="startMonitoring" ${isMonitoring || !detected.supported ? 'disabled' : ''}>Start Monitoring</button>
          <button id="stopMonitoring" ${!isMonitoring ? 'disabled' : ''}>Stop Monitoring</button>
          <button id="reconnectMonitoring" ${!live.liveSessionId ? 'disabled' : ''}>Reconnect</button>
        </div>
      </section>
    `;
    this.root.querySelector('#startMonitoring')?.addEventListener('click', () => {
      this.handlers.onStart?.(this.root.querySelector('#liveHandle')?.value?.trim());
    });
    this.root.querySelector('#stopMonitoring')?.addEventListener('click', () => this.handlers.onStop?.());
    this.root.querySelector('#reconnectMonitoring')?.addEventListener('click', () => this.handlers.onReconnect?.());
  }
}
