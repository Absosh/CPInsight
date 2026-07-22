# Extension Authentication Sequence

The extension uses the same bearer-token model as the frontend for protected backend APIs.

```mermaid
sequenceDiagram
  participant Extension
  participant API
  participant AuthMiddleware as authenticate middleware
  participant Token as token utils
  participant Users as userRepository

  Extension->>API: Protected request with Authorization header
  API->>AuthMiddleware: Execute middleware
  AuthMiddleware->>Token: verifyAccessToken(token)
  Token-->>AuthMiddleware: decoded subject
  AuthMiddleware->>Users: findById(sub)
  Users-->>AuthMiddleware: user
  AuthMiddleware->>API: req.user attached
  API->>API: Controller executes
  API-->>Extension: Authenticated response
```

The current LeetCode extension upload endpoint uses this flow. Observability SDK events are not uploaded to the backend yet.
