# Auth & Session System — Critical Issues & Fixes

> **Generated:** 2026-08-30  
> **Scope:** Complete analysis of the idle-browser auto-logout problem when `ROTATE_REFRESH_TOKEN=true`.  
> **Constraint:** Every issue is traced to **exact code** — zero assumptions.  
> **Key fact from testing:** `ROTATE_REFRESH_TOKEN=false` → session survives idle. `ROTATE_REFRESH_TOKEN=true` → user auto-logged-out after idle.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [The Core Problem — What Happens Step-by-Step](#2-the-core-problem)
3. [ISSUE-1: rotateToken() Destructively Calls logout() on ANY 401 — Permanently Kills Server Session](#issue-1)
4. [ISSUE-2: TOKEN_EXPIRED Error Handling Has Silent Fall-Through to 401](#issue-2)
5. [ISSUE-3: Rotation DB Errors Lack statusCode — Fall Through as Generic 401](#issue-3)
6. [ISSUE-4: No Proactive Client-Side Token Refresh on Visibility Change](#issue-4)
7. [ISSUE-5: Cooldown Branch session.save() While Rotation Is True — Potential Race](#issue-5)
8. [ISSUE-6: Self-Heal Fingerprint Mismatch After Browser Auto-Update During Sleep](#issue-6)
9. [ISSUE-7: In-Memory Rate Limiter Resets on Vercel Cold Start](#issue-7)
10. [Summary Fix Matrix](#summary-fix-matrix)

---

## 1. Architecture Overview

```
+---------------------------------------------------------------------+
|                         BROWSER (Client)                            |
|                                                                     |
|  app/middleware/auth.global.ts  -->  useAuth().initAuth()           |
|       |                                |                            |
|       |                       /api/auth/me (with HttpOnly cookies)  |
|       |                                |                            |
|       |                     401? --> rotateToken()                   |
|       |                                |                            |
|       |                       /api/auth/refresh (POST)              |
|       |                                |                            |
|       +-- navigateTo('/login') if still fails                       |
|                                                                     |
|  No visibility/focus listener.  No periodic timer.  No keepalive.  |
+---------------------------------------------------------------------+
                              | HttpOnly Cookies
                              v
+---------------------------------------------------------------------+
|                   SERVER (Nitro on Vercel)                           |
|                                                                     |
|  server/middleware/auth.global.ts                                   |
|       |                                                             |
|       +-- Has access_token cookie? --> verifyAccessToken()          |
|       |       +-- TOKEN_EXPIRED? --> performTokenRefresh()          |
|       |                                                             |
|       +-- No access_token but has refresh_token?                    |
|       |       +-- performTokenRefresh()                             |
|       |                                                             |
|       +-- Neither? --> 401                                          |
|                                                                     |
|  server/services/authService.ts::performTokenRefresh()              |
|       |                                                             |
|       +-- Verify refresh JWT                                        |
|       +-- Find active Session in MongoDB                            |
|       +-- ROTATE_REFRESH_TOKEN=true?                                |
|       |       +-- CAS lock (findOneAndUpdate)                       |
|       |       +-- Winner: generate new token + update session       |
|       |       +-- Loser: poll + return access-only                  |
|       |       +-- Cooldown (<15s): session.save() only              |
|       +-- ROTATE_REFRESH_TOKEN=false?                               |
|       |       +-- session.save() only (simple, reliable)            |
|       +-- Return { accessToken, refreshToken, isLockLoser }        |
+---------------------------------------------------------------------+
```

### Current Config (`.env`):
```
ACCESS_TOKEN_EXPIRY=15m
REFRESH_TOKEN_EXPIRY=30d
ROTATE_REFRESH_TOKEN=false    <-- Currently OFF (sessions survive idle)
```

### Why `false` Works and `true` Breaks

| Aspect | `ROTATE_REFRESH_TOKEN=false` | `ROTATE_REFRESH_TOKEN=true` |
|--------|-------|------|
| DB operations in `performTokenRefresh` | 2 (findOne + save) | 4-5 (findOne + CAS lock + token gen + update + lock release) |
| Token value changes | Never | Every refresh outside cooldown |
| Cookie must be re-set | No (same token, existing cookie is fine) | Yes (new token, MUST set new cookie) |
| CAS lock used | No | Yes (can fail, add latency) |
| Failure probability on Vercel cold start | Low | Higher (more round trips to MongoDB Atlas) |
| If rotation DB op throws | N/A | Error has no `statusCode` → falls through to generic 401 |

---

## 2. The Core Problem

**User Scenario:**
1. User logs in → `access_token` (15min cookie) + `refresh_token` (30d cookie)
2. User works actively → rotations happen every ~15min (when `true`)
3. User goes idle for hours (laptop sleep / tab backgrounded)
4. User wakes up → access_token cookie has expired (maxAge=15min)
5. **Expected:** Server middleware auto-refreshes using refresh_token → session alive
6. **Actual (with rotation=true):** User gets redirected to `/login?reason=session_expired`

### The Kill Chain (rotation=true)

Here is the exact step-by-step of what goes wrong:

```
STEP 1: Browser wakes up, user navigates
  --> app/middleware/auth.global.ts runs
  --> calls initAuth() --> calls /api/auth/me
  --> Browser sends: NO access_token cookie (expired), YES refresh_token cookie

STEP 2: Server middleware (auth.global.ts line 39)
  --> token = undefined (no access_token cookie)
  --> refreshTokenValue = getCookie('refresh_token') --> has value
  --> calls performTokenRefresh(refreshTokenValue, event)

STEP 3: performTokenRefresh (authService.ts)
  --> verifyRefreshToken --> OK (JWT is valid, < 30d old)
  --> Session.findOne --> OK (session found, active)
  --> shouldRotate = true, isWithinCooldown = false (hours since last rotation)
  --> CAS lock: Session.findOneAndUpdate (line 217-229)
      --> This is a cold-start Vercel function
      --> MongoDB Atlas connection being established
      --> Round trip to MongoDB for CAS lock
      --> Round trip for token update (line 270-288)
  
  IF ANY DB OPERATION THROWS (timeout, connection reset):
    --> catch (rotationError) at line 295
    --> Release lock (best-effort)
    --> throw rotationError  <-- This is a MongoDB Error, NOT an H3 createError

STEP 4: Server middleware catches the error (line 76-82)
  --> refreshError = MongoDB Error (e.g., MongoTimeoutError)
  --> refreshError.statusCode = undefined  <-- MongoDB errors don't have this
  --> throw createError({ statusCode: refreshError.statusCode || 401 })
  --> Throws 401 to client

STEP 5: Client initAuth() catches 401 (useAuth.ts line 83-84)
  --> status === 401 --> calls rotateToken({ redirectIfFailed: false })

STEP 6: rotateToken() calls /api/auth/refresh (useAuth.ts line 159)
  --> Server: performTokenRefresh again with SAME token
  --> May fail again for same reason
  --> OR may succeed if cold start is over
  
  IF FAILS AGAIN (401):
    --> rotateToken catch block (line 172)
    --> status === 401 --> calls logout({ redirect: false, reason: 'session_expired' })

STEP 7: logout() DESTROYS THE SESSION (useAuth.ts line 248-258)
  --> $fetch('/api/auth/logout', { method: 'POST' })
      --> Server: clears cookies (maxAge=0)
      --> Server: session.isActive = false
      --> Server: blacklists the refresh token
  --> user.value = null
  
  *** SESSION IS NOW PERMANENTLY DEAD ***
  *** Even if the next retry would have succeeded ***

STEP 8: Client middleware (app/middleware/auth.global.ts)
  --> isAuthenticated = false
  --> navigateTo('/login')
```

### Why This Doesn't Happen With `false`

With `ROTATE_REFRESH_TOKEN=false`, step 3 takes the simple `else` branch (line 328-336):
```typescript
session.lastActivity = new Date();
session.expiresAt = new Date(Date.now() + SESSION_TTL_MS);
await session.save();
```

This is a single `save()` — one DB round trip instead of 3-4. It's much less likely to fail on a Vercel cold start. And even if it DID fail, the same destructive logout chain would trigger — but the probability is far lower.

---

## ISSUE-1: `rotateToken()` Destructively Calls `logout()` on ANY 401 — Permanently Kills Server Session

> **SEVERITY: CRITICAL — This is the #1 root cause**

### Root Cause

**File:** `app/composables/useAuth.ts` lines 171-182

```typescript
// rotateToken() catch block
if (status === 401 || status === 403) {
  // Provide reason for logout
  let reason = 'session_expired';
  if (errorMsg.includes('deactivated') || errorMsg.includes('Exceeded maximum')) {
    reason = 'session_limit';
  }
  
  logout({ redirect: options.redirectIfFailed, reason });  // <-- DESTRUCTIVE!
}
throw e;
```

When `rotateToken()` is called from `initAuth()` with `{ redirectIfFailed: false }`, the intent is: *"try to refresh, if it fails just leave user.value as null — don't destroy anything."*

But `logout()` at line 248-258 **ALWAYS fires `/api/auth/logout`** regardless of `redirect` value:

```typescript
const logout = (options?: ...) => {
  const now = Date.now();
  if (import.meta.client && !logoutInFlight && (now - lastLogoutTime > LOGOUT_COOLDOWN_MS)) {
    logoutInFlight = true;
    lastLogoutTime = now;
    $fetch('/api/auth/logout', {   // <-- ALWAYS fires
      method: 'POST',
      credentials: 'include'
    }).catch(() => {}).finally(() => { logoutInFlight = false; });
  }

  user.value = null;               // <-- ALWAYS clears
  // ...
};
```

And `/api/auth/logout` (`server/api/auth/logout.post.ts` lines 50-66) permanently destroys the session:

```typescript
if (session) {
  session.isActive = false;          // Deactivated
  session.revokedAt = new Date();
  session.revokedReason = 'User logout';
  await session.save();
}
// Blacklist the refresh token
await blacklistToken(refreshToken, 'refresh', decoded.id, 'User logout', refreshExp);
```

**After this, there is ZERO recovery.** The session is deactivated AND the token is blacklisted. Even if the MongoDB connection recovers 1 second later, the user must log in again.

### Walkthrough Example

```
T+0:        User logs in (ROTATE_REFRESH_TOKEN=true)
T+6h:       User wakes laptop from sleep
             --> Vercel function cold-starts
             --> MongoDB connection takes 3s to establish
             --> CAS lock findOneAndUpdate times out (or succeeds but update fails)
             --> performTokenRefresh throws MongoTimeoutError
             --> Middleware wraps as 401
             
             --> initAuth catches 401, calls rotateToken({ redirectIfFailed: false })
             --> rotateToken calls /api/auth/refresh --> same timeout --> 401
             --> rotateToken catches 401 --> calls logout()
             --> logout fires /api/auth/logout --> SESSION DESTROYED
             --> user.value = null --> redirected to /login?reason=session_expired

T+6h+5s:    MongoDB is now fully connected (cold start complete)
             --> But session is already deactivated + token blacklisted
             --> User MUST log in again
```

### Fix

**`rotateToken()` must NOT call `logout()` when `redirectIfFailed === false`.** The caller (`initAuth`) just wants the attempt — it handles the failure itself by setting `user.value = null`.

```diff
 // useAuth.ts rotateToken() catch block (line 171-182)
 if (status === 401 || status === 403) {
-  let reason = 'session_expired';
-  if (errorMsg.includes('deactivated') || errorMsg.includes('Exceeded maximum')) {
-    reason = 'session_limit';
-  }
-  logout({ redirect: options.redirectIfFailed, reason });
+  // Only trigger destructive server-side logout when the caller explicitly
+  // wants it. When called from initAuth (redirectIfFailed=false), the intent
+  // is "try but don't destroy" — let initAuth set user.value=null itself.
+  if (options.redirectIfFailed !== false) {
+    let reason = 'session_expired';
+    if (errorMsg.includes('deactivated') || errorMsg.includes('Exceeded maximum')) {
+      reason = 'session_limit';
+    }
+    logout({ redirect: true, reason });
+  }
 }
 throw e;
```

**Where:** `app/composables/useAuth.ts` lines 171-182

---

## ISSUE-2: TOKEN_EXPIRED Error Handling Has Silent Fall-Through to 401

> **SEVERITY: HIGH**

### Root Cause

**File:** `server/middleware/auth.global.ts` lines 220-232

There are two paths in the server middleware where `performTokenRefresh` is called:

**Path A — No access_token (line 39-82):** After idle, browser has no access_token cookie. This path is clean — if performTokenRefresh throws, the error is re-thrown with its statusCode.

**Path B — TOKEN_EXPIRED (line 184-232):** There's a ~1-second window where the access_token cookie exists but its JWT `exp` has passed (cookie `maxAge` lags behind JWT `exp`). This path has a BUG:

```typescript
} catch (refreshError: any) {
    if (refreshError.statusCode) {
        throw refreshError;              // Known auth error → re-thrown ✅
    }
    await logSecurityEvent({...});
    // *** FALLS THROUGH — NO throw, NO return! ***
}
// ... falls through to:
throw createError({
    statusCode: 401,
    statusMessage: 'Unauthorized: Invalid or expired token'
});
```

When `performTokenRefresh` throws a MongoDB error (no `statusCode` property), the code logs the event and **silently falls through** to the generic 401. The original error details are lost.

Compare with Path A (line 76-82):
```typescript
} catch (refreshError: any) {
    throw createError({
        statusCode: refreshError.statusCode || 401,
        statusMessage: refreshError.statusMessage || 'Unauthorized: Token refresh failed'
    });
}
```

Path A always throws immediately — no fall-through. **Path B silently swallows the error.**

### Why This Matters With rotation=true

With rotation=true, `performTokenRefresh` does 3-4 MongoDB operations. If the rotation's CAS lock or update throws a MongoDB error (MongoTimeoutError, MongoServerError), these errors do NOT have a `statusCode` property. In Path B:

1. `refreshError.statusCode` = `undefined` → condition is false
2. Security event is logged
3. Code falls through to the generic `throw createError({ statusCode: 401 })`
4. Client receives 401 → `rotateToken()` → `logout()` → session destroyed

With rotation=false, there's only a single `session.save()` — much less likely to throw. And even if it throws in Path B, the same fall-through happens — but the probability is far lower.

### Fix

Path B's catch block should match Path A — always throw immediately:

```diff
 // server/middleware/auth.global.ts lines 220-231
 } catch (refreshError: any) {
-    if (refreshError.statusCode) {
-        throw refreshError;
-    }
-    await logSecurityEvent({
-        action: 'invalid_token',
-        event,
-        metadata: { reason: 'Refresh token validation failed', error: String(refreshError) },
-        severity: 'medium'
-    });
+    // Always re-throw immediately — don't fall through to the generic 401.
+    // Log the event, then throw the specific error or a 401.
+    await logSecurityEvent({
+        action: 'invalid_token',
+        event,
+        metadata: { reason: 'Refresh token validation failed', error: String(refreshError) },
+        severity: 'medium'
+    }).catch(() => {}); // Don't let logging failure mask the original error
+    throw refreshError.statusCode
+        ? refreshError
+        : createError({
+            statusCode: 401,
+            statusMessage: refreshError.message || 'Unauthorized: Token refresh failed'
+        });
 }
```

**Where:** `server/middleware/auth.global.ts` lines 220-231

> [!NOTE]
> This fix doesn't prevent the 401 — it just ensures the error is properly thrown instead of silently falling through. The real prevention is ISSUE-1 (don't destructively logout on 401).

---

## ISSUE-3: Rotation DB Errors Lack `statusCode` — Fall Through as Generic 401

> **SEVERITY: HIGH**

### Root Cause

**File:** `server/services/authService.ts` lines 295-302

When the rotation's DB operations fail, the error is a raw MongoDB/Mongoose error:

```typescript
} catch (rotationError) {
    // Release lock immediately on ANY failure
    await Session.updateOne(
        { _id: session._id },
        { $set: { refreshLockedUntil: null } }
    ).catch(() => {});
    throw rotationError;  // <-- Raw MongoError, no statusCode
}
```

`rotationError` is a `MongoTimeoutError`, `MongoServerError`, or similar. These have:
- `rotationError.name` = `"MongoTimeoutError"`
- `rotationError.code` = MongoDB error code (number)
- `rotationError.statusCode` = `undefined` ← NOT an H3 property

When this error reaches the middleware, it's treated as "unknown error" → wrapped in generic 401 → client sees 401 → destructive logout chain.

### Why This Matters

The rotation path (CAS lock + update) makes **3 MongoDB round trips** that can each fail:
1. `Session.findOneAndUpdate` for CAS lock (line 217)
2. `Session.findOneAndUpdate` for token update (line 270) OR self-heal update (line 240)
3. Lock release on failure (line 297-300, best-effort)

On Vercel cold starts, each round trip to MongoDB Atlas includes:
- DNS resolution for the MongoDB SRV record
- TLS handshake
- MongoDB driver connection pooling
- Actual query execution

With `ROTATE_REFRESH_TOKEN=false`, there's only **1 round trip** (`session.save()` at line 335).

### Fix

Wrap rotation errors with proper H3 status codes before re-throwing:

```diff
 // authService.ts lines 295-302
 } catch (rotationError) {
     await Session.updateOne(
         { _id: session._id },
         { $set: { refreshLockedUntil: null } }
     ).catch(() => {});
-    throw rotationError;
+    // Wrap DB errors with a 503 (Service Unavailable) instead of letting them
+    // fall through as generic 401. This tells the client "retry later" instead
+    // of "your session is dead."
+    throw createError({
+        statusCode: 503,
+        statusMessage: 'Service temporarily unavailable: Token rotation failed, please retry'
+    });
 }
```

And update the client's `rotateToken()` to NOT logout on 503:

```typescript
// Already correct — rotateToken only logouts on 401/403, not 503
if (status === 401 || status === 403) {
    logout(...); // 503 won't trigger this
}
```

**Where:** `server/services/authService.ts` lines 295-302

> [!IMPORTANT]
> Using 503 instead of re-throwing the raw error ensures:
> 1. The middleware's catch block sees `statusCode: 503` and throws it properly (no fall-through)
> 2. The client's `rotateToken()` does NOT trigger destructive logout (it only logouts on 401/403)
> 3. The user sees a transient error, not a permanent session death

---

## ISSUE-4: No Proactive Client-Side Token Refresh on Visibility Change

> **SEVERITY: HIGH**

### Root Cause

The entire client-side auth system is **reactive**, not proactive. There is:
- NO `visibilitychange` event listener to refresh on tab wake
- NO `setInterval` / `setTimeout` to refresh before access token expires
- NO `focus` event listener
- NO `online` event listener (for WiFi reconnection)

Token refresh only happens when:
1. A **navigation** occurs → `app/middleware/auth.global.ts` → `initAuth()` → `/api/auth/me` → 401 → `rotateToken()`
2. An **API call** fails with 401 → `apiFetch()` or `rawRequest()` retry with `rotateToken()`

**During idle, NONE of these triggers fire.** When the user wakes up:
- If they navigate → initAuth fires → refresh attempt (but might hit cold start → ISSUE-1)
- If they click a button on the stale page → API call → 401 → retry (same cold start risk)

### Why This Matters With rotation=true

With rotation=true, the first request after idle triggers a FULL rotation (CAS lock + DB update). This is the most expensive operation and the most likely to fail on a cold start.

If a `visibilitychange` listener fired a lightweight refresh BEFORE the user interacts, the cold start would be absorbed by the background refresh, and the user's actual interaction would hit a warm function.

### Fix

Create `app/composables/useTokenKeepAlive.ts`:

```typescript
// app/composables/useTokenKeepAlive.ts (NEW FILE)
import { onMounted, onUnmounted } from 'vue';

export const useTokenKeepAlive = () => {
  if (import.meta.server) return;

  const { rotateToken, isAuthenticated } = useAuth();
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const handleVisibilityChange = () => {
    if (document.visibilityState !== 'visible' || !isAuthenticated.value) return;

    // Debounce: avoid firing multiple times if browser sends rapid visibility events
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      try {
        await rotateToken({ redirectIfFailed: false });
      } catch {
        // rotateToken already handles the error;
        // with ISSUE-1 fix, it won't destroy the session
      }
    }, 500);
  };

  onMounted(() => {
    document.addEventListener('visibilitychange', handleVisibilityChange);
  });

  onUnmounted(() => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    if (debounceTimer) clearTimeout(debounceTimer);
  });
};
```

Use it in `app/app.vue`:

```diff
 <script setup lang="ts">
 import { onMounted } from 'vue';
 import { isGlobalLoading } from './utils/api';
 import GlobalToolsHost from './components/tools/GlobalToolsHost.vue';
 import GlobalGuidelineDrawer from './components/guidelines/GlobalGuidelineDrawer.vue';
+import { useTokenKeepAlive } from './composables/useTokenKeepAlive';
+
+useTokenKeepAlive();

 const colorMode = useColorMode();
```

**Where to create:** `app/composables/useTokenKeepAlive.ts` (new file)  
**Where to use:** `app/app.vue` line 1-21

---

## ISSUE-5: Cooldown Branch `session.save()` While Rotation Is True — Potential Stale Write Race

> **SEVERITY: MEDIUM**

### Root Cause

**File:** `server/services/authService.ts` lines 328-336

When `ROTATE_REFRESH_TOKEN=true` but `isWithinCooldown=true` (a rotation happened < 15 seconds ago), the code takes the else branch:

```typescript
} else {
    isLockLoser = true;
    session.lastActivity = new Date();
    session.expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    await session.save();
}
```

The `session` variable is a Mongoose document loaded at line 85 (`Session.findOne`). Between the `findOne` and the `save()`, a **concurrent rotation on another Vercel instance** could have updated the session in MongoDB.

Mongoose's `save()` only sends modified fields (`$set: { lastActivity, expiresAt }`), so it does NOT overwrite `refreshToken` or `previousRefreshToken`. **However**, the `save()` also writes `updatedAt` (from `timestamps: true` in the schema), which could cause a misleading audit trail.

### Why This Matters

This is NOT the primary cause of the idle-logout bug, but it's a correctness concern:
- The `isLockLoser=true` flag prevents the refresh_token cookie from being re-set
- With rotation=true, the winner already set the cookie — this is correct behavior for the cooldown
- But if the winner's response hasn't reached the browser yet, the browser has the OLD token
- The next request (after cooldown expires) will use the old token → session lookup finds it via `previousRefreshToken` → self-heal works

### Fix

Replace the Mongoose `save()` with an atomic `updateOne` to avoid any risk of stale writes:

```diff
 } else {
     isLockLoser = true;
-    session.lastActivity = new Date();
-    session.expiresAt = new Date(Date.now() + SESSION_TTL_MS);
-    await session.save();
+    await Session.updateOne(
+        { _id: session._id },
+        {
+            $set: {
+                lastActivity: new Date(),
+                expiresAt: new Date(Date.now() + SESSION_TTL_MS)
+            }
+        }
+    );
 }
```

**Where:** `server/services/authService.ts` lines 332-335

---

## ISSUE-6: Self-Heal Fingerprint Mismatch After Browser Auto-Update During Sleep

> **SEVERITY: LOW**

### Root Cause

**File:** `server/services/authService.ts` lines 120-166 and `server/utils/security.ts` lines 14-25

The device fingerprint is computed from:
```typescript
const components = [
    getHeader(event, 'user-agent') || '',
    getHeader(event, 'accept-language') || '',
    getHeader(event, 'accept-encoding') || ''
];
```

When a browser auto-updates during sleep (Chrome, Edge, Firefox all auto-update), the `user-agent` string changes. This causes a fingerprint mismatch.

In the self-heal path (rotation=true, browser has stale token), the code at line 127-150 handles this:

```typescript
if (!isSameDevice) {
    await logSecurityEvent({...}); // Logs anomaly
    await Session.updateOne(      // Updates stored fingerprint
        { _id: session._id },
        { $set: { deviceFingerprint: requestFingerprint } }
    );
}
// Continues to self-heal regardless
```

This is correctly implemented — fingerprint mismatch doesn't block the self-heal. But it generates `severity: 'medium'` security events that could be confusing in monitoring.

### Fix

No code change needed — this is correctly handled as a soft signal. The comment at line 12-13 already documents this:

```typescript
// WARNING: Weak signal only — derived from 3 trivially-spoofable headers.
// Do NOT use as a hard security gate.
```

---

## ISSUE-7: In-Memory Rate Limiter Resets on Vercel Cold Start

> **SEVERITY: MEDIUM (security concern, not directly related to idle-logout)**

### Root Cause

**File:** `server/middleware/security.global.ts` line 11

```typescript
const rateLimitStore = new Map<string, RateLimitBucket>();
```

Vercel serverless functions are ephemeral. Each cold start creates a fresh `Map`. The refresh endpoint rate limit (300/15min at line 113) provides zero protection across cold starts.

The code already acknowledges this:
```typescript
// NOTE: For multi-instance/serverless deployments, migrate to Redis/Upstash
```

### Fix

Migrate to Upstash Redis (already configured in `.env`):

```typescript
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const refreshLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(300, '15 m'),
});
```

**Where:** `server/middleware/security.global.ts`

---

## Summary Fix Matrix

| # | Issue | Severity | Root Cause File:Line | Fix |
|---|-------|----------|---------------------|-----|
| **1** | **rotateToken() calls destructive logout() on ANY 401** | **CRITICAL** | **useAuth.ts:171-182** | **Gate logout behind `redirectIfFailed !== false`** |
| **2** | **TOKEN_EXPIRED catch has silent fall-through** | **HIGH** | **auth.global.ts:220-231** | **Always throw immediately, no fall-through** |
| **3** | **Rotation DB errors lack statusCode → generic 401** | **HIGH** | **authService.ts:295-302** | **Wrap as 503 (retry) instead of raw throw** |
| **4** | **No proactive client refresh on visibility change** | **HIGH** | **app/app.vue (missing)** | **Add useTokenKeepAlive composable** |
| 5 | Cooldown `session.save()` potential stale write | Medium | authService.ts:332-335 | Replace with atomic `updateOne` |
| 6 | Fingerprint mismatch after browser update | Low | authService.ts:127-150 | Already handled correctly |
| 7 | In-memory rate limiter resets on cold start | Medium | security.global.ts:11 | Migrate to Upstash Redis |

---

## Priority Execution Order

### Phase 1 — Stop the destructive logout (ISSUE-1 + ISSUE-3)

These two fixes together prevent transient rotation failures from permanently killing sessions:

1. **ISSUE-1:** `rotateToken()` stops calling `logout()` when `redirectIfFailed === false`, so `initAuth`'s exploratory refresh attempt doesn't destroy the session.

2. **ISSUE-3:** Rotation DB errors are wrapped as 503 instead of bubbling up as raw errors. This ensures the client sees "retry" not "session dead", and `rotateToken()` doesn't trigger the 401/403 logout gate.

After these two fixes: even if the rotation fails on cold start, the session remains alive. The next request (warm function) will succeed.

### Phase 2 — Fix the error handling gap (ISSUE-2)

The TOKEN_EXPIRED catch block should throw immediately instead of falling through. This prevents edge cases where the access_token cookie persists slightly longer than its JWT expiry.

### Phase 3 — Add proactive refresh (ISSUE-4)

The `visibilitychange` listener absorbs the cold start penalty in the background, so the user's first interaction hits a warm function.

### Phase 4 — Harden (ISSUE-5 + ISSUE-7)

Replace Mongoose `save()` with atomic `updateOne` in the cooldown branch, and migrate rate limiting to Upstash Redis.

---

## Verification Checklist

After applying fixes, verify these scenarios with `ROTATE_REFRESH_TOKEN=true`:

- [ ] Login → wait 16min (access_token expires) → click link → auto-refresh succeeds → no redirect
- [ ] Login → close laptop lid → wait 1h → open lid → app is still alive
- [ ] Login → close laptop lid → wait 6h → open lid → visibilitychange fires → refresh succeeds
- [ ] Login → kill WiFi → wait 5min → reconnect WiFi → click link → retries succeed (no permanent logout)
- [ ] Login → force a MongoDB timeout during rotation → user sees transient error, NOT permanent logout
- [ ] Login → rapid clicks after idle (multiple concurrent requests) → CAS lock handles correctly → session alive
- [ ] Verify `ROTATE_REFRESH_TOKEN=false` still works (no regression)
- [ ] Check Vercel function logs: rotation errors should show 503, NOT 401
