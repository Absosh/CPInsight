(async () => {
  try {
    await import(chrome.runtime.getURL('content/observability-content.js'));
  } catch (error) {
    console.error('[CPInsight:Observability] Content bootstrap failed');
    console.error(`[CPInsight:Observability] ${error?.message || 'Unknown error'}`);
  }
})();
