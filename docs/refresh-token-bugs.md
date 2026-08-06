# Nuxt 3 Refresh Token Mechanism — Bug Report

> **Date:** 2026-08-05
> **Scope:** `nxt` server auth system — refresh token lifecycle
> **Files audited:**
> - `server/api/auth/refresh.post.ts` (explicit refresh)
> - `server/api/auth/login.post.ts` (token issuance)
> - `server/api/auth/logout.post.ts` (token revocation)
> - `server/middleware/auth.global.ts` (silent refresh + access validation)
> - `server/utils/jwt.ts` (token generation/verification)
> - `server/utils/security.ts` (session validation, blacklisting)
> - `server/models/Session.ts` (session model)
> - `server/models/TokenBlacklist.ts` (blacklist model)
> - `.env` (token configuration)
>
> **Reference:** `FASTIFY1/src/middleware/auth.middleware.ts` and `FASTIFY1/src/utils/security.ts`

---

## Process Flow

### 1. Login (`POST /api/auth/login`)

1. User submits email + password.
2. `User.findOne({ email })` — fetches user with populated firms.
3. Status checks: `pending` → 403, `suspended` → 403.
4. Account lock check: `isAccountLocked` + `accountLockedUntil`.
5. Password comparison: `user.comparePassword(password)`.
6. On success: `user.resetFailedLogins()`.
7. Suspicious activity detection: `detectSuspiciousActivity()`.
8. **Token generation:**
   - `deviceFingerprint = generateDeviceFingerprint(event)` — SHA-256 of UA + Accept-Language + Accept-Encoding.
   - `accessToken = generateAccessToken(user, deviceFingerprint)` — HS256, 15m expiry.
   - `refreshToken = generateRefreshToken(user, deviceFingerprint)` — HS512, 7d expiry.
9. **Session creation:**
   - `Session.create({ userId, refreshToken, deviceFingerprint, ipAddress, userAgent, deviceInfo, location, isActive: true, lastActivity, expiresAt })`.
10. Returns `{ user, accessToken, refreshToken }`.

### 2. Access Token Validation (every protected request)

1. `auth.global.ts` middleware intercepts all `/api/*` requests (except login/signup/refresh/health).
2. Extracts `Authorization: Bearer <token>` header.
3. Checks blacklist: `isTokenBlacklisted(token)`.
4. Verifies token: `verifyAccessToken(token)` — HS256, checks issuer/audience.
5. If `TOKEN_EXPIRED` → goes to silent refresh path (step 3).
6. Device fingerprint check: compares `decoded.deviceFingerprint` with current request fingerprint.
7. User status check: `pending` → 403, `suspended` → 403.
8. Account lock check: `isAccountLocked` + `accountLockedUntil`.
9. Attaches `decoded` to `event.context.user`.

### 3. Silent Refresh (in `auth.global.ts`, lines 150-226)

Triggered when `verifyAccessToken` throws `TOKEN_EXPIRED` AND the request includes `x-refresh-token` header.

1. Checks if refresh token is blacklisted.
2. Verifies refresh token signature: `verifyRefreshToken(refreshTokenValue)` — HS512.
3. Validates session: `validateSession(refreshTokenValue, event)` — checks expiry, device fingerprint, IP change.
4. Finds session: `Session.findOne({ refreshToken, userId, isActive: true })`.
5. Fetches user: `User.findById(decodedRefresh.id)`.
6. **Generates new access token:** `generateAccessToken(user, deviceFingerprint)`.
7. Sets `x-new-access-token` response header.
8. Attaches new decoded payload to `event.context.user`.
9. Returns — request proceeds with new access token.

**⚠️ Does NOT rotate the refresh token.**
**⚠️ Does NOT update session metadata (IP, userAgent, deviceInfo, location).**
**⚠️ Does NOT check user status (suspended) or account lock.**
**⚠️ Does NOT expose `x-new-access-token` via `Access-Control-Expose-Headers`.**

### 4. Explicit Refresh (`POST /api/auth/refresh`)

1. Client sends `{ refreshToken }` in request body.
2. Checks blacklist.
3. Verifies refresh token signature.
4. Validates session (same as silent refresh).
5. Finds session.
6. Fetches user — checks `user.status === 'suspended'`.
7. **Token rotation** (if `ROTATE_REFRESH_TOKEN=true` in .env):
   - Generates new refresh token.
   - Blacklists old refresh token.
   - Updates session with new refresh token and new expiry.
8. Updates session metadata (IP, userAgent, deviceInfo, location, lastActivity).
9. Saves session.
10. Logs security event.
11. Returns `{ accessToken, refreshToken }`.

### 5. Logout (`POST /api/auth/logout`)

1. Verifies refresh token.
2. Deactivates session (`isActive = false`, sets `revokedAt` + `revokedReason`).
3. Blacklists refresh token.
4. Blacklists current access token (if provided in Authorization header).
5. Returns success.

---

## Comparison with FASTIFY1

FASTIFY1 has a nearly identical refresh token mechanism. Both projects share the same architecture:

| Feature | nxt | FASTIFY1 |
|---------|-----|----------|
| Token type | Access + Refresh JWTs | Access + Refresh JWTs |
| Token expiry | 15m access / 7d refresh | 15m access / 7d refresh |
| Session tracking | MongoDB `Session` collection | MongoDB `Session` collection |
| Token blacklisting | `TokenBlacklist` collection | `TokenBlacklist` collection |
| Device fingerprinting | SHA-256 of UA headers | SHA-256 of UA headers (excludes IP) |
| Silent refresh | Yes (via `x-refresh-token` header) | Yes (via `x-refresh-token` header) |
| Token rotation | Yes (explicit refresh only) | No rotation at all |
| Account lock/suspend check in silent refresh | No | No |
| Session metadata update in silent refresh | No | No |
| CORS exposure of `x-new-access-token` | No | Yes (`Access-Control-Expose-Headers`) |
| Explicit refresh endpoint | Yes (`POST /api/auth/refresh`) | No |
| Security event logging | Yes | Yes |
| IP/device tracking | Yes (stored in Session) | Yes (stored in Session) |
| `validateSession` updates `lastActivity` | Yes | Yes |
| `blacklistToken` swallows errors | Yes | Yes |

**Key differences:**

1. **FASTIFY1 has no explicit refresh endpoint** — it relies solely on silent refresh via the `x-refresh-token` header. nxt has both silent refresh and an explicit `POST /api/auth/refresh` endpoint with rotation support.

2. **FASTIFY1 exposes `x-new-access-token` via CORS** — FASTIFY1 sets `Access-Control-Expose-Headers: x-new-access-token` (line 158), allowing the client to read the header in cross-origin requests. nxt does NOT set this header (line 209), meaning the client cannot read the new token in cross-origin scenarios.

3. **nxt has token rotation in explicit refresh** — When `ROTATE_REFRESH_TOKEN=true`, nxt's explicit refresh endpoint rotates the refresh token, blacklists the old one, and updates the session. FASTIFY1 has no rotation at all.

4. **Both share the same silent refresh bugs** — Neither project rotates the refresh token, updates session metadata, or checks account lock/suspend status during silent refresh.

---

## Summary

| ID | Severity | Title | File | Line(s) |
|----|----------|-------|------|---------|
| RT-B1 | CRITICAL | Silent refresh bypasses refresh token rotation | `auth.global.ts:150-226` | — |
| RT-B2 | CRITICAL | Silent refresh bypasses account lock/suspend checks | `auth.global.ts:195-215` | — |
| RT-B3 | HIGH | Silent refresh does not update session metadata | `auth.global.ts:195-215` | — |
| RT-B4 | HIGH | TOCTOU race condition in refresh token rotation | `refresh.post.ts:99-106` | — |
| RT-B5 | HIGH | Silent refresh does not expose new token via CORS headers | `auth.global.ts:209` | — |
| RT-B6 | MEDIUM | `blacklistToken` swallows errors silently | `security.ts:133` | — |
| RT-B7 | MEDIUM | No rate limiting on refresh attempts | `refresh.post.ts`, `auth.global.ts` | — |
| RT-B8 | MEDIUM | Explicit refresh does not check `user.isAccountLocked` | `refresh.post.ts:82` | — |
| RT-B9 | LOW | `isTokenBlacklisted` does not filter by expiry | `security.ts:110-113` | — |
| RT-B10 | LOW | Double session save in explicit refresh path | `security.ts:194` + `refresh.post.ts:117` | — |
| RT-B11 | LOW | `validateSession` parameter misnamed as `sessionId` | `security.ts:142` | — |
| RT-B12 | LOW | No session limit per user | `Session` model | — |

---

## CRITICAL Severity

### RT-B1 — Silent Refresh Bypasses Refresh Token Rotation

**File:** `server/middleware/auth.global.ts:150-226`
**Severity:** CRITICAL
**Impact:** A stolen refresh token can be used for silent refresh indefinitely, bypassing the rotation security policy.

When the access token expires and the client sends the `x-refresh-token` header, the `auth.global.ts` middleware generates a new access token but **does not rotate the refresh token** — even though `ROTATE_REFRESH_TOKEN=true` is set in `.env`.

Compare with the explicit refresh path in `refresh.post.ts:95-106`:
```typescript
const shouldRotate = process.env.ROTATE_REFRESH_TOKEN === 'true';
if (shouldRotate) {
  newRefreshToken = generateRefreshToken(user, deviceFingerprint);
  await blacklistToken(refreshToken, 'refresh', user._id.toString(), 'Token rotated', oldExp);
  session.refreshToken = newRefreshToken;
  session.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
}
```

The silent refresh path in `auth.global.ts` lines 196-214 generates only a new access token:
```typescript
const newAccessToken = generateAccessToken(user, deviceFingerprint);
setResponseHeader(event, 'x-new-access-token', newAccessToken);
```

No rotation, no blacklisting of the old refresh token, no session update.

**Attack scenario:**
1. Attacker steals a refresh token (e.g., via XSS or network sniffing).
2. Attacker includes the stolen refresh token in the `x-refresh-token` header on every request.
3. Each request triggers a silent refresh, generating a new access token.
4. The refresh token is never rotated, so the attacker can continue using it until it expires (7 days).
5. The rotation policy (`ROTATE_REFRESH_TOKEN=true`) is completely bypassed.

**FASTIFY1 comparison:** FASTIFY1's `auth.middleware.ts` has the same bug — its silent refresh path also does not rotate the refresh token. However, FASTIFY1 has no explicit refresh endpoint at all, so rotation is never triggered anywhere.

**Fix:** In the silent refresh path, when `ROTATE_REFRESH_TOKEN=true`, rotate the refresh token just like the explicit refresh path does:
```typescript
if (process.env.ROTATE_REFRESH_TOKEN === 'true') {
  const newRefreshToken = generateRefreshToken(user, deviceFingerprint);
  await blacklistToken(refreshTokenValue, 'refresh', decodedRefresh.id, 'Token rotated (silent)', oldExp);
  session.refreshToken = newRefreshToken;
  session.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await session.save();
}
```

---

### RT-B2 — Silent Refresh Bypasses Account Lock/Suspend Checks

**File:** `server/middleware/auth.global.ts:195-215`
**Severity:** CRITICAL
**Impact:** A suspended or locked user can still obtain new access tokens via silent refresh.

The silent refresh path fetches the user (`User.findById(decodedRefresh.id)`) but does **not** check `user.status` or `user.isAccountLocked`. This means:

- If a user's account is **suspended** after their access token was issued, they can still silently refresh to get new access tokens and continue accessing protected resources.
- If a user's account is **locked** (due to failed login attempts), they can still silently refresh.

The initial access token validation path (`auth.global.ts:96-117`) correctly checks both `user.status` and `user.isAccountLocked`, but the silent refresh path skips these checks entirely.

The explicit refresh path (`refresh.post.ts:82`) at least checks `user.status === 'suspended'`, but even it doesn't check `isAccountLocked`.

**FASTIFY1 comparison:** FASTIFY1's `auth.middleware.ts` has the exact same bug — its silent refresh path (lines 140-163) fetches the user but does not check `user.status` or `user.isAccountLocked`.

**Fix:** Add status and lock checks in the silent refresh path:
```typescript
if (user.status === 'suspended') {
  await blacklistToken(refreshTokenValue, 'refresh', decodedRefresh.id, 'User suspended', oldExp);
  throw createError({ statusCode: 401, statusMessage: 'Account suspended' });
}
if (user.isAccountLocked) {
  const lockedUntil = user.securitySettings?.accountLockedUntil;
  if (lockedUntil && new Date(lockedUntil) > new Date()) {
    throw createError({ statusCode: 403, statusMessage: 'Account locked' });
  }
}
```

---

## HIGH Severity

### RT-B3 — Silent Refresh Does Not Update Session Metadata

**File:** `server/middleware/auth.global.ts:195-215`
**Severity:** HIGH
**Impact:** Session tracking becomes stale during silent refreshes, making IP/device anomaly detection unreliable.

When a silent refresh occurs, the session's `lastActivity`, `ipAddress`, `userAgent`, `deviceInfo`, and `location` are **not updated**. Compare with the explicit refresh path (`refresh.post.ts:109-117`) which updates all these fields.

This means:
- The session's `lastActivity` becomes stale, making it impossible to detect idle sessions.
- IP address changes during silent refresh are not recorded, so the IP change detection in `validateSession` (which only warns, not blocks) becomes inaccurate.
- Device fingerprint changes are not captured — if a user switches devices, the silent refresh path would still work (since `validateSession` checks the fingerprint at the time of refresh, but doesn't update the stored fingerprint afterward).

**FASTIFY1 comparison:** FASTIFY1's `auth.middleware.ts` has the same bug — its silent refresh path (lines 139-163) does not update session metadata either.

**Fix:** Update session metadata in the silent refresh path, similar to the explicit refresh path:
```typescript
const clientIP = getRequestIP(event, { xForwardedFor: true }) || 'unknown';
const userAgent = getHeader(event, 'user-agent') || 'unknown';
session.ipAddress = clientIP;
session.userAgent = userAgent;
session.deviceInfo = parseDeviceInfo(userAgent);
session.location = getLocationFromIP(clientIP);
session.lastActivity = new Date();
await session.save();
```

---

### RT-B4 — TOCTOU Race Condition in Refresh Token Rotation

**File:** `server/api/auth/refresh.post.ts:99-106`
**Severity:** HIGH
**Impact:** A concurrent request using the old refresh token can bypass rotation and generate new tokens.

When `ROTATE_REFRESH_TOKEN=true`, the explicit refresh path performs these operations sequentially without a transaction:

1. **Line 101:** Blacklists the old refresh token.
2. **Line 104:** Updates the session with the new refresh token.
3. **Line 117:** Saves the session.

Between step 1 and step 2, if the same old refresh token is used in another concurrent request:
- The blacklist check (in `auth.global.ts:54` or `refresh.post.ts:33`) may not yet see the blacklisted entry (write not yet committed).
- The session lookup finds the session still active with the old token.
- A new token pair is generated, effectively creating a second concurrent session with the same refresh token.

This is a classic TOCTOU (Time of Check to Time of Use) vulnerability. An attacker who has stolen a refresh token and knows the user is actively refreshing could race the rotation to maintain access.

**FASTIFY1 comparison:** FASTIFY1 has no explicit refresh endpoint, so this bug is nxt-specific. However, FASTIFY1's silent refresh path has a similar TOCTOU issue if the same refresh token is used in concurrent requests (the session is found and a new access token is generated without any locking).

**Fix:** Use a MongoDB transaction to atomically blacklist the old token and update the session, or use an atomic operation that checks the refresh token in a single query.

---

### RT-B5 — Silent Refresh Does Not Expose New Token via CORS Headers

**File:** `server/middleware/auth.global.ts:209`
**Severity:** HIGH
**Impact:** Client cannot read the new access token from the response in cross-origin requests.

In the silent refresh path, nxt sets the new access token header:
```typescript
setResponseHeader(event, 'x-new-access-token', newAccessToken);
```

But it does NOT set `Access-Control-Expose-Headers` to expose the custom header to the client. Compare with FASTIFY1's `auth.middleware.ts` (lines 155-158):
```typescript
reply.header('x-new-access-token', newAccessToken);
reply.header('Access-Control-Expose-Headers', 'x-new-access-token');
```

Without `Access-Control-Expose-Headers`, browsers will block client-side JavaScript from reading the `x-new-access-token` header in cross-origin requests. The client will never receive the new access token, and silent refresh will appear to fail.

**Fix:** Add CORS exposure header in the silent refresh path:
```typescript
setResponseHeader(event, 'x-new-access-token', newAccessToken);
setResponseHeader(event, 'Access-Control-Expose-Headers', 'x-new-access-token');
```

---

## MEDIUM Severity

### RT-B6 — `blacklistToken` Swallows Errors Silently

**File:** `server/utils/security.ts:133`
**Severity:** MEDIUM
**Impact:** If blacklisting fails, the token remains usable but the caller has no indication.

```typescript
export const blacklistToken = async (...) => {
  try {
    await TokenBlacklist.create({...});
  } catch (error) {
    console.error('Failed to blacklist token:', error);
  }
};
```

The function catches all errors and only logs to console. In `refresh.post.ts:101`, the result of `blacklistToken` is not checked:
```typescript
await blacklistToken(refreshToken, 'refresh', user._id.toString(), 'Token rotated', oldExp);
```

If the blacklist write fails (e.g., duplicate key, DB error), the old refresh token remains valid. The caller has no way to know that the rotation was incomplete.

**FASTIFY1 comparison:** FASTIFY1's `blacklistToken` in `security.ts` has the exact same bug — it also swallows errors silently.

**Fix:** Either propagate the error or return a boolean indicating success/failure. At minimum, the `refresh.post.ts` should check the result and abort the rotation if blacklisting fails.

---

### RT-B7 — No Rate Limiting on Refresh Attempts

**File:** `server/api/auth/refresh.post.ts`, `server/middleware/auth.global.ts`
**Severity:** MEDIUM
**Impact:** An attacker can brute-force refresh tokens or perform unlimited silent refreshes.

Neither the explicit refresh endpoint nor the silent refresh middleware implements rate limiting. An attacker who has obtained a refresh token can:
- Use it for silent refresh on every request (no limit).
- Attempt to guess other users' refresh tokens (no limit).

**Fix:** Implement rate limiting on refresh endpoints (e.g., max 10 refreshes per session per hour).

---

### RT-B8 — Explicit Refresh Does Not Check `user.isAccountLocked`

**File:** `server/api/auth/refresh.post.ts:82`
**Severity:** MEDIUM
**Impact:** A locked account can still refresh tokens via the explicit refresh endpoint.

The explicit refresh path checks `user.status === 'suspended'` but does NOT check `user.isAccountLocked`. The initial access token validation path (`auth.global.ts:119-144`) does check both. This inconsistency means a locked account can still obtain new tokens through the explicit refresh endpoint.

**FASTIFY1 comparison:** FASTIFY1 has the same bug — its silent refresh path doesn't check `isAccountLocked` either.

**Fix:** Add `user.isAccountLocked` check in `refresh.post.ts:82`.

---

## LOW Severity

### RT-B9 — `isTokenBlacklisted` Does Not Filter by Expiry

**File:** `server/utils/security.ts:110-113`
**Severity:** LOW
**Impact:** Expired blacklist entries remain in the collection and are checked unnecessarily.

```typescript
export const isTokenBlacklisted = async (token: string): Promise<boolean> => {
  const blacklisted = await TokenBlacklist.findOne({ token });
  return !!blacklisted;
};
```

The function does not check whether the blacklist entry's `expiresAt` has passed. While the `TokenBlacklist` model has a TTL index (`index: { expires: 0 }` at line 16 of `TokenBlacklist.ts`), MongoDB's TTL cleanup runs periodically (every 60 seconds by default). During the window between expiry and cleanup, expired entries are still found by `isTokenBlacklisted`.

This is a minor correctness issue — an expired blacklisted token would be reported as still blacklisted.

**FASTIFY1 comparison:** FASTIFY1's `isTokenBlacklisted` has the exact same bug.

**Fix:** Add an expiry filter to the query:
```typescript
const blacklisted = await TokenBlacklist.findOne({
  token,
  expiresAt: { $gt: new Date() }
});
```

---

### RT-B10 — Double Session Save in Explicit Refresh Path

**File:** `server/utils/security.ts:194`, `server/api/auth/refresh.post.ts:117`
**Severity:** LOW
**Impact:** Two unnecessary database writes on every explicit refresh.

`validateSession()` (security.ts:193-194) updates `session.lastActivity` and calls `session.save()`. Then `refresh.post.ts:117` calls `session.save()` again after updating IP, userAgent, deviceInfo, and location. This results in two separate `save()` operations for a single refresh request.

**FASTIFY1 comparison:** FASTIFY1 has the same double-save pattern — `validateSession` saves the session, then the caller saves it again.

**Fix:** Remove the `lastActivity` update from `validateSession()` and handle it in the caller, or combine all updates into a single save.

---

### RT-B11 — `validateSession` Parameter Misnamed as `sessionId`

**File:** `server/utils/security.ts:142`
**Severity:** LOW
**Impact:** Confusing API — the parameter is named `sessionId` but it's actually a refresh token value.

```typescript
export const validateSession = async (
  sessionId: string,  // ← misleading name
  event: H3Event
): Promise<{ valid: boolean; reason?: string }> => {
  const session = await Session.findOne({ 
    refreshToken: sessionId,  // ← uses it as refreshToken
    isActive: true 
  });
```

The parameter is named `sessionId` but is used to query the `refreshToken` field. This is a naming inconsistency that could lead to future bugs.

**FASTIFY1 comparison:** FASTIFY1's `validateSession` has the exact same parameter naming issue.

**Fix:** Rename parameter to `refreshToken` or `token`.

---

### RT-B12 — No Session Limit Per User

**File:** `server/models/Session.ts`
**Severity:** LOW
**Impact:** A user can have unlimited concurrent active sessions, increasing the attack surface.

There is no maximum session limit enforced. A user could have hundreds of active sessions across different devices. The `revokeOtherSessions` and `revokeAllSessions` utility functions exist but are not called anywhere in the auth flow (except possibly from the frontend).

**Fix:** Add a configurable maximum session limit (e.g., 5 concurrent sessions) and enforce it during login.