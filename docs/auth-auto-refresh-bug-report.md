# nxt Authentication Auto-Refresh Bug Report

> **Date:** 2026-08-06
> **Scope:** Client-side automatic token refresh + server-side silent refresh in nxt
> **Bug:** User is logged out after idle period instead of being silently refreshed

---

## Authentication Architecture Overview

The nxt app uses a dual-token JWT authentication system:

1. **Access Token** — HS256, 15-minute expiry, sent in `Authorization: Bearer` header
2. **Refresh Token** — HS512, 7-day expiry, sent in `x-refresh-token` header

**Server-side silent refresh:** When an access token expires, the Nitro server middleware (`server/middleware/auth.global.ts`) intercepts the 401, validates the refresh token from the `x-refresh-token` header, and returns a new access token via the `x-new-access-token` response header.

**Client-side auto refresh:** The client composable (`app/composables/useAuth.ts`) schedules a timer to proactively call `POST /api/auth/refresh` before the access token expires.

**401 retry logic:** The client's `apiFetch` function catches 401 errors, calls `rotateToken()` to get new tokens, and retries the original request.

---

## Files Analyzed

- `server/middleware/auth.global.ts` — Server middleware: access token validation + silent refresh
- `server/api/auth/refresh.post.ts` — Explicit refresh endpoint
- `server/api/auth/login.post.ts` — Login flow + token issuance
- `server/api/auth/logout.post.ts` — Logout flow
- `server/utils/jwt.ts` — Token generation and verification
- `server/utils/security.ts` — Session validation, blacklisting, device fingerprinting
- `server/models/Session.ts` — Session model
- `server/models/TokenBlacklist.ts` — Blacklist model
- `app/composables/useAuth.ts` — Client auth state, token scheduling, 401 retry
- `app/utils/api.ts` — Raw fetch wrapper with `x-new-access-token` header handling
- `app/middleware/auth.ts` — Route guard (redirects unauthenticated users)
- `app/middleware/auth.global.ts` — Global route middleware
- `server/middleware/security.global.ts` — Rate limiting for auth endpoints
- `.env` — Token configuration

---

## Current Authentication Flow

### 1. Login

1. Client calls `POST /api/auth/login` with email + password.
2. Server validates credentials, checks status/lock/suspension.
3. Server generates access token (15m) + refresh token (7d) with device fingerprint.
4. Server creates a `Session` record with `isActive: true`, `expiresAt` = now + 7 days.
5. Server returns `{ user, accessToken, refreshToken }`.
6. Client stores tokens in cookies + localStorage via `setAuth()`.
7. Client schedules auto-refresh timer via `scheduleTokenRefresh(accessToken)`.

### 2. Protected API Request (token valid)

1. Client sends `Authorization: Bearer <accessToken>` + `x-refresh-token: <refreshToken>`.
2. Server middleware validates access token, checks blacklist, validates device fingerprint.
3. Server checks user status + account lock.
4. Request proceeds with `event.context.user` populated.

### 3. Silent Refresh (server-side, access token expired)

1. Client sends expired access token + `x-refresh-token` header.
2. Server middleware catches `TOKEN_EXPIRED` from `verifyAccessToken`.
3. Server validates refresh token signature via `verifyRefreshToken`.
4. Server calls `validateSession(refreshToken, event)` — checks session exists, not expired, device fingerprint matches.
5. Server fetches user, generates **new access token only**.
6. Server sets `x-new-access-token` response header.
7. Request proceeds with new access token payload in `event.context.user`.

**Critical:** No rotation of refresh token. No session metadata update. No user status/lock check.

### 4. Explicit Refresh (client-side scheduled)

1. Client timer fires → calls `rotateToken()`.
2. Client calls `POST /api/auth/refresh` with `{ refreshToken }`.
3. Server validates refresh token, session, user status.
4. If `ROTATE_REFRESH_TOKEN=true`, generates new refresh token, blacklists old one, updates session.
5. Server returns `{ accessToken, refreshToken }`.
6. Client updates stored tokens, reschedules timer.

### 5. 401 Retry (client-side error recovery)

1. API request returns 401.
2. Client calls `rotateToken()` to get fresh tokens.
3. If successful, retries original request with new `Authorization` header.
4. If failed, calls `logout()` → redirects to `/login`.

### 6. Logout

1. Client calls `POST /api/auth/logout` with refresh token.
2. Server deactivates session, blacklists both tokens.
3. Client clears all auth state from cookies, localStorage, refs.

---

## Potential Causes Identified So Far

### A. Server-side silent refresh returns 401 → client treats as logout

In `auth.global.ts`, the silent refresh path is inside the `catch` block of `verifyAccessToken`. If **any** step in the silent refresh path throws, the error falls through to the outer catch at line 229, which returns a generic 401:

```typescript
throw createError({
  statusCode: 401,
  statusMessage: 'Unauthorized: Invalid or expired token'
});
```

This 401 reaches the client's `apiFetch` catch block, which calls `rotateToken()` → explicit refresh endpoint. If the explicit refresh also fails, `logout()` is called.

### B. `x-new-access-token` header not exposed via CORS

Server sets `x-new-access-token` but does NOT set `Access-Control-Expose-Headers`. In cross-origin requests, browsers block client JS from reading this header. The client's `apiFetch` never sees the new token, and the request proceeds with the expired token payload.

### C. Client 401 retry race condition

If multiple concurrent requests get 401 simultaneously, they all call `rotateToken()`. The `refreshPromise` deduplication in `useAuth.ts` prevents duplicate refresh calls, but there's a timing issue — the first 401 may trigger logout before the refresh completes.

### D. Silent refresh doesn't rotate refresh token

If `ROTATE_REFRESH_TOKEN=true`, the silent refresh path doesn't rotate the refresh token. But this alone wouldn't cause logout — it would just mean the old refresh token stays valid.

### E. Silent refresh doesn't check user status/lock

If a user is suspended/locked after login, silent refresh still works. This is a security bug but doesn't explain the logout scenario.

---

## Next Investigation Steps

1. Verify if `x-new-access-token` header is actually readable by the client in cross-origin scenarios
2. Trace the exact error path when silent refresh fails — does it return 401 or succeed?
3. Check if `validateSession` failures are common (fingerprint mismatch, session expired)
4. Check if the client's 401 retry correctly handles the silent refresh response
5. Identify whether the bug is in silent refresh failure handling or client retry logic
