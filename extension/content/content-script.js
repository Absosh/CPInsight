(async () => {
  const { AppConfig } = await import(chrome.runtime.getURL('config/defaults.js'));
  const verbose = Boolean(AppConfig.debug?.verbose);
  if (verbose) console.info('[CPInsight:Bootstrap] Bootstrap loaded');
  if (verbose) console.info('[CPInsight:Bootstrap] Content script bootstrap loaded');
  const moduleUrl = chrome.runtime.getURL('content/main.js');
  if (verbose) console.info('[CPInsight:Bootstrap] Importing content module');
  try {
    await import(moduleUrl);
    if (verbose) console.info('[CPInsight:Bootstrap] Content module imported');
  } catch (error) {
    console.error('[CPInsight:Bootstrap] Content module import failed');
    console.error('[CPInsight:Bootstrap] Stage name: Content module import');
    console.error(`[CPInsight:Bootstrap] Exception message: ${error?.message || 'Unknown error'}`);
    console.error(`[CPInsight:Bootstrap] Complete stack trace: ${error?.stack || 'No stack trace available'}`);
    throw error;
  }
})();
