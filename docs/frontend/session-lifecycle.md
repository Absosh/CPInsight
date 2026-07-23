# AI Coach Session Lifecycle

The AI Coach session model is UI state managed by `AiCoachWorkspaceProvider` and `aiCoachReducer`. Backend AI execution remains stateless from the workspace perspective; durable server-side conversation persistence is future work.

## Supported Operations

| Operation | Reducer action |
| --- | --- |
| Create session | `sessions/created` |
| Select or resume session | `sessions/selected` |
| Rename session | `sessions/renamed` |
| Archive session | `sessions/archived` |
| Delete session | `sessions/deleted` |
| Pin session | `sessions/pinned` |
| Search sessions | `workspace/searchChanged` |
| Filter sessions | `workspace/filterChanged` |

## Lifecycle

```mermaid
stateDiagram-v2
  [*] --> Active
  Active --> Pinned: pin
  Pinned --> Active: unpin
  Active --> Archived: archive
  Archived --> Active: select or resume
  Active --> Deleted: delete
  Archived --> Deleted: delete
  Deleted --> [*]
```

## Message Lifecycle

```mermaid
stateDiagram-v2
  [*] --> Queued
  Queued --> Streaming
  Streaming --> Completed
  Streaming --> Failed
  Streaming --> Aborted
  Failed --> Queued: retry
  Completed --> Queued: regenerate
```

## Persistence Boundary

Current session state is local to the React workspace. Server-side session history, saved reports, and cross-device continuation should be introduced through backend APIs before being treated as durable product data.
