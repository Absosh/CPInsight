# ADR-0011 Chrome Extension Architecture

## Status
Accepted

## Date
2026-07-22

## Context

The extension must interact with authenticated platform pages, survive Manifest V3 service worker suspension, and communicate between page, content, background, popup, and backend contexts.

## Decision

The extension uses:

- Manifest V3 background service worker for orchestration.
- Content scripts for page observation.
- Injected page runtime for LeetCode page-realm collection.
- Message Bus envelopes for structured runtime messaging.
- Chrome storage for durable state.
- Alarms for durable timeouts in legacy LeetCode collection.

## Consequences

Positive:

- The extension follows Chrome MV3 execution boundaries.
- Background orchestration is separated from page DOM parsing.
- Durable storage compensates for transient service workers.

Negative:

- Service worker lifecycle requires careful recovery logic.
- Content and page contexts require message validation.
- Manifest permissions must be maintained as collectors are added.

## Alternatives Considered

- Manifest V2 persistent background page: rejected because MV3 is the current Chrome extension model.
- All logic in content scripts: rejected because state and upload coordination would be duplicated per tab.
- Backend scraping: rejected because authenticated page state lives in the browser.

## Related Components

- Background service worker
- Content scripts
- Message Bus
- Observability SDK
- Legacy LeetCode provider

## References

- [Chrome Extension](../architecture/chrome-extension.md)
