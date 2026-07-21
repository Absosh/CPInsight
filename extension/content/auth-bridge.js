(async function bridgeCpInsightAuth() {
  try {
    const accessToken = window.localStorage.getItem('accessToken');
    if (!accessToken) return;

    await chrome.storage.local.set({
      'cpinsight.accessToken': accessToken
    });
  } catch (_error) {
    // Authentication is optional for page loading; upload will fail with 401 if no token is available.
  }
})();
