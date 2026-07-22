# Authentication API

Authentication routes are defined in `backend/src/routes/authRoutes.js`.

## Register

```http
POST /api/auth/register
```

Authentication: none.

Body:

```json
{
  "username": "alice",
  "email": "alice@example.com",
  "password": "Strongpass1"
}
```

Validation:

- `username`: alphanumeric, 3 to 32 chars.
- `email`: valid email, max 255 chars.
- `password`: 8 to 128 chars, must contain uppercase, lowercase, and numeric characters.

Success: `201 Created`.

Response:

```json
{
  "user": {
    "id": "uuid",
    "username": "alice",
    "email": "alice@example.com",
    "createdAt": "timestamp",
    "updatedAt": "timestamp"
  },
  "accessToken": "jwt",
  "refreshToken": "jwt",
  "refreshTokenId": "uuid"
}
```

Errors:

- `409`: email already registered.
- `400`: validation failure.

## Login

```http
POST /api/auth/login
```

Body:

```json
{
  "email": "alice@example.com",
  "password": "Strongpass1"
}
```

Success: `200 OK` with user, access token, refresh token, and refresh token id.

Errors:

- `401`: invalid email or password.
- `400`: validation failure.

## Refresh

```http
POST /api/auth/refresh
```

Body:

```json
{
  "refreshToken": "jwt"
}
```

Success: `200 OK`.

Response:

```json
{
  "user": {
    "id": "uuid",
    "username": "alice",
    "email": "alice@example.com"
  },
  "accessToken": "jwt",
  "refreshToken": "jwt"
}
```

Behavior:

- Verifies refresh JWT.
- Looks up active token hash in PostgreSQL.
- Issues a replacement refresh token in the same family.
- Revokes the previous token row.

## Logout

```http
POST /api/auth/logout
```

Body:

```json
{
  "refreshToken": "jwt"
}
```

Success: `204 No Content`.

Behavior: revokes the matching refresh token hash when provided.
