Place optional one-time PostgreSQL initialization SQL files here.

Application schema migrations live in `backend/src/database/migrations` and should be applied with:

```bash
docker compose --profile tools run --rm migrate
```
