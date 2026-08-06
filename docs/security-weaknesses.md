# Security Weaknesses & Gaps — `nxt` App

> Nuxt 3 (Nitro) application — Security review dated 2026-08-04

---

## 1. Hardcoded JWT Fallback Secrets

**Severity**: Critical

**File**: `server/utils/jwt.ts:5-6`

**Description**:
When `ACCESS_TOKEN_SECRET` or `REFRESH_TOKEN_SECRET` environment variables are not set, the application silently falls back to the well-known static strings:

```typescript
const ACCESS_TOKEN_SECRET: string = process.env.ACCESS_TOKEN_SECRET || 'fallback_access_secret';
const REFRESH_TOKEN_SECRET: string = process.env.REFRESH_TOKEN_SECRET || 'fallback_refresh_secret';
```

An attacker who knows these values can forge valid JWTs for any user, any firm, with any role — including `superadmin`.

**Recommendation**: Remove the fallback. Fail fast at startup if secrets are missing. Generate secrets via `crypto.randomBytes(64).toString('hex')`.

---

## 2. Weak MongoDB Credentials in `.env`

**Severity**: Critical

**File**: `.env`

**Description**:
```
MONGODB_URI=mongodb+srv://anjan:indian@cluster0.pajrtmm.mongodb.net/fastify_app?retryWrites=true&w=majority&appName=Cluster0
```

Username `anjan`, password `indian` — both trivially guessable.

**Recommendation**: Rotate credentials immediately. Use a strong, randomly generated password.

---

## 3. Missing `.env.example`

**Severity**: Critical

**File**: `.gitignore` (contains `!.env.example`)

**Description**: The `.gitignore` references `!.env.example`, but no such file exists. Developers deploying the app have no documentation of required environment variables.

**Recommendation**: Create `.env.example` listing all required variables with descriptions and placeholder values.

---

## 4. No CSRF Protection

**Severity**: High

**File**: Entire `nxt` app (no CSRF middleware found)

**Description**: All state-changing API endpoints (POST/PUT/DELETE) lack CSRF token validation. The sibling project `nuxt_tst` has full CSRF double-submit cookie protection, but `nxt` does not use it. The auth middleware in `nxt` has no CSRF checks.

**Recommendation**: Implement a double-submit CSRF token pattern. Validate CSRF tokens on all state-changing requests.

---

## 5. Insecure Cookie Storage for Tokens

**Severity**: High

**Files**: `app/utils/api.ts:90,93` and `app/composables/useAuth.ts:34-37`

**Description**: Tokens are stored in cookies without `HttpOnly`, `Secure`, or `SameSite` attributes:
```javascript
document.cookie = `access_token=${encodeURIComponent(data.accessToken)}; path=/; max-age=${60 * 60 * 24 * 7}`
// No HttpOnly, no Secure, no SameSite
```

Additionally, tokens are stored in `localStorage`, making them directly accessible to any XSS payload.

**Recommendation**:
- Set `HttpOnly`, `Secure`, and `SameSite=Strict` on all auth cookies.
- Remove tokens from `localStorage`. Use only `HttpOnly` cookies.

---

## 6. Firm IDOR / Missing Firm Membership Validation

**Severity**: High

**File**: `server/utils/auth.ts:15-16`

**Description**: The `requireAuthSession` function reads the firm ID from a client-supplied header:
```typescript
const headerFirmId = getHeader(event, 'x-firm-id') || getHeader(event, 'X-Firm-ID');
const firmId = headerFirmId || userPayload?.firm_id;
```

There is **no validation** that the authenticated user belongs to the firm specified in `x-firm-id`. Any authenticated user can set this header to any firm's ID and access that firm's data.

This affects all endpoints using `requireAuthSession`:
- `wages/bulk.post.ts`
- `advances.post.ts`
- `accounting/sales.post.ts`
- `accounting/coah.post.ts`
- `inventory/stock.post.ts`
- And all other business endpoints.

**Recommendation**: Query the User model to verify the authenticated user has a firm assignment matching the requested `firmId`. Return 403 if the user does not belong to the specified firm.

---

## 7. Endpoints Bypassing `requireAuthSession`

**Severity**: High

**Files**: `server/api/master-rolls/import.post.ts:7`, `server/api/master-rolls/bulk-update.put.ts:7`, `server/api/master-rolls/[id].put.ts:7`

**Description**: Several endpoints don't call `requireAuthSession` and instead read `x-firm-id` directly from headers:
```typescript
const firmId = getHeader(event, 'x-firm-id');
const user = event.context.user;
```

These endpoints trust the `x-firm-id` header completely without any user-firm membership verification.

**Recommendation**: Use `requireAuthSession` consistently across all endpoints and add firm membership validation.

---

## 8. Mass Assignment Vulnerabilities

**Severity**: High

**Files**: `server/api/master-rolls/[id].put.ts:18`, `server/api/master-rolls/import.post.ts:27`

**Description**: Request bodies are spread directly into Mongoose model constructors or update operations:

```typescript
// master-rolls/[id].put.ts
await MasterRoll.findOneAndUpdate(
  { _id: ..., firm_id: ... },
  { ...body, updated_by: ... },   // <-- arbitrary fields from body
  { new: true, runValidators: true }
);

// import.post.ts
await MasterRoll.create({ ...emp, firm_id: ..., created_by: ... });
```

A client can send arbitrary fields (e.g., `firm_id`, `created_by`) to overwrite protected fields.

**Recommendation**: Use an allowlist of permitted fields. Never spread raw request bodies into model operations.

---

## 9. Tokens Stored in `localStorage`

**Severity**: High

**Files**: `app/composables/useAuth.ts:199-200`, `app/utils/api.ts:89`

**Description**: Both access and refresh tokens are persisted to `localStorage`, making them accessible to any XSS payload.

**Recommendation**: Move to `HttpOnly` cookies only. Implement server-side token refresh.

---

## 10. In-Memory Rate Limiter Doesn't Scale

**Severity**: Medium

**File**: `server/middleware/security.global.ts:8`

**Description**:
```typescript
const rateLimitStore = new Map<string, RateLimitBucket>();
```

The rate limiter is in-memory. On Vercel/serverless deployments, each function invocation runs in a fresh container, so rate limits are not shared and the limiter is ineffective. Rate limiting only applies to `/api/auth/*` paths — business endpoints have no rate limiting.

**Recommendation**: Use a distributed store (Redis/Upstash). Extend rate limiting to all mutating endpoints.

---

## 11. Rate Limiting Bypassed for Localhost

**Severity**: Medium

**File**: `server/middleware/security.global.ts:71`

**Description**:
```typescript
if (ip !== '127.0.0.1' && ip !== 'localhost' && ip !== '::1') {
```

Rate limiting is disabled for localhost IPs. Behind a load balancer/proxy, real client IPs may appear as localhost.

**Recommendation**: Remove localhost exemptions in production. Use `x-forwarded-for` properly.

---

## 12. No Content-Security-Policy (CSP) Header

**Severity**: Medium

**File**: `server/middleware/security.global.ts:60-64`

**Description**: Security headers are set for most categories but CSP and HSTS are missing:
```typescript
setHeader(event, 'X-Content-Type-Options', 'nosniff');
setHeader(event, 'X-Frame-Options', 'DENY');
setHeader(event, 'X-XSS-Protection', '1; mode=block');
setHeader(event, 'Referrer-Policy', 'strict-origin');
setHeader(event, 'Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
```

**Recommendation**: Add a strict CSP via `nuxt.config.ts` or a Nitro plugin. Add `Strict-Transport-Security` header.

---

## 13. Verbose Error Messages Leaking Internal Details

**Severity**: Medium

**File**: `server/api/auth/login.post.ts:227`

**Description**:
```typescript
throw createError({
  statusCode: 500,
  statusMessage: error.message || 'Server error during login'
});
```

Internal error messages (database errors, stack traces) are exposed to clients.

**Recommendation**: Return generic error messages in production. Log detailed errors server-side only.

---

## 14. Security Logs Exposed to Any Authenticated User

**Severity**: Medium

**File**: `server/api/auth/security-logs.get.ts:9`

**Description**:
```typescript
const logs = await SecurityLog.find({})
  .sort({ timestamp: -1 })
  .limit(limit)
  .lean();
```

Any authenticated user can retrieve all security logs — including IP addresses, user agents, device fingerprints, and locations of all users.

**Recommendation**: Restrict to superadmin/owner roles. Filter by firm. Never expose raw IPs or device fingerprints to non-admin users.

---

## 15. CORS Configuration Not Applied

**Severity**: Medium

**File**: `.env` defines `CORS_ORIGINS` but it is never referenced in `nuxt.config.ts`

**Description**: The `.env` defines `CORS_ORIGINS=http://localhost:3000,http://localhost:4200` but this is never used in any Nitro configuration. The app relies on Nuxt's default CORS behavior.

**Recommendation**: Explicitly configure CORS in Nitro config with a strict origin allowlist.

---

## 16. `X-XSS-Protection` Header Is Deprecated

**Severity**: Low

**File**: `server/middleware/security.global.ts:62`

**Description**: `X-XSS-Protection: 1; mode=block` is deprecated and can introduce vulnerabilities in some browsers. Modern browsers ignore it.

**Recommendation**: Remove this header. Rely on CSP instead.

---

## 17. Plain Text Password Fallback Backdoor

**Severity**: Low

**File**: `server/utils/crypto-hash.ts:42-44`

**Description**:
```typescript
if (password === encodedHash) {
  return true;
}
```

If a stored password hash happens to equal the plaintext input (e.g., for test/seed accounts), authentication succeeds, bypassing the Argon2 hash verification.

**Recommendation**: Remove the plaintext comparison fallback entirely.

---

## 18. Weak Device Fingerprinting

**Severity**: Low

**File**: `server/utils/security.ts:12-23`

**Description**: The device fingerprint is derived only from `user-agent`, `accept-language`, and `accept-encoding` headers — all trivially spoofable by the client. It is used as a security control in session validation and access token checks, creating a false sense of security.

**Recommendation**: Treat device fingerprint as a weak signal (risk scoring) rather than a hard enforcement mechanism. Add additional signals if used for authorization.

---

## 19. No Request Body Size Limit

**Severity**: Low

**File**: `nuxt.config.ts`

**Description**: No `bodySizeLimit` or equivalent is configured. Large payloads could cause DoS.

**Recommendation**: Configure Nitro body size limits in `nuxt.config.ts`.

---

## 20. No Input Validation Schema

**Severity**: Low

**File**: All API endpoints

**Description**: No endpoint uses a validation library (Zod, Joi, Valibot). Input validation is done manually and inconsistently.

**Recommendation**: Implement schema-based input validation for all API endpoints.

---

## 21. `NODE_ENV=development` in `.env`

**Severity**: Low

**File**: `.env:18`

**Description**: The environment file sets `NODE_ENV=development`, which could disable security features in production-like deployments.

**Recommendation**: Ensure `.env.production` has `NODE_ENV=production`.

---

## 22. `vercel.json` Lacks Security Headers

**Severity**: Low

**File**: `vercel.json`

**Description**:
```json
{ "version": 2, "regions": ["bom1"] }
```

No security headers configured at the platform level.

**Recommendation**: Add security headers via Nitro's `headers` configuration or `vercel.json`.

---

## 23. Trusted IPs Field Never Used

**Severity**: Low

**File**: `server/models/User.ts:15` (interface), `server/api/auth/signup.post.ts:68` (populated)

**Description**: The User model includes a `trustedIPs` array in `securitySettings` that is populated during signup but never checked during authentication or session validation. The field exists but serves no security purpose.

**Recommendation**: Either implement IP trust checking using this field, or remove it to avoid confusion.
