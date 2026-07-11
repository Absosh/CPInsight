# CPInsight Backend

Production-grade Node.js, Express, PostgreSQL, and Redis backend for CPInsight.

## Run locally

```bash
cp .env.example .env
npm install
npm run migrate
npm run dev
```

With Docker:

```bash
docker compose up --build
```

## Core APIs

Auth:
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`

User:
- `GET /api/user/profile`
- `PATCH /api/user/profile`

Platforms:
- `POST /api/platforms/connect`
- `DELETE /api/platforms/disconnect`
- `GET /api/platforms/accounts`

Analytics:
- `GET /api/analytics/codeforces`
- `GET /api/analytics/codechef`
- `GET /api/analytics/leetcode`
- `GET /api/analytics/combined`

See `docs/ARCHITECTURE.md` for the implementation design, database model, sync strategy, Redis TTLs, scoring formulas, and production checklist.
