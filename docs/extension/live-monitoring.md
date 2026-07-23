# Extension Live Monitoring

The extension live monitoring layer lets an authenticated user start a Codeforces contest monitoring session from the browser extension popup.

## Flow

```mermaid
sequenceDiagram
  participant User
  participant Popup
  participant Background
  participant CF as Codeforces API
  participant API as CPInsight API

  User->>Popup: Start Monitoring
  Popup->>Background: liveMonitoring:start
  Background->>Background: detect active Codeforces contest URL
  Background->>API: POST /api/telemetry/session/start
  API-->>Background: liveSessionId, telemetrySessionId, sessionToken
  Background->>CF: user.status and contest.standings
  Background->>Background: diff snapshot
  Background->>API: POST /api/telemetry/events
  Background->>API: POST /api/telemetry/session/heartbeat
  User->>Popup: Stop Monitoring
  Popup->>Background: liveMonitoring:stop
  Background->>API: POST /api/telemetry/session/stop
```

## Supported Platform

Implemented:

- Codeforces contest and gym URLs.

Designed extension points:

- CodeChef collector can add a platform detector and API poller.
- LeetCode Contest can add a detector and official/source-approved polling adapter.

## Popup UI

The popup displays:

- connection state;
- contest detection status;
- contest name;
- elapsed duration;
- monitoring status;
- events sent;
- queue depth;
- connection health;
- Codeforces handle input;
- Start Monitoring, Stop Monitoring, and Reconnect buttons.

## Event Collection Boundary

The live SDK collects only contest telemetry:

- session lifecycle;
- problem and submission metadata;
- verdict transitions;
- rank changes;
- heartbeat and connection status.

It does not collect keyboard contents, clipboard, passwords, cookies, private messages, full page text, or unrelated browsing history.

## Official API Usage

Codeforces polling uses:

- `user.status`
- `contest.standings`

Verdicts are not scraped from HTML when the official API is available.

## Offline Support

Events are written to `chrome.storage.local` under `liveMonitoring.queue`. Upload retries preserve ordering by retaining unacknowledged events and removing only acknowledged event IDs.
