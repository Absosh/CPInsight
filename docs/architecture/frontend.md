# Frontend Architecture

The frontend is a static browser application. It is organized as HTML pages under `pages/`, shared styles under `css/`, and page-specific or shared JavaScript under `script/`.

## Responsibilities

- Present authentication, dashboard, analytics, calendar, comparison, profile, roadmap, and platform account views.
- Call backend APIs through shared JavaScript services.
- Store client auth state in browser-side state management utilities.
- Render analytics payloads from the backend.

The frontend does not compute durable analytics. It is a presentation layer over backend API responses.

## Structure

```text
pages/
  auth.html
  dashboard.html
  analytics.html
  calendar.html
  compare.html
  landing_page.html
  platforms.html
  profile.html
  roadmap.html
script/
  services/
  components/
  utils/
css/
  shared.css
  landing_page.css
```

## Component Model

```mermaid
flowchart TB
  Page["HTML page"] --> PageScript["Page script"]
  PageScript --> Services["API services"]
  PageScript --> Components["Reusable UI components"]
  Services --> HttpClient["HTTP client"]
  HttpClient --> Backend["Express API"]
  PageScript --> State["State manager"]
```

## API Interaction

Frontend services call backend endpoints documented in [API Reference](../api/README.md). Authentication-protected routes require a bearer access token. Token refresh is part of the authentication service flow documented in [Authentication](authentication.md).

## Design Constraints

- The frontend should not directly query PostgreSQL or Redis.
- The frontend should not contain platform scraping logic.
- Platform data displayed in analytics views should come from backend analytics responses.
- Extension telemetry and content-script behavior belong in `extension/`, not frontend pages.

## Future Direction

If the frontend is migrated to a component framework, the architectural boundary should remain the same: UI components call service modules, service modules call the backend, and domain persistence remains server-side.
