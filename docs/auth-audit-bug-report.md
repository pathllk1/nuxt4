# Auth System Deep Audit — Bug Report

> **Project**: `nxt` (Nuxt 4 / Nitro)
> **Audit Date**: 2026-08-08
> **Scope**: Complete authentication system — server middleware, API routes, JWT/token lifecycle, client composables, UI pages
> **Auditor**: Antigravity AI

---

## Files Audited

### Server
| File | Role |
|------|------|
| `server/middleware/auth.global.ts` | JWT verification, silent refresh, device fingerprint |
| `server/middleware/security.global.ts` | Rate limiting, security headers, XSS sanitization |
| `server/api/auth/login.post.ts` | Login handler |
| `server/api/auth/signup.post.ts` | Signup handler |
| `server/api/auth/refresh.post.ts` | Explicit token refresh |
| `server/api/auth/logout.post.ts` | Logout + token blacklisting |
| `server/api/auth/me.get.ts` | Current-user profile |
| `server/api/auth/security-logs.get.ts` | Security log viewer |
| `server/utils/jwt.ts` | Token generation/verification |
| `server/utils/auth.ts` | `requireAuthSession()` helper |
| `server/utils/security.ts` | Session validation, fingerprinting, blacklisting |
| `server/utils/trusted-ips.ts` | Trusted IP recording |
| `server/utils/validation.ts` | Zod schemas (login, signup) |
| `server/utils/crypto-hash.ts` | Argon2id password hashing |
| `server/utils/sanitizer.ts` | XSS sanitization |
| `server/models/User.ts` | User model + password methods |
| `server/models/Session.ts` | Session model |
| `server/models/TokenBlacklist.ts` | Blacklisted token store |
| `server/models/SecurityLog.ts` | Security event log |

### Client
| File | Role |
|------|------|
| `app/composables/useAuth.ts` | Auth state management, token refresh, `apiFetch` |
| `app/utils/api.ts` | Low-level `api.*` HTTP helper, separate refresh logic |
| `app/middleware/auth.global.ts` | Client route guard |
| `app/middleware/auth.ts` | Duplicate non-global route guard |
| `app/pages/login.vue` | Login page |
| `app/pages/signup.vue` | Signup page |

---

## Bug Summary Table

| # | Severity | Category | Location | Title |
|---|----------|----------|----------|-------|
| B1 | 🔴 Critical | Security | `login.post.ts` | Zod validation imported but never called |
| B2 | 🔴 Critical | Security | `login.post.ts` | `access_token` cookie is `httpOnly: false` |
| B3 | 🔴 Critical | Token | `login.post.ts` | Access token cookie `maxAge` (7d) contradicts JWT expiry (15m) |
| B4 | 🟠 High | Security | `signup.post.ts` | No `connectDB()` call — may fail on cold start |
| B5 | 🟠 High | Security | `signup.post.ts` | Zod `signupSchema` never used — password policy not enforced |
| B6 | 🟠 High | Security | `signup.post.ts` | Logs signup errors as `login_failed` — wrong action enum |
| B7 | 🟠 High | Token | `auth.global.ts` (server) | Silent refresh generates access token without firm/grade context |
| B8 | 🟠 High | Security | `logout.post.ts` | Swallows all errors — logout succeeds even if token is forged |
| B9 | 🟠 High | Client | `useAuth.ts` | `refresh_token` stored in non-HttpOnly cookie via `useCookie` |
| B10 | 🟠 High | Client | `useAuth.ts` | User data stored in `localStorage` — XSS exfiltrable |
| B11 | 🟠 High | Security | `SecurityLog` model | `signup` action not in enum — Mongoose validation silently fails |
| B12 | 🟡 Medium | Architecture | `auth.ts` + `auth.global.ts` | Duplicate client route middleware (global + named) |
| B13 | 🟡 Medium | Client | `api.ts` | Dual token refresh systems compete (`useAuth.rotateToken` vs `api.refreshTokenLogic`) |
| B14 | 🟡 Medium | Token | `api.ts` | `refreshTokenLogic` writes `access_token` as non-HttpOnly JS cookie |
| B15 | 🟡 Medium | Security | `auth.global.ts` (server) | `x-refresh-token` header exposes refresh token in every request |
| B16 | 🟡 Medium | Token | `refresh.post.ts` | Access token cookie maxAge (7d) mismatches JWT expiry (15m) |
| B17 | 🟡 Medium | Security | `auth.global.ts` (server) | `access_token` fallback from non-HttpOnly cookie |
| B18 | 🟡 Medium | Security | `security.global.ts` | `readBody()` in security middleware consumes body — double-read risk |
| B19 | 🟡 Medium | Security | `auth.ts` (server util) | `firm_id` trust via `x-firm-id` header despite DB validation |
| B20 | 🔵 Low | Code Quality | `auth.global.ts` (server) | `(User as any)` typecast hides missing method signatures |
| B21 | 🔵 Low | Code Quality | `refresh.post.ts` | Missing `connectDB()` — relies on middleware having done it |
| B22 | 🔵 Low | Security | `me.get.ts` | Returns full User document — may leak `securitySettings` |
| B23 | 🔵 Low | Token | `jwt.ts` | Hardcoded issuer/audience `fastify-auth-server`/`fastify-client` |
| B24 | 🔵 Low | Config | `.env` | `ACCESS_TOKEN_SECRET` is only 32 bytes (256 bits) vs `REFRESH_TOKEN_SECRET` 64 bytes |

---

## Detailed Bug Reports & Fix Guidelines

---

### B1 🔴 CRITICAL — Zod Validation Imported but Never Called in Login

**File**: [`login.post.ts`](file:///d:/PROJECT/TESTS/node/FASTIFY/nxt/server/api/auth/login.post.ts#L18)

**Description**: `loginSchema` and `validateBody` are imported on line 18 but never invoked. The handler falls through to a manual `if (!email || !password)` check which is much weaker than the Zod schema that validates email format and string length limits.

**Impact**: Input injection, overly long strings, invalid email formats bypass validation.

**Fix**:
```diff
  const body = await readBody(event);
- const { email, password } = body || {};
+ const { email, password } = validateBody(loginSchema, body);
```
Remove the manual `if (!email || !password)` block since Zod handles it.

---

### B2 🔴 CRITICAL — `access_token` Cookie Set as Non-HttpOnly

**File**: [`login.post.ts`](file:///d:/PROJECT/TESTS/node/FASTIFY/nxt/server/api/auth/login.post.ts#L220-L226)

**Description**: The `access_token` cookie is set with `httpOnly: false`. This allows any client-side JavaScript (and any XSS payload) to read and exfiltrate the access token via `document.cookie`.

**Impact**: An XSS vulnerability anywhere on the site can steal the access token immediately.

**Fix**:
```diff
  setCookie(event, 'access_token', accessToken, {
-   httpOnly: false,
+   httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
-   maxAge: 60 * 60 * 24 * 7 // 7 days
+   maxAge: 15 * 60 // 15 minutes (match JWT expiry)
  });
```

> **Note**: Making the access token `httpOnly` means the client can no longer read it from `document.cookie` for the `Authorization` header. Since Nuxt is SSR, cookies are sent automatically by the browser. Refactor the client to use `credentials: 'include'` and let the server read the token from the cookie directly instead of requiring `Authorization: Bearer ...` headers.

---

### B3 🔴 CRITICAL — Access Token Cookie MaxAge (7 Days) Contradicts JWT Expiry (15 Minutes)

**File**: [`login.post.ts`](file:///d:/PROJECT/TESTS/node/FASTIFY/nxt/server/api/auth/login.post.ts#L225), [`refresh.post.ts`](file:///d:/PROJECT/TESTS/node/FASTIFY/nxt/server/api/auth/refresh.post.ts#L145)

**Description**: The `access_token` cookie has `maxAge: 60 * 60 * 24 * 7` (7 days), but the JWT inside it expires in 15 minutes (`ACCESS_TOKEN_EXPIRY=15m`). This means:
1. The browser will present an expired JWT for up to 7 days.
2. Every request after 15 minutes triggers the silent refresh flow, adding unnecessary overhead.
3. If the silent refresh fails, the user sees a stale expired cookie.

**Fix**: Align cookie maxAge with JWT expiry:
```diff
  setCookie(event, 'access_token', accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
-   maxAge: 60 * 60 * 24 * 7
+   maxAge: 15 * 60  // Match ACCESS_TOKEN_EXPIRY
  });
```
Apply same fix in `refresh.post.ts`.

---

### B4 🟠 HIGH — Missing `connectDB()` in Signup Route

**File**: [`signup.post.ts`](file:///d:/PROJECT/TESTS/node/FASTIFY/nxt/server/api/auth/signup.post.ts)

**Description**: `signup.post.ts` does not call `await connectDB()` before querying MongoDB. The `/api/auth/signup` path is excluded from the `auth.global.ts` middleware, so there is no guarantee that MongoDB is connected when the handler runs (especially on cold starts or serverless deployments).

**Impact**: Signup may fail intermittently on cold starts with `MongoNotConnectedError`.

**Fix**:
```diff
+ import { connectDB } from '../../plugins/mongodb';

  export default defineEventHandler(async (event) => {
+   await connectDB();
    const body = await readBody(event);
```

---

### B5 🟠 HIGH — Zod `signupSchema` Never Used — Password Policy Not Enforced

**File**: [`signup.post.ts`](file:///d:/PROJECT/TESTS/node/FASTIFY/nxt/server/api/auth/signup.post.ts#L19-L24)

**Description**: The validation module defines a `signupSchema` that requires uppercase letters and numbers in passwords, but `signup.post.ts` only checks `password.length < 8`. The Zod schema is never imported or called.

**Impact**: Users can sign up with weak passwords like `aaaaaaaa` (no uppercase, no digit).

**Fix**:
```diff
+ import { signupSchema, validateBody } from '../../utils/validation';

  const body = await readBody(event);
- const { name, email, password, firmId } = body || {};
+ const { name, email, password, firmId } = validateBody(signupSchema, body);
```
Remove the manual validation blocks that Zod now handles.

---

### B6 🟠 HIGH — Signup Errors Logged as `login_failed`

**File**: [`signup.post.ts`](file:///d:/PROJECT/TESTS/node/FASTIFY/nxt/server/api/auth/signup.post.ts#L28-L34), line 103-108

**Description**: When a signup fails (duplicate user, server error), the security log records the action as `login_failed` instead of a signup-related action. Additionally, the `signup` action used on line 79 is **not in the SecurityLog model's enum** (`SecurityLogSchema` action enum does not include `'signup'`).

**Impact**: 
- Security logs are misleading — impossible to distinguish signup failures from login failures.
- The `signup` action on success triggers a Mongoose validation error (or silently fails depending on `strict` mode).

**Fix**:
1. Add `'signup'` and `'signup_failed'` to the SecurityLog action enum.
2. Use `'signup_failed'` for error cases in signup.post.ts.

```diff
// SecurityLog.ts
  action: {
    type: String,
    required: true,
    enum: ['login_success', 'login_failed', 'logout', 'token_refresh', 'token_revoked',
-          'password_change', 'suspicious_activity', 'rate_limit_exceeded', 'invalid_token',
-          'session_created', 'session_terminated', 'anomaly_detected']
+          'password_change', 'suspicious_activity', 'rate_limit_exceeded', 'invalid_token',
+          'session_created', 'session_terminated', 'anomaly_detected', 'signup', 'signup_failed']
  }
```

---

### B7 🟠 HIGH — Silent Refresh Generates Access Token Without Firm/Grade

**File**: [`auth.global.ts`](file:///d:/PROJECT/TESTS/node/FASTIFY/nxt/server/middleware/auth.global.ts#L231) (server)

**Description**: On line 231 of the auth middleware, the silent refresh calls:
```js
const newAccessToken = generateAccessToken(user, deviceFingerprint);
```
This does not pass `firmId` or `grade` arguments. The `generateAccessToken` function defaults to `user.firms[0]`, which may not match the firm the user was scoped to before the token expired.

**Impact**: After a silent refresh, the user's `firmId` and `grade` in the new token may point to a different firm than what they had selected — causing authorization errors on subsequent requests.

**Fix**: Extract `firmId` from the **expired** token's payload or from the `x-firm-id` header:
```diff
+ const requestedFirmId = getHeader(event, 'x-firm-id') || undefined;
+ const requestedGrade = undefined; // lookup from user.firms matching requestedFirmId
  const newAccessToken = generateAccessToken(user, deviceFingerprint, requestedFirmId, requestedGrade);
```

---

### B8 🟠 HIGH — Logout Swallows All Errors Silently

**File**: [`logout.post.ts`](file:///d:/PROJECT/TESTS/node/FASTIFY/nxt/server/api/auth/logout.post.ts#L58-L65)

**Description**: The catch block on logout returns `{ success: true }` regardless of what went wrong. This means a forged, invalid, or expired refresh token will still produce a "logged out successfully" response, and the session will remain active.

**Impact**:
- An attacker sending a garbage refresh token gets the same response as a valid logout.
- The real session is never deactivated.
- Security events are not logged for the failure.

**Fix**:
```diff
  } catch (error) {
-   console.error('Logout error:', error);
-   return {
-     success: true,
-     message: 'Logged out successfully'
-   };
+   console.error('Logout error:', error);
+   // Still clear client state, but indicate partial success
+   return {
+     success: true,
+     message: 'Logged out (session cleanup may be incomplete)',
+     warning: 'Token verification failed — server session was not deactivated'
+   };
  }
```
Additionally, consider clearing the cookies on the server side during logout regardless of token validity:
```js
setCookie(event, 'access_token', '', { maxAge: 0, path: '/' });
setCookie(event, 'refresh_token', '', { maxAge: 0, path: '/', httpOnly: true });
```

---

### B9 🟠 HIGH — Refresh Token Readable by Client via `useCookie`

**File**: [`useAuth.ts`](file:///d:/PROJECT/TESTS/node/FASTIFY/nxt/app/composables/useAuth.ts#L35)

**Description**: The composable declares:
```js
const cookieRefresh = useCookie<string | null>('refresh_token', { ... });
```
Although the **server** sets `refresh_token` with `httpOnly: true`, the Nuxt `useCookie` composable on the **client** side creates a parallel non-HttpOnly cookie with the same name. When `setAuth()` assigns `cookieRefresh.value = newRefresh`, it effectively writes the refresh token into a client-readable cookie, overriding the server's HttpOnly flag.

**Impact**: The refresh token is exposed to XSS attacks via the client-written cookie.

**Fix**: Remove client-side management of the refresh token cookie. The server already sends it as HttpOnly. The client should rely on `credentials: 'include'` for the refresh token to be sent automatically:
```diff
- const cookieRefresh = useCookie<string | null>('refresh_token', { maxAge: 60 * 60 * 24 * 30, path: '/' });
```
Use an in-memory ref only for the refresh token value (for the logout POST body), never write it to a cookie from the client.

---

### B10 🟠 HIGH — User Object Stored in localStorage

**File**: [`useAuth.ts`](file:///d:/PROJECT/TESTS/node/FASTIFY/nxt/app/composables/useAuth.ts#L179)

**Description**: `localStorage.setItem('user', JSON.stringify(newUser))` persists the user object (including role, firms, email) in `localStorage`. This data is accessible to any JavaScript on the page.

**Impact**: XSS can exfiltrate user profile data. Also, a stale `localStorage` entry can cause the client to think a user is authenticated when they are not (e.g., after server-side session revocation).

**Fix**: Remove `localStorage` usage for user data. Use only cookies (which SSR can also read) or in-memory state:
```diff
- if (import.meta.client) {
-   localStorage.setItem('user', JSON.stringify(newUser));
- }
```

---

### B11 🟠 HIGH — `signup` Action Not in SecurityLog Enum

**File**: [`SecurityLog.ts`](file:///d:/PROJECT/TESTS/node/FASTIFY/nxt/server/models/SecurityLog.ts#L6-L8)

**Description**: The signup handler logs `action: 'signup'` (line 79 of signup.post.ts), but the SecurityLog schema's action enum does not include `'signup'`. This causes:
- In strict mode (default): Mongoose throws a `ValidationError` and the log entry is **not saved** — signup events are silently lost.
- In non-strict mode: The value passes through, but validation is inconsistent.

**Fix**: Add `'signup'` and `'signup_failed'` to the enum as noted in B6.

---

### B12 🟡 MEDIUM — Duplicate Client Route Middleware

**Files**: [`auth.global.ts`](file:///d:/PROJECT/TESTS/node/FASTIFY/nxt/app/middleware/auth.global.ts) and [`auth.ts`](file:///d:/PROJECT/TESTS/node/FASTIFY/nxt/app/middleware/auth.ts)

**Description**: Two middleware files contain identical logic. `auth.global.ts` runs on every route. `auth.ts` is a named middleware that would need to be explicitly applied via `definePageMeta({ middleware: 'auth' })`. Having both is confusing and may cause double redirects.

**Fix**: Delete `app/middleware/auth.ts`. The global middleware already handles all cases.

---

### B13 🟡 MEDIUM — Competing Token Refresh Systems

**Files**: [`useAuth.ts`](file:///d:/PROJECT/TESTS/node/FASTIFY/nxt/app/composables/useAuth.ts#L116-L154) and [`api.ts`](file:///d:/PROJECT/TESTS/node/FASTIFY/nxt/app/utils/api.ts#L76-L107)

**Description**: Two entirely separate token refresh implementations exist:
1. `useAuth.ts` → `rotateToken()` using `$fetch` and composable state
2. `api.ts` → `refreshTokenLogic()` using native `fetch` and raw cookies

They do not share state. If both trigger simultaneously:
- Two concurrent refresh POST requests are sent.
- One will succeed, the other may blacklist the same token (if rotation is on) — causing the second to fail.
- Token state diverges between the two systems.

**Impact**: Race condition can log the user out unexpectedly.

**Fix**: Consolidate into a single refresh mechanism. Either:
- Remove `api.ts` refresh logic and make `api.*` methods call `useAuth().apiFetch()`
- Or remove `useAuth().apiFetch()` and route everything through `api.*`

---

### B14 🟡 MEDIUM — `refreshTokenLogic` Writes Non-HttpOnly Cookie

**File**: [`api.ts`](file:///d:/PROJECT/TESTS/node/FASTIFY/nxt/app/utils/api.ts#L92)

**Description**: After refreshing, `api.ts` writes:
```js
document.cookie = `access_token=${encodeURIComponent(data.accessToken)}; path=/; max-age=...; SameSite=Lax`
```
This creates a **non-HttpOnly** cookie with the access token, exposing it to XSS.

**Fix**: Remove this line. The server already sets the `access_token` cookie in the `/api/auth/refresh` response via `setCookie`.

---

### B15 🟡 MEDIUM — Refresh Token Sent in Every API Request via Header

**File**: [`useAuth.ts`](file:///d:/PROJECT/TESTS/node/FASTIFY/nxt/app/composables/useAuth.ts#L255-L257)

**Description**: The `apiFetch` function attaches `x-refresh-token` header to **every** API request, not just refresh-related calls. This unnecessarily exposes the refresh token to all server endpoints and any middleware/proxy in between.

**Impact**: Increases attack surface for refresh token theft via logging, middleware, or MITM.

**Fix**: Only send the refresh token header on requests to `/api/auth/refresh`, or better yet, rely on the HttpOnly cookie:
```diff
- if (refreshToken.value) {
-   options.headers['x-refresh-token'] = refreshToken.value;
- }
```

---

### B16 🟡 MEDIUM — Refresh Route Also Sets Mismatched Cookie MaxAge

**File**: [`refresh.post.ts`](file:///d:/PROJECT/TESTS/node/FASTIFY/nxt/server/api/auth/refresh.post.ts#L140-L146)

**Description**: Same issue as B3 — `access_token` cookie maxAge is 7 days but JWT expires in 15 minutes.

**Fix**: Same as B3.

---

### B17 🟡 MEDIUM — Auth Middleware Falls Back to Non-HttpOnly Cookie

**File**: [`auth.global.ts`](file:///d:/PROJECT/TESTS/node/FASTIFY/nxt/server/middleware/auth.global.ts#L42) (server)

**Description**: The server middleware reads:
```js
let token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : getCookie(event, 'access_token');
```
This falls back to the `access_token` cookie, which is currently non-HttpOnly (B2). Once B2 is fixed, this fallback becomes the **primary** path, which is correct.

**Impact**: Currently not a standalone bug, but reinforces that fixing B2 is critical.

---

### B18 🟡 MEDIUM — Security Middleware Consumes Request Body

**File**: [`security.global.ts`](file:///d:/PROJECT/TESTS/node/FASTIFY/nxt/server/middleware/security.global.ts#L138)

**Description**: The security middleware calls `await readBody(event)` for POST/PUT/PATCH to sanitize the body. In H3/Nitro, `readBody` may consume the body stream, making it unavailable for the actual handler. H3 caches `readBody` results, so this *usually* works, but:
1. It sanitizes the body **mutably** — the handler receives sanitized data without knowing it.
2. For `FormData` uploads (e.g., document uploads), `readBody` may fail or corrupt the body.

**Fix**: Either:
- Move sanitization into individual handlers where it's needed.
- Use an H3 hook that reads and re-attaches the body safely.
- Skip `readBody` for `multipart/form-data` content types.

---

### B19 🟡 MEDIUM — `x-firm-id` Header Trust Despite DB Check

**File**: [`auth.ts`](file:///d:/PROJECT/TESTS/node/FASTIFY/nxt/server/utils/auth.ts#L24)

**Description**: `requireAuthSession` prioritizes the `x-firm-id` header over the JWT's `firm_id` claim. Although there's a DB check on line 37 to verify membership, this pattern means any request can switch firms simply by changing a header — bypassing the token's intended scope.

**Impact**: A user with multiple firms can access any of their firms' data regardless of the token's `firmId` claim. While not a cross-user vulnerability (due to the DB check), it circumvents the access token's intended scope.

**Fix**: Consider using the JWT's `firmId` claim as the authoritative source, and only allow firm switching via explicit re-authentication or a dedicated endpoint.

---

### B20 🔵 LOW — `(User as any)` Typecast Hides Issues

**Files**: [`auth.global.ts`](file:///d:/PROJECT/TESTS/node/FASTIFY/nxt/server/middleware/auth.global.ts#L101) (server), [`refresh.post.ts`](file:///d:/PROJECT/TESTS/node/FASTIFY/nxt/server/api/auth/refresh.post.ts#L81)

**Description**: `(User as any).findById(decoded.id)` is used to silence TypeScript. This hides potential issues with the model's type definitions.

**Fix**: Properly type the User model export so `User.findById` works without casting.

---

### B21 🔵 LOW — Missing `connectDB()` in Refresh and Logout Routes

**Files**: [`refresh.post.ts`](file:///d:/PROJECT/TESTS/node/FASTIFY/nxt/server/api/auth/refresh.post.ts), [`logout.post.ts`](file:///d:/PROJECT/TESTS/node/FASTIFY/nxt/server/api/auth/logout.post.ts)

**Description**: Neither route calls `connectDB()`. They rely on the auth middleware or login having already connected. On cold starts, `/api/auth/refresh` is in the public route list and skipped by auth middleware — meaning no DB connection is guaranteed.

**Fix**: Add `await connectDB()` at the top of both handlers, or create a Nitro plugin that connects on startup.

---

### B22 🔵 LOW — `/api/auth/me` Returns Full User Document

**File**: [`me.get.ts`](file:///d:/PROJECT/TESTS/node/FASTIFY/nxt/server/api/auth/me.get.ts#L15-L23)

**Description**: Although `.select('-password')` excludes the password, the response still includes the full `securitySettings` subdocument (failed login attempts, trusted IPs, suspicious activity count, etc.).

**Fix**:
```diff
  const user = await User.findById(userPayload.id)
-   .select('-password')
+   .select('-password -securitySettings')
    .populate({ path: 'firms.firm', model: Firm });
```

---

### B23 🔵 LOW — Hardcoded JWT Issuer/Audience

**File**: [`jwt.ts`](file:///d:/PROJECT/TESTS/node/FASTIFY/nxt/server/utils/jwt.ts#L70-L71)

**Description**: JWT issuer is `'fastify-auth-server'` and audience is `'fastify-client'`. This is from the original Fastify project and should be updated to reflect the Nuxt app.

**Fix**: Move to env vars or update the literals:
```diff
-   issuer: 'fastify-auth-server',
-   audience: 'fastify-client'
+   issuer: process.env.JWT_ISSUER || 'nxt-auth-server',
+   audience: process.env.JWT_AUDIENCE || 'nxt-client'
```

---

### B24 🔵 LOW — Access Token Secret Shorter Than Refresh Token Secret

**File**: `.env`

**Description**: `ACCESS_TOKEN_SECRET` is 64 hex chars (32 bytes / 256 bits), while `REFRESH_TOKEN_SECRET` is 128 hex chars (64 bytes / 512 bits). While 256 bits is sufficient for HMAC-SHA256, consistency is preferable.

**Fix**: Regenerate `ACCESS_TOKEN_SECRET` to be 64 bytes:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

## Architectural Recommendations

### 1. Consolidate Token Refresh Logic
The most architecturally significant issue is the **dual refresh system** (B13). Choose one path:
- **Option A**: Route all HTTP through `useAuth().apiFetch()` — delete `api.ts` refresh logic.
- **Option B**: Route all HTTP through `api.*` methods — delete `useAuth().rotateToken()` and `scheduleTokenRefresh()`.

### 2. Eliminate localStorage for Auth Data
Remove all `localStorage.setItem/getItem` for `user` and rely exclusively on SSR-safe cookies via `useCookie()`.

### 3. Make Access Token HttpOnly
After fixing B2, refactor all client-side `Authorization: Bearer` header injection to use `credentials: 'include'` and read the token from the cookie on the server side.

### 4. Add Password Change / Reset Endpoints
The system currently has no password change or password reset flow. The `User` model tracks `passwordChangedAt` and `lastPasswordChange`, but no endpoint sets them (other than the pre-save hook).

### 5. Add Session Listing Endpoint
The `Session` model supports session management, but there's no API for users to see their active sessions or revoke specific ones.

### 6. Clean Up Dead Code
- `loginSchema`, `validateBody` import in `login.post.ts` (imported, unused)
- `app/middleware/auth.ts` (duplicate of global)

---

## Priority Fix Order

1. **B1** — Call `validateBody(loginSchema, body)` in login *(5 min fix)*
2. **B5** — Call `validateBody(signupSchema, body)` in signup *(5 min fix)*
3. **B2 + B3** — Fix cookie `httpOnly` and `maxAge` for access token *(15 min fix)*
4. **B9** — Remove client-side refresh token cookie management *(30 min refactor)*
5. **B4 + B21** — Add `connectDB()` to signup, refresh, logout *(10 min fix)*
6. **B6 + B11** — Fix SecurityLog action enum + signup event logging *(10 min fix)*
7. **B7** — Pass firmId/grade in silent refresh *(15 min fix)*
8. **B13** — Consolidate dual refresh systems *(1-2 hr refactor)*
9. **B10** — Remove localStorage user storage *(15 min fix)*
10. **B14 + B15** — Remove JS cookie write + per-request refresh header *(15 min fix)*

---

*End of Audit Report*
