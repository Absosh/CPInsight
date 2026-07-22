# Contest Session Sequence

This sequence documents implemented Codeforces and CodeChef contest-session detection through the Observability SDK.

```mermaid
sequenceDiagram
  participant Page
  participant Content as Observability Content Script
  participant Collector as Platform Collector
  participant Background as Service Worker
  participant SDK as Observability SDK
  participant Store as Chrome Storage

  Page->>Content: Page lifecycle event
  Content->>Collector: supports(current URL)
  Collector-->>Content: true
  Content->>Collector: collect(document, url)
  Collector-->>Content: Generic page context
  Content->>Background: observability:page:snapshot
  Background->>SDK: handlePageSnapshot(snapshot)
  SDK->>Store: Read session and tab index
  SDK->>SDK: Create or resume session
  SDK->>SDK: Emit standardized event
  SDK->>Store: Persist session, event, queue
```

Only one active session is created per collector and contest id. Additional tabs attach to the same session.
