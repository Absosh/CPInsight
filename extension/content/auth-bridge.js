(async function bridgeCpInsightAuth() {
  try {
    const accessToken = window.localStorage.getItem('accessToken');
    const refreshToken = window.localStorage.getItem('refreshToken');
    if (!accessToken && !refreshToken) return;

    const patch = {};
    if (accessToken) patch['cpinsight.accessToken'] = accessToken;
    if (refreshToken) patch['cpinsight.refreshToken'] = refreshToken;
    await chrome.storage.local.set(patch);
  } catch (_error) {
    // Authentication is optional for page loading; upload will fail with 401 if no token is available.
  }
})();
