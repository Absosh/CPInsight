# CPInsight Browser Extension Architecture

This extension is a Manifest V3 Chrome extension that securely collects authenticated platform data for CPInsight.

Prompt 1 establishes architecture only. It does not scrape, intercept, upload, or synchronize data.

## Directory Responsibilities

- `background/`: MV3 service worker, lifecycle hooks, provider registration, message routing, orchestration entry points.
- `content/`: page-state detection, DOM observation shell, bridge between extension and injected page scripts.
- `injected/`: page-context bootstrap used by future provider scripts to access `window`, `fetch`, `XMLHttpRequest`, and runtime objects.
- `popup/`: popup controller/view/state/message boundaries. UI implementation is intentionally minimal.
- `providers/`: provider-based integrations. Core does not know provider internals.
- `core/`: provider registry, lifecycle coordinator, centralized state store, sync orchestrator shell.
- `storage/`: typed abstraction over `chrome.storage`.
- `network/`: fetch abstraction for future backend/API calls with timeout and cancellation hooks.
- `messaging/`: typed message envelopes, routing, Chrome runtime wrappers, page bridge helpers.
- `types/`: shared JSDoc typedefs for contracts.
- `utils/`: logging, error normalization, environment helpers, ID/time utilities.
- `constants/`: message types, storage keys, alarms, provider IDs.
- `config/`: centralized URLs, flags, timeout/retry/batch settings, provider registration.
- `assets/`: extension visual assets.

## Permission Justification

- `storage`: stores minimal extension state, settings, provider metadata, checkpoints, and future sync cursors.
- `alarms`: schedules future retry/sync orchestration in the service worker.
- `host_permissions: https://leetcode.com/*`: enables the initial LeetCode content script and future authenticated collection on LeetCode only.

No broad host permissions, cookies, tabs, webRequest, or scripting permissions are requested in Prompt 1.
