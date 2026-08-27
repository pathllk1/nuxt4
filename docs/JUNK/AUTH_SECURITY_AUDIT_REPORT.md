# Authentication, Authorization, Token, Session & Security Audit Report

**Application**: BusinessPro Suite (Nuxt 4 / Nitro / MongoDB / PostgreSQL)  
**Date**: August 2026  
**Auditor**: Senior Application Security Engineer & Nuxt 4 Architecture Expert  
**Status**: Complete Security & Architectural Audit (Updated with Auto-Logout & Session vs. Token Validity Deep-Dive)  

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Application Authentication Architecture](#2-application-authentication-architecture)
3. [Complete Authentication Flow](#3-complete-authentication-flow)
4. [Token Lifecycle](#4-token-lifecycle)
5. [Refresh Token Lifecycle](#5-refresh-token-lifecycle)
6. [Session Lifecycle](#6-session-lifecycle)
7. [Refresh Token Validity vs. Session Validity Deep-Dive](#7-refresh-token-validity-vs-session-validity-deep-dive)
8. [Unexpected Auto-Logout Scenarios & Root Causes](#8-unexpected-auto-logout-scenarios--root-causes)
9. [Client-Side Authentication Review](#9-client-side-authentication-review)
10. [Server-Side Authentication Review](#10-server-side-authentication-review)
11. [Authorization Review](#11-authorization-review)
12. [Security Vulnerability Findings](#12-security-vulnerability-findings)
13. [Logic and Flow Problems](#13-logic-and-flow-problems)
14. [Duplication and Centralization Problems](#14-duplication-and-centralization-problems)
15. [Over-Engineering Review](#15-over-engineering-review)
16. [Current Architecture Diagram](#16-current-architecture-diagram)
17. [Real-Code Evidence](#17-real-code-evidence)
18. [Detailed Examples & Edge-Case Traces](#18-detailed-examples--edge-case-traces)
19. [Severity Classification](#19-severity-classification)
20. [Recommended Architecture](#20-recommended-architecture)
21. [Migration & Refactoring Plan](#21-migration--refactoring-plan)
22. [Testing Strategy](#22-testing-strategy)
23. [Files Reviewed](#23-files-reviewed)
24. [Files / Areas That Could Not Be Verified](#24-files--areas-that-could-not-be-verified)

---

## 1. Executive Summary

This report delivers a thorough security, architectural, and logical audit of the authentication, authorization, session, token, and security mechanisms implemented in the Nuxt 4 / Nitro application.

Every line of authentication and security logic across the client (`app/`) and server (`server/`) was inspected and verified against the actual repository source code.

### Summary of Audit Results

* **Strengths**:
  * Strong password hashing using **Argon2id WebAssembly** (`hash-wasm`) with PHC string verification and constant-time comparison (`crypto-hash.ts`).
  * Strict cookie configuration (`HttpOnly`, `SameSite: 'strict'`, `Secure: isProduction`, `Path: '/'`).
  * Separation of token signing secrets and algorithms (`ACCESS_TOKEN_SECRET` with `HS256`, `REFRESH_TOKEN_SECRET` with `HS512`).
  * Granular multi-tenant authorization guards (`requireAuthSession`, `requireWageRole`, `requireSuperAdmin`) that validate firm membership and grade.
  * Comprehensive HTTP security headers (CSP, HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy) in `security.global.ts`.
  * Extensive security audit logging (`SecurityLog` collection in MongoDB) capturing anomalies, geographic shifts, and account states.

* **Primary Security & Architectural Concerns**:
  1. **[CRITICAL] ESM Runtime Crash in Validation Helper**: `server/utils/validation.ts` uses `const { createError } = require('h3')` inside an ES module environment (`"type": "module"` in `package.json`). When schema validation fails during signup or login, Node.js throws `ReferenceError: require is not defined in ES module scope`, crashing the handler into an unhandled 500 error instead of returning a 400 validation error.
  2. **[HIGH] Plaintext Refresh Tokens in Database**: `Session.refreshToken`, `Session.previousRefreshToken`, and `TokenBlacklist.token` store raw refresh and access tokens in plain text in MongoDB. If the database is compromised, all active refresh tokens can be immediately used to forge sessions.
  3. **[HIGH] Incomplete Refresh Token Reuse / Family Revocation**: When an expired or previously rotated refresh token is submitted outside the 30-second concurrency window, the server returns 401 but fails to revoke all existing sessions of the compromised account (as recommended by RFC 6819 §5.2.2.3).
  4. **[HIGH] Triple Duplication of Token Refresh Logic & Concurrency Vulnerability**: Token refresh logic is independently implemented in three places: `server/middleware/auth.global.ts` (lines 50–185), `server/middleware/auth.global.ts` (lines 295–447), and `server/api/auth/refresh.post.ts` (lines 22–232). The middleware implementations lack atomic concurrency locking, creating race conditions during concurrent API requests from multi-tab sessions.
  5. **[HIGH] Refresh Token Validity vs. Session Validity Discrepancies**: The application mixes an immutable stateless JWT refresh token with a mutable stateful MongoDB session. If `ROTATE_REFRESH_TOKEN=false`, rolling session extensions in MongoDB are rendered useless because the underlying JWT expires statically. Furthermore, code fallback default (`7d`) conflicts with `.env` (`30d`) and MongoDB TTL (`30d`).
  6. **[HIGH] Multiple Confirmed Unexpected Auto-Logout Scenarios**: 8 distinct mechanisms trigger unprompted logouts for legitimate users, including LRU multi-device evictions, concurrent silent refresh race conditions, SSR native fetch cookie drops, and background brute-force account lockouts.
  7. **[MEDIUM] Redundant Database Query Amplification**: Every authenticated request triggers 3 redundant MongoDB queries (`TokenBlacklist.findOne`, `User.findById` in `auth.global.ts`, and `User.findById` again in `requireAuthSession`), creating unnecessary database load.
  8. **[MEDIUM] Client-Side HTTP Client Fragmentation & Failed Cookie Clears**: Client code attempts to clear HttpOnly cookies using `document.cookie` (which is a no-op for HttpOnly cookies), and multiple conflicting HTTP request wrappers exist (`apiFetch` in `useAuth.ts`, `api` in `utils/api.ts`, and an inline `api` object in `dashboard.vue`). Furthermore, `utils/api.ts` uses native `fetch()` which fails to forward cookies during SSR.

---

## 2. Application Authentication Architecture

The application is built on **Nuxt 4** (with `compatibilityVersion: 4`), using **Nitro** as the server engine, **Vue 3** on the client, **Mongoose / MongoDB** for authentication and core entities, and **PostgreSQL** for select relational data.

### Component Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             CLIENT LAYER (Vue 3)                            │
├────────────────────────────────────────┬────────────────────────────────────┤
│ Composables / State:                   │ Utilities / Transport:             │
│  - useAuth.ts (useState)               │  - utils/api.ts (fetch wrapper)    │
│  - app/middleware/auth.global.ts       │  - useAuth.apiFetch ($fetch.raw)   │
│  - Pages: login, signup, dashboard     │  - cookie: active_firm_id          │
└────────────────────────────────────────┴────────────────────────────────────┘
                                   │ HTTP (Cookies: access_token, refresh_token)
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            SERVER LAYER (Nitro)                             │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. Security Middleware (server/middleware/security.global.ts):              │
│    - Security headers (CSP, HSTS, etc.)                                     │
│    - IP Rate limiting (in-memory LRU Map)                                   │
│    - Request body & query sanitization                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│ 2. Authentication Middleware (server/middleware/auth.global.ts):            │
│    - Intercepts /api/** (excluding /api/auth/login, signup, refresh, me)    │
│    - Access token validation (JWT verification + TokenBlacklist lookup)     │
│    - Account status & lockout validation (User.findById)                    │
│    - Silent auto-refresh on missing or expired access token                 │
│    - Injects event.context.user                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│ 3. API Endpoints (server/api/auth/*):                                       │
│    - /api/auth/login.post.ts                                                │
│    - /api/auth/logout.post.ts                                               │
│    - /api/auth/refresh.post.ts                                              │
│    - /api/auth/me.get.ts                                                    │
│    - /api/auth/signup.post.ts                                               │
│    - /api/auth/security-logs.get.ts                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│ 4. Route Authorization Guards (server/utils/*):                             │
│    - requireAuthSession (auth.ts) -> validates firm access & grade          │
│    - requireSuperAdmin (admin-guard.ts) -> validates superadmin role        │
│    - requireWageRole (wage-authz.ts) -> validates operational grade         │
└─────────────────────────────────────────────────────────────────────────────┘
                                   │ Mongoose ODM
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                             DATABASE (MongoDB)                              │
├─────────────────┬─────────────────┬────────────────────┬────────────────────┤
│ Users           │ Sessions        │ TokenBlacklist     │ SecurityLogs       │
│ (Argon2id hash, │ (Refresh token, │ (Blacklisted JWTs, │ (Audit trail,      │
│  lockout state, │  device info,   │  TTL index on      │  IP, anomalies,    │
│  firm links)    │  TTL index)     │  expiresAt)        │  device fingerpr.) │
└─────────────────┴─────────────────┴────────────────────┴────────────────────┘
```

---

## 3. Complete Authentication Flow

```
[User Browser]
      │
      │ 1. POST /api/auth/login { email, password }
      ▼
[server/api/auth/login.post.ts]
      │
      ├── 1.1 Connect DB (connectDB)
      ├── 1.2 Validate payload (validateBody with loginSchema)
      ├── 1.3 Find User by email (User.findOne)
      ├── 1.4 Check user.status (reject 'pending' or 'suspended')
      ├── 1.5 Check lockout (user.checkAndUnlockAccount)
      ├── 1.6 Verify password (user.comparePassword -> Argon2id verification)
      ├── 1.7 Check suspicious geo/device velocity (detectSuspiciousActivity)
      ├── 1.8 Generate Access Token (HS256, 15m) & Refresh Token (HS512, 30d)
      ├── 1.9 Enforce MAX_ACTIVE_SESSIONS (deactivate oldest active sessions)
      ├── 1.10 Create Session in MongoDB (stores raw refreshToken, IP, device info)
      ├── 1.11 Set HttpOnly Cookies:
      │       - access_token (Max-Age: 15m, SameSite: Strict, Path: /)
      │       - refresh_token (Max-Age: 30d, SameSite: Strict, Path: /)
      └── 1.12 Return JSON: { user, accessToken, refreshToken }
      │
      ▼
[Client: useAuth.ts / login.vue]
      │
      ├── 2.1 Set client state: user.value = response.user
      ├── 2.2 Set active firm in cookie / useState
      └── 2.3 Navigate to /dashboard
      │
      ▼
[Subsequent API Request: e.g. GET /api/accounting/bills]
      │
      │ 3. Browser sends request with Cookie: access_token=...; refresh_token=...
      ▼
[server/middleware/security.global.ts]
      │ 3.1 Rate limit check & security headers attached
      ▼
[server/middleware/auth.global.ts]
      │
      ├── 3.2 Extract token from cookie (or Authorization header)
      ├── 3.3 Check isTokenBlacklisted(token) -> MongoDB query
      ├── 3.4 Verify JWT signature and claims (verifyAccessToken)
      ├── 3.5 Check user status & account lock -> User.findById(decoded.id)
      └── 3.6 Populate event.context.user = decoded
      │
      ▼
[server/api/accounting/bills.get.ts]
      │
      ├── 4.1 requireAuthSession(event)
      │       - Reads event.context.user
      │       - Reads X-Firm-ID header override
      │       - Queries User.findById(userId) again to verify firm membership
      │       - Returns { firm_id, _id, username, email }
      └── 4.2 Executes query scoped to firmId: Bill.find({ firmId: user.firm_id, ... })
```

---

## 4. Token Lifecycle

### Access Tokens

| Attribute | Implementation Details | Verified Source File & Lines |
| :--- | :--- | :--- |
| **Generation Function** | `generateAccessToken(user, deviceFingerprint?, firmId?, grade?)` | [jwt.ts](file:///c:/Users/PRAKASH/Documents/PROJECTS/FASTIFY/nuxt4/server/utils/jwt.ts#L51-L73) |
| **Algorithm** | `HS256` (HMAC-SHA256) | [jwt.ts](file:///c:/Users/PRAKASH/Documents/PROJECTS/FASTIFY/nuxt4/server/utils/jwt.ts#L68) |
| **Secret** | `process.env.ACCESS_TOKEN_SECRET` | [jwt.ts](file:///c:/Users/PRAKASH/Documents/PROJECTS/FASTIFY/nuxt4/server/utils/jwt.ts#L20-L23) |
| **Expiration** | `process.env.ACCESS_TOKEN_EXPIRY \|\| '15m'` | [jwt.ts](file:///c:/Users/PRAKASH/Documents/PROJECTS/FASTIFY/nuxt4/server/utils/jwt.ts#L69) |
| **Issuer / Audience** | `process.env.JWT_ISSUER \|\| 'nxt-auth-server'`, `process.env.JWT_AUDIENCE \|\| 'nxt-client'` | [jwt.ts](file:///c:/Users/PRAKASH/Documents/PROJECTS/FASTIFY/nuxt4/server/utils/jwt.ts#L70-L71) |
| **Claims** | `id`, `email`, `role`, `firmId`, `grade`, `deviceFingerprint`, `jti`, `iat`, `exp`, `iss`, `aud` | [jwt.ts](file:///c:/Users/PRAKASH/Documents/PROJECTS/FASTIFY/nuxt4/server/utils/jwt.ts#L57-L65) |
| **Storage (Server)** | Stateless JWT (not persisted in DB on creation) | [jwt.ts](file:///c:/Users/PRAKASH/Documents/PROJECTS/FASTIFY/nuxt4/server/utils/jwt.ts#L67) |
| **Storage (Client)** | `HttpOnly` Cookie (`access_token`, `Max-Age: 15m`, `SameSite: Strict`, `Path: /`) | [login.post.ts](file:///c:/Users/PRAKASH/Documents/PROJECTS/FASTIFY/nuxt4/server/api/auth/login.post.ts#L213-L219) |
| **Transmission** | Automatic browser cookie transmission (`credentials: 'include'`), or `Authorization: Bearer <token>` | [auth.global.ts](file:///c:/Users/PRAKASH/Documents/PROJECTS/FASTIFY/nuxt4/server/middleware/auth.global.ts#L44-L45) |
| **Validation** | `verifyAccessToken(token)` via `jsonwebtoken.verify` with strict algorithm and claim checks | [jwt.ts](file:///c:/Users/PRAKASH/Documents/PROJECTS/FASTIFY/nuxt4/server/utils/jwt.ts#L93-L112) |
| **Revocation** | Explicitly inserted into `TokenBlacklist` collection on logout or suspension | [logout.post.ts](file:///c:/Users/PRAKASH/Documents/PROJECTS/FASTIFY/nuxt4/server/api/auth/logout.post.ts#L58-L63) |

---

## 5. Refresh Token Lifecycle

| Attribute | Implementation Details | Verified Source File & Lines |
| :--- | :--- | :--- |
| **Generation Function** | `generateRefreshToken(user, deviceFingerprint?)` | [jwt.ts](file:///c:/Users/PRAKASH/Documents/PROJECTS/FASTIFY/nuxt4/server/utils/jwt.ts#L75-L91) |
| **Algorithm** | `HS512` (HMAC-SHA512) | [jwt.ts](file:///c:/Users/PRAKASH/Documents/PROJECTS/FASTIFY/nuxt4/server/utils/jwt.ts#L86) |
| **Secret** | `process.env.REFRESH_TOKEN_SECRET` | [jwt.ts](file:///c:/Users/PRAKASH/Documents/PROJECTS/FASTIFY/nuxt4/server/utils/jwt.ts#L25-L28) |
| **Expiration** | Code fallback: `'7d'`, `.env`: `30d`, Session DB TTL: `30 days` | [jwt.ts](file:///c:/Users/PRAKASH/Documents/PROJECTS/FASTIFY/nuxt4/server/utils/jwt.ts#L87), [.env](file:///c:/Users/PRAKASH/Documents/PROJECTS/FASTIFY/nuxt4/.env#L6) |
| **Database Storage** | **Plain text** in MongoDB `Session.refreshToken` and `Session.previousRefreshToken` | [Session.ts](file:///c:/Users/PRAKASH/Documents/PROJECTS/FASTIFY/nuxt4/server/models/Session.ts#L32-L33) |
| **Cookie Storage** | `HttpOnly` Cookie (`refresh_token`, `Max-Age: 30d`, `SameSite: Strict`, `Path: /`) | [login.post.ts](file:///c:/Users/PRAKASH/Documents/PROJECTS/FASTIFY/nuxt4/server/api/auth/login.post.ts#L220-L226) |
| **Rotation Trigger** | When `ROTATE_REFRESH_TOKEN === 'true'` on `/api/auth/refresh` and silent middleware refresh | [refresh.post.ts](file:///c:/Users/PRAKASH/Documents/PROJECTS/FASTIFY/nuxt4/server/api/auth/refresh.post.ts#L153-L172) |
| **Grace Period Window** | 30 seconds (`REFRESH_GRACE_PERIOD_MS = 30000`) for network retries using `previousRefreshToken` | [refresh.post.ts](file:///c:/Users/PRAKASH/Documents/PROJECTS/FASTIFY/nuxt4/server/api/auth/refresh.post.ts#L19), [security.ts](file:///c:/Users/PRAKASH/Documents/PROJECTS/FASTIFY/nuxt4/server/utils/security.ts#L175-L180) |
| **Reuse Detection Action** | Rejection with `401 Unauthorized`. **(Does not revoke token family/sessions)** | [refresh.post.ts](file:///c:/Users/PRAKASH/Documents/PROJECTS/FASTIFY/nuxt4/server/api/auth/refresh.post.ts#L94-L99) |
| **Revocation** | Deactivates `Session.isActive = false` and adds to `TokenBlacklist` | [logout.post.ts](file:///c:/Users/PRAKASH/Documents/PROJECTS/FASTIFY/nuxt4/server/api/auth/logout.post.ts#L40-L56) |

---

## 6. Session Lifecycle

### What Constitutes a Session?

A session is represented by a document in the `Session` MongoDB collection (`server/models/Session.ts`).

```typescript
export interface ISession extends Document {
  userId: mongoose.Types.ObjectId;
  refreshToken: string;
  previousRefreshToken?: string;
  previousRotatedAt?: Date;
  lastRefreshAttempt?: Date;
  deviceFingerprint: string;
  ipAddress: string;
  userAgent: string;
  deviceInfo: { browser?: string; os?: string; device?: string };
  location?: { country?: string; region?: string; city?: string };
  isActive: boolean;
  lastActivity: Date;
  expiresAt: Date;
  createdAt: Date;
  revokedAt?: Date;
  revokedReason?: string;
}
```

### Session Characteristics

* **Identification**: Identified by `refreshToken` (unique indexed string) and `userId`.
* **Expiration**: Fixed 30-day absolute expiration (`expiresAt` with MongoDB TTL index `expires: 0`).
* **Idle Inactivity**: `lastActivity` is updated on each refresh and validation. Inactivity cleanup is supported via `cleanupInactiveSessions` in `server/utils/session-cleanup.ts` (default 30 days).
* **Multi-Device / Concurrent Sessions**: Supported. On login, the system counts active sessions for the user. If `activeSessions.length >= MAX_ACTIVE_SESSIONS` (default 10, configured in `login.post.ts:155`), the least recently used sessions are marked `isActive = false`, `revokedReason = 'Exceeded maximum active sessions limit'`.
* **Concept Mixing Assessment**:
  * The application mixes stateless JWT access tokens with a stateful session store.
  * Although access tokens are cryptographically signed JWTs, the server middleware executes MongoDB lookups (`TokenBlacklist.findOne` and `User.findById`) on every single API request, negating stateless performance benefits.
  * The refresh token is both a signed JWT (HS512) and a raw lookup key in the MongoDB `Session` collection.

---

## 7. Refresh Token Validity vs. Session Validity Deep-Dive

A critical architectural finding of this audit is how the application treats **Refresh Token Validity** versus **Session Validity**. These two concepts are conceptually distinct but are currently entangled in conflicting ways.

### Conceptual Comparison

```
┌──────────────────────────────────────────────┬──────────────────────────────────────────────┐
│             REFRESH TOKEN (JWT)              │               SESSION (MONGODB)              │
├──────────────────────────────────────────────┼──────────────────────────────────────────────┤
│ Type: Stateless, cryptographically signed    │ Type: Stateful, database-persisted record    │
│ Format: HS512 JWT (header.payload.signature) │ Format: MongoDB document in 'sessions' coll  │
│ Expiry Mechanism: 'exp' claim inside JWT     │ Expiry Mechanism: 'expiresAt' field (TTL idx)│
│ Mutability: IMMUTABLE once signed            │ Mutability: MUTABLE (updated on refresh)     │
│ Validation: jwt.verify(token, secret)        │ Validation: Session.findOne({ isActive: true })│
│ Storage: HttpOnly cookie + DB plaintext field│ Storage: MongoDB document                    │
└──────────────────────────────────────────────┴──────────────────────────────────────────────┘
```

### Discrepancy & Failure Matrix

| Area | Refresh Token (JWT) | Session (MongoDB Document) | Conflict / Impact |
| :--- | :--- | :--- | :--- |
| **Default Fallback Expiry** | `jwt.ts:87` falls back to `'7d'` if `REFRESH_TOKEN_EXPIRY` is unset. | `login.post.ts:149`, `auth.global.ts:137`, `refresh.post.ts:170` hardcode `30 days`. | If env is omitted, the cryptographic JWT expires in 7 days, causing `verifyRefreshToken` to throw `TOKEN_EXPIRED` after 7 days, even though the database session is valid for 30 days. |
| **Rolling Session Behavior when Rotation is Disabled (`ROTATE_REFRESH_TOKEN=false`)** | Token signature has static `exp` calculated at initial login. | `session.expiresAt` is updated to `now + 30 days` on every refresh attempt. | **Broken Rolling Session**: Extending `expiresAt` in MongoDB has zero effect because the unrotated JWT will still fail `jwt.verify()` when its original lifetime expires. |
| **Revocation Synchronization** | The JWT remains cryptographically valid until its `exp` timestamp. | `session.isActive = false` immediately invalidates the session record. | Because the JWT cannot be self-invalidating, the server is forced to query MongoDB on every refresh to check `session.isActive`. |
| **Grace Period State** | The previous JWT contains a valid cryptographic signature and future `exp`. | `session.previousRefreshToken` and `session.previousRotatedAt` restrict validity to a 30s window. | Cryptographic verification passes, but database logic rejects it with `401: Rotation grace period elapsed`. |

### Conclusion on Validity Coupling
The application uses JWTs for refresh tokens but derives none of the stateless benefits of JWTs because every refresh operation requires querying, updating, and saving a stateful MongoDB `Session` document. Conversely, using a JWT creates failure points where cryptographic expiration preempts database session extensions.

---

## 8. Unexpected Auto-Logout Scenarios & Root Causes

Through comprehensive tracing of the client (`useAuth.ts`, `app/middleware/auth.global.ts`, `utils/api.ts`) and server (`server/middleware/auth.global.ts`, `server/api/auth/*`), we have identified **8 distinct scenarios that cause unprompted, unexpected logouts** for legitimate users.

### Scenario 1: Multi-Device / Multi-Tab LRU Session Eviction

* **Trigger**: A user is logged in on multiple browsers, devices, private windows, or work/home computers.
* **Mechanism**:
  1. In `server/api/auth/login.post.ts` (lines 155–171), the server enforces `MAX_ACTIVE_SESSIONS` (default 10).
  2. When the user logs in for the 11th time, the server queries all active sessions, sorts by `lastActivity: 1` (oldest first), and deactivates the excess sessions:
     ```typescript
     s.isActive = false;
     s.revokedAt = new Date();
     s.revokedReason = 'Exceeded maximum active sessions limit';
     await s.save();
     ```
  3. When the user returns to their oldest device/tab and performs an action after the 15-minute access token expires, the client attempts to refresh.
  4. `refresh.post.ts` finds `anySession && !anySession.isActive` and throws `401 Session deactivated: Exceeded maximum active sessions limit`.
  5. In `useAuth.ts:178`, this 401 triggers `logout({ reason: 'session_limit' })`, kicking the user back to `/login`.

---

### Scenario 2: Concurrent API Request Race Condition During Token Expiration

* **Trigger**: A user opens a page that issues multiple concurrent API calls (e.g. Dashboard loading GST status, member lists, stock inventory, and recent bills simultaneously) right as their 15-minute `access_token` expires.
* **Mechanism**:
  1. All 4 requests arrive at `server/middleware/auth.global.ts` at the exact same millisecond with an expired access token.
  2. `auth.global.ts` (lines 375–386) does NOT use atomic MongoDB locking. All 4 requests read the same `session` document with the old `refreshToken`.
  3. All 4 requests independently execute `newRefreshToken = generateRefreshToken(user)` and execute `await session.save()`.
  4. The 4 requests save 4 distinct new refresh tokens into the database in rapid sequence.
  5. The client browser receives 4 conflicting `Set-Cookie: refresh_token=...` response headers. Whichever cookie the browser stores last may not match what was written in MongoDB, or the 30-second grace window is corrupted.
  6. The next API request or page transition fails with `401 Unauthorized: Refresh token does not match session`, forcing an auto-logout.

---

### Scenario 3: Broken Rolling Session when Rotation is Disabled

* **Trigger**: The server administrator sets `ROTATE_REFRESH_TOKEN=false` in `.env`.
* **Mechanism**:
  1. User logs in. A refresh token JWT is generated with a 30-day `exp`.
  2. The user actively uses the application every day for 30 days.
  3. On each daily refresh, `refresh.post.ts` executes:
     ```typescript
     session.expiresAt = new Date(Date.now() + SESSION_TTL_MS); // Extended by 30 days
     ```
  4. On Day 31, the user is actively working. `session.expiresAt` in MongoDB is set to Day 61.
  5. However, `verifyRefreshToken(refreshToken)` runs *before* database lookup. Because the original JWT was signed on Day 1 with a 30-day `exp`, `jwt.verify` throws `TokenExpiredError`.
  6. The server throws `401 Invalid or expired refresh token` without checking the database. The user is abruptly logged out despite continuous daily activity.

---

### Scenario 4: Background Tab Sleeping & Throttling Beyond the 30s Grace Window

* **Trigger**: A user has multiple tabs open. Tab A is active and triggers a token rotation. Tab B is placed into background/sleep mode by modern browser tab-discarding/throttling features for several minutes.
* **Mechanism**:
  1. Tab A rotates the refresh token. `session.previousRefreshToken` is set to the old token, and `session.previousRotatedAt = new Date()`.
  2. Tab B wakes up 2 minutes later and sends a queued request with the old refresh token.
  3. `server/utils/security.ts:175-180` and `refresh.post.ts:107-109` check:
     ```typescript
     const isGraceWindowHit = session.previousRefreshToken === refreshToken &&
       (Date.now() - new Date(session.previousRotatedAt).getTime() < 30000);
     ```
  4. Because 120 seconds have elapsed (> 30s grace period), `isGraceWindowHit` is `false`.
  5. The server rejects Tab B with `401 Refresh token does not match session`.
  6. Tab B's client interceptor catches the 401 and calls `useAuth.logout()`, clearing user state across all tabs.

---

### Scenario 5: Background Brute-Force Password Attacks Locking Out Active Users

* **Trigger**: An external attacker attempts to brute-force a user's password via `POST /api/auth/login`.
* **Mechanism**:
  1. After 5 failed password attempts, `User.incrementFailedLogins()` calls `this.lockAccount(30)` (`User.ts:98`).
  2. `user.isAccountLocked` is set to `true`, and `accountLockedUntil` is set to 30 minutes in the future.
  3. Meanwhile, the legitimate user is actively working in their authenticated session.
  4. On the user's next API call, `server/middleware/auth.global.ts` (lines 272–288) executes:
     ```typescript
     const isLocked = await user.checkAndUnlockAccount();
     if (isLocked) {
       throw createError({
         statusCode: 403,
         statusMessage: 'Account locked due to suspicious activity'
       });
     }
     ```
  5. The active user's request is rejected with `403 Account locked`.
  6. The client interceptor catches the 403 and immediately forces an auto-logout.

---

### Scenario 6: Transient Network Flukes Triggering Client-Side Logout Purge

* **Trigger**: A temporary network hiccup, gateway timeout, or proxy reset causes an in-flight refresh request to fail with a non-200 status.
* **Mechanism**:
  1. In `useAuth.ts:165-179`:
     ```typescript
     if (status === 401 || status === 403) {
       logout({ redirect: options.redirectIfFailed, reason });
     }
     ```
  2. If an intermediate reverse proxy (e.g. Cloudflare, Nginx, Vercel) returns a 401 or 403 during a deployment or brief outage, `rotateToken()` treats it as an unrecoverable auth failure, wipes `user.value = null`, and redirects the user to `/login`.

---

### Scenario 7: SSR Request Cookie Loss in `utils/api.ts`

* **Trigger**: A page or component executes data fetching during SSR using `api.get()` from `utils/api.ts`.
* **Mechanism**:
  1. `utils/api.ts:78` uses Node.js global `fetch(finalUrl, { credentials: 'include' })`.
  2. In Node.js, global `fetch` does NOT have access to the browser's incoming cookies (unlike Nuxt's `useRequestFetch()`).
  3. The request arrives at Nitro with zero cookies, returning `401 Unauthorized`.
  4. `utils/api.ts:87` attempts `auth.rotateToken()`, which also runs on the server without cookies and fails.
  5. The SSR render catches the failure, treats the user as unauthenticated, and renders the logged-out state or redirects to `/login`.

---

### Scenario 8: Fallback Expiry Mismatch between `jwt.ts` and Database

* **Trigger**: The application is deployed in an environment where `REFRESH_TOKEN_EXPIRY` is missing from environment variables.
* **Mechanism**:
  1. `jwt.ts:87` defaults to `7d` for the refresh token JWT signature.
  2. `Session.ts:149` sets the database session TTL to `30 days`.
  3. The user expects to stay logged in for 30 days.
  4. On Day 8, `verifyRefreshToken` fails with `TOKEN_EXPIRED`.
  5. The user is logged out unexpectedly after exactly 7 days.

---

### 8.1 Forensic Analysis of the Real Console Error Logs (Single-Device / Single-Day)

The following terminal log sequence was captured from a live session where a user was logged into **only 1 device** and had authenticated **today (August 21, 2026)**:

```text
ERROR [Middleware] Auto-refresh failed when no access token: Unauthorized: Session not found or inactive  9:40:35 pm
Method: GET | Path: /api/accounting/ledger/trial-balance?toDate=2026-08-21
Method: GET | Path: /api/accounting/ledger/vouchers-summary
Method: GET | Path: /api/accounting/ledger/journal-summary
Method: GET | Path: /api/banking
Method: GET | Path: /api/accounting/coa
Method: GET | Path: /api/labor/periods

[Refresh] Looking for session: { userId: '6a116b908a70df2218b89cfa', hasRefreshToken: true, refreshTokenPrefix: 'eyJhbGciOiJIUzUxMiIs' }  9:40:38 pm
[Refresh] Session not found. Debug info: {
  userId: '6a116b908a70df2218b89cfa',
  anySessionFound: true,
  anySessionActive: false,
  tokenMatches: false,
  sessionRevokedReason: 'Exceeded maximum active sessions limit',
  sessionRevokedAt: 2026-08-17T21:43:10.501Z
}
Method: POST | Path: /api/auth/refresh
Message: Session deactivated: Exceeded maximum active sessions limit

ERROR Method: POST | Path: /api/auth/logout                                                               9:40:39 pm
ERROR Message: Unauthorized: Session not found or inactive
```

#### Step-by-Step Chain Reaction Analysis:

1. **The Concurrency Cascade (9:40:35 pm)**:
   * The user opened the page. The client fired 6 API requests in parallel (`trial-balance`, `vouchers-summary`, `journal-summary`, `banking`, `coa`, `labor/periods`).
   * Because the 15-minute `access_token` had expired, all 6 requests entered `auth.global.ts` line 50 at the exact same millisecond.
   * **Request #1** found the session and rotated the refresh token, setting `session.previousRefreshToken = token_0` and `session.refreshToken = token_1`.
   * **Request #2** arrived 10ms later with `token_0`, found the session via `previousRefreshToken`, and rotated it AGAIN, setting `session.previousRefreshToken = token_1` and `session.refreshToken = token_2`.
   * **Requests #3, #4, #5, #6** arrived with `token_0`. Because `token_0` was pushed completely out of both `refreshToken` and `previousRefreshToken` slots, MongoDB queries returned `null`.
   * `validateSession` returned `{ valid: false, reason: 'Session not found or inactive' }`, throwing 401 across all remaining requests.

2. **The Misleading Debug Query Bug in `refresh.post.ts` (9:40:38 pm)**:
   * When `findOneAndUpdate` failed to find the active session with `token_0`, line 76 executed:
     ```typescript
     const anySession = await Session.findOne({ userId: decoded.id }).lean();
     ```
   * Because `Session.findOne({ userId })` did NOT specify a sort order (such as `{ createdAt: -1 }`) and did not filter by `isActive: true`, MongoDB returned the oldest historical document in natural order.
   * That old document was a deactivated session from **August 17, 2026** (`sessionRevokedAt: 2026-08-17T21:43:10.501Z`, `sessionRevokedReason: 'Exceeded maximum active sessions limit'`).
   * Lines 89–93 saw `anySession && !anySession.isActive` and threw:
     `Session deactivated: Exceeded maximum active sessions limit`.
   * **Result**: The server reported a completely false error message attributing the failure to a 4-day-old multi-device limit event, obscuring the fact that a concurrency race condition had just corrupted the single active session.

3. **The Blocked Logout Bug (9:40:39 pm)**:
   * After receiving the 401, the client attempted to clean up by calling `POST /api/auth/logout`.
   * In `auth.global.ts` (lines 26–34), `/api/auth/logout` was **NOT** in the exempt route list.
   * `auth.global.ts` intercepted the logout call, attempted to auto-refresh the broken session, failed, and threw `401 Unauthorized: Session not found or inactive` **before `/api/auth/logout` could execute**.
   * **Result**: The server was unable to clear the user's HttpOnly cookies, leaving broken cookies in the browser.

4. **The Nitro / Youch WebAssembly Source-Map Crash (`unreachable`)**:
   * When Nitro's error-formatting middleware (`youch-core`) attempted to resolve source maps for the thrown 401 errors, `BasicSourceMapConsumer` encountered Argon2id's WebAssembly binary module in memory and crashed with `ERROR unreachable at wasm://wasm/...`.

---

## 9. Client-Side Authentication Review

### State Storage & Architecture

1. **State Store (`app/composables/useAuth.ts`)**:
   * Uses Nuxt 4 `useState` for SSR-safe shared reactivity:
     * `user = useState<User | null>('auth_user', () => null)`
     * `selectedFirmId = useState<string | null>('auth_firm_id', () => null)`
     * `isInitialized = useState<boolean>('auth_initialized', () => false)`
   * Active firm selection is persisted in a browser cookie via `useCookie('active_firm_id')`.
2. **Initialization (`initAuth`)**:
   * Runs in `app/middleware/auth.global.ts` on route transitions.
   * Calls `GET /api/auth/me` with `credentials: 'include'` using `useRequestFetch()` on SSR or `$fetch` on client.
   * If `/api/auth/me` returns 401, invokes `rotateToken({ redirectIfFailed: false })`, then retries `/api/auth/me`.
3. **Singleton Refresh Lock**:
   * `clientRefreshPromise` (in `useAuth.ts:23`) prevents redundant concurrent `/api/auth/refresh` calls on the client.

### Client-Side Issues & Anti-Patterns

1. **Attempting to Clear HttpOnly Cookies via `document.cookie`**:
   * In `useAuth.ts:110-111` and `useAuth.ts:168-169`:
     ```typescript
     document.cookie = 'access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
     document.cookie = 'refresh_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
     ```
   * **Problem**: Because `access_token` and `refresh_token` are set with the `HttpOnly` flag by the server, browser JavaScript cannot modify or delete them via `document.cookie`. Only server-sent `Set-Cookie: ...; Max-Age=0` headers (sent by `/api/auth/logout`) can clear them.
2. **Duplicated HTTP Client Utilities**:
   * Three distinct fetching abstractions exist:
     * `useAuth.ts:apiFetch` (wraps `$fetch.raw`, attaches `X-Firm-ID`).
     * `utils/api.ts:api` (wraps native `fetch`, attaches `X-Firm-ID`, retries on 401).
     * `pages/dashboard.vue:api` (inline wrapper around `apiFetch`).
   * Some pages/composables call `api.get`, some call `apiFetch`, and some call `$fetch` directly.
3. **SSR Fetch Cookie Loss in `utils/api.ts`**:
   * `utils/api.ts` uses native `fetch()` at line 78. In Node.js SSR runtime, native `fetch` does not possess browser session cookies and will send unauthenticated requests resulting in 401s if invoked during SSR data loading.

---

## 10. Server-Side Authentication Review

### Source of Truth

The single source of truth for request authentication is `server/middleware/auth.global.ts`.

### How Routes are Intercepted

1. **Exempt Paths**:
   * `/api/auth/login`
   * `/api/auth/signup`
   * `/api/auth/refresh`
   * `/api/auth/me` (handles its own token verification)
   * `/api/_nuxt_icon/**`
   * `/api/firms` (GET only — for firm selection)
   * `/api/health`, `/api/info`
2. **Protected API Routes**:
   * All other routes starting with `/api/**` are intercepted.
   * If an access token is missing or expired (`TOKEN_EXPIRED`), the middleware automatically attempts a silent refresh if a `refresh_token` cookie or `x-refresh-token` header is present.
   * If successful, the middleware sets new cookies, populates `event.context.user`, and lets the downstream handler execute without returning 401 to the client.

### Server-Side Inconsistencies & Weaknesses

1. **Triplicated Token Refresh Implementation**:
   * **Location 1**: `server/middleware/auth.global.ts` lines 50–185 (when access token is missing).
   * **Location 2**: `server/middleware/auth.global.ts` lines 295–447 (when access token throws `TOKEN_EXPIRED`).
   * **Location 3**: `server/api/auth/refresh.post.ts` lines 22–232 (dedicated endpoint).
   * *Risk*: The three blocks have divergent locking logic: `refresh.post.ts` uses `findOneAndUpdate` with race condition mitigation, while `auth.global.ts` uses non-atomic `findOne` + `session.save()`, creating race conditions during concurrent middleware silent refreshes.
2. **Inconsistent Security Checks in `/api/auth/me`**:
   * `/api/auth/me` was exempted from `auth.global.ts` to "handle its own auth".
   * However, `me.get.ts`:
     * Ignores `Authorization: Bearer` headers (only checks `getCookie(event, 'access_token')`).
     * Does not check `isTokenBlacklisted(accessToken)`.
     * Does not verify account lockout (`checkAndUnlockAccount()`).
     * Does not check if `user.status === 'suspended'`.
     * Does not invoke `connectDB()` before querying Mongoose.

---

## 11. Authorization Review

The application implements a clear, hierarchical multi-tenant Role-Based Access Control (RBAC) model.

### Roles and Hierarchy

1. **System Roles** (`User.role`):
   * `superadmin`: Global platform administrator. Can access all database maintenance endpoints, view global security logs, manage all firms, and bypass firm membership checks.
   * `standard`: Standard organization user. Scoped strictly to assigned firms.
2. **Firm Membership Grades** (`User.firms[i].grade`):
   * `Owner`: Full management authority over the firm (firm settings, members, accounting, wages, banking).
   * `Admin`: Administrative authority within the firm.
   * `Manager`: Operational management (e.g. wages, labor, bills).
   * `Staff`: Basic data entry and read operations.

### Authorization Guards

* **`requireAuthSession(event)`** (`server/utils/auth.ts`):
  * Verifies user context and validates that the user is either a `superadmin` or holds an active membership in the target firm (`x-firm-id` header or JWT `firmId` claim).
  * Returns `AuthSession = { firm_id: ObjectId, _id: ObjectId, username, email }`.
  * Used in ~30+ API endpoints across accounting, master-rolls, wages, labor, and inventory.
* **`requireSuperAdmin(event)`** (`server/utils/admin-guard.ts`):
  * Verifies that `event.context.user.role === 'superadmin'`.
  * Protects MongoDB/Postgres database viewers, system config update, security logs, user management, and session cleanup.
* **`requireWageRole(event, session, allowedGrades)`** (`server/utils/wage-authz.ts`):
  * Verifies that the user holds a specific grade (`Owner`, `Admin`, etc.) within the target firm before processing sensitive wage operations.

---

## 12. Security Vulnerability Findings

### Finding 1: ESM Runtime Crash in Validation Helper

* **Severity**: **Critical**
* **Location**: [server/utils/validation.ts:75](file:///c:/Users/PRAKASH/Documents/PROJECTS/FASTIFY/nuxt4/server/utils/validation.ts#L75)
* **Code**:
  ```typescript
  // validation.ts Line 75:
  const { createError } = require('h3');
  throw createError({
    statusCode: 400,
    statusMessage: 'Validation failed',
    data: { errors }
  });
  ```
* **Explanation**: The project is configured as a native ECMAScript Module (`"type": "module"` in `package.json`). CommonJS `require()` is not defined in ESM scope.
* **Impact**: Whenever a user submits invalid signup data (e.g. short password, invalid email) or invalid login data, `validateBody` crashes Node.js with `ReferenceError: require is not defined in ES module scope`, returning an unhandled 500 internal server error instead of a 400 validation error.
* **Remediation**: Replace `const { createError } = require('h3')` with a static top-level import: `import { createError } from 'h3';`.

---

### Finding 2: Plaintext Refresh Tokens Stored in Database

* **Severity**: **High**
* **Location**: [server/models/Session.ts:32-33](file:///c:/Users/PRAKASH/Documents/PROJECTS/FASTIFY/nuxt4/server/models/Session.ts#L32-L33), [server/models/TokenBlacklist.ts:12](file:///c:/Users/PRAKASH/Documents/PROJECTS/FASTIFY/nuxt4/server/models/TokenBlacklist.ts#L12)
* **Code**:
  ```typescript
  // Session.ts:
  refreshToken: { type: String, required: true, unique: true, index: true },
  previousRefreshToken: { type: String, index: true },
  ```
* **Explanation**: The application stores raw, signed refresh JWT strings directly in MongoDB documents without cryptographic hashing.
* **Impact**: If an attacker gains read access to the database (via backup exposure, query injection, or database compromise), they obtain valid refresh tokens that can be immediately used to generate access tokens and hijack user sessions until token expiration.
* **Remediation**: Hash refresh tokens with SHA-256 before storing them in MongoDB (`Session.refreshTokenHash = hashToken(refreshToken)`), and query by hash.

---

### Finding 3: Missing Token Family Revocation on Refresh Token Reuse

* **Severity**: **High**
* **Location**: [server/api/auth/refresh.post.ts:74-105](file:///c:/Users/PRAKASH/Documents/PROJECTS/FASTIFY/nuxt4/server/api/auth/refresh.post.ts#L74-L105)
* **Code**:
  ```typescript
  if (!session) {
    // ...
    if (anySession && !tokenMatches) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Refresh token does not match session'
      });
    }
  }
  ```
* **Explanation**: RFC 6819 §5.2.2.3 dictates that when a rotated refresh token is presented outside its grace window, it indicates that an attacker has intercepted or replayed a token. The authentication server MUST invalidate all refresh tokens and sessions belonging to that token family. Currently, the server only throws 401 and leaves the active session running.
* **Impact**: An attacker with a captured previous refresh token who tries to refresh gets rejected, but the legitimate user is not protected; the attacker can still attempt other stolen tokens without triggering session invalidation.
* **Remediation**: When an invalid or outdated token matching a previous session is detected outside the grace window, call `revokeAllSessions(decoded.id, 'Refresh token reuse detected')`.

---

### Finding 4: Silent Middleware Refresh Concurrency Race Condition

* **Severity**: **High**
* **Location**: [server/middleware/auth.global.ts:129-150](file:///c:/Users/PRAKASH/Documents/PROJECTS/FASTIFY/nuxt4/server/middleware/auth.global.ts#L129-L150) and [auth.global.ts:375-397](file:///c:/Users/PRAKASH/Documents/PROJECTS/FASTIFY/nuxt4/server/middleware/auth.global.ts#L375-L397)
* **Code**:
  ```typescript
  // auth.global.ts:
  const session = await Session.findOne({ refreshToken: refreshTokenValue, userId: decodedRefresh.id, isActive: true });
  // ...
  newRefreshToken = generateRefreshToken(user, deviceFingerprint);
  session.previousRefreshToken = refreshTokenValue;
  session.previousRotatedAt = new Date();
  session.refreshToken = newRefreshToken;
  await session.save();
  ```
* **Explanation**: When a client with an expired access token makes two concurrent HTTP requests (e.g. loading dashboard widgets), both requests hit `auth.global.ts` simultaneously. Unlike `refresh.post.ts` (which uses atomic `findOneAndUpdate` with a 5-second rotation window), `auth.global.ts` does not perform atomic locking. Both requests read the same session, generate two different new refresh tokens, and execute race-condition overwrites.
* **Impact**: One of the two concurrent requests overwrites the session with a different token than what was sent to the browser, leading to intermittent `401 Unauthorized` errors and session desynchronization.
* **Remediation**: Centralize token refresh into a single helper function (`performTokenRefresh`) that uses atomic MongoDB operations and lock windows.

---

### Finding 5: Raw Tokens Returned in JSON Response Bodies

* **Severity**: **Medium**
* **Location**: [server/api/auth/login.post.ts:236-237](file:///c:/Users/PRAKASH/Documents/PROJECTS/FASTIFY/nuxt4/server/api/auth/login.post.ts#L236-L237), [server/api/auth/refresh.post.ts:218-219](file:///c:/Users/PRAKASH/Documents/PROJECTS/FASTIFY/nuxt4/server/api/auth/refresh.post.ts#L218-L219)
* **Code**:
  ```typescript
  // login.post.ts:
  return {
    user: { id: user._id, name: user.name, email: user.email, role: user.role, firms: firmsMapped },
    accessToken,
    refreshToken
  };
  ```
* **Explanation**: The server properly sets `HttpOnly` cookies for both `access_token` and `refresh_token`. However, it also includes the plaintext tokens in the JSON response body.
* **Impact**: Returning tokens in JSON undermines the security benefit of `HttpOnly` cookies. Any XSS vulnerability or client-side logging tool can read the tokens from response payloads.
* **Remediation**: Remove `accessToken` and `refreshToken` from JSON responses when cookies are enabled.

---

### Finding 6: Bypassed Security Checks in `/api/auth/me`

* **Severity**: **Medium**
* **Location**: [server/api/auth/me.get.ts:1-63](file:///c:/Users/PRAKASH/Documents/PROJECTS/FASTIFY/nuxt4/server/api/auth/me.get.ts#L1-L63)
* **Explanation**: `/api/auth/me` is exempted from global middleware and performs its own authentication. However, it fails to verify `TokenBlacklist`, ignores user suspended status (`user.status === 'suspended'`), ignores account lock (`user.isAccountLocked`), ignores `Authorization: Bearer` headers, and does not ensure DB connectivity.
* **Impact**: A suspended user whose access token is not yet expired can still retrieve their user profile via `/api/auth/me`.
* **Remediation**: Route `/api/auth/me` through standard middleware authentication or use `requireAuthSession(event)`.

---

### Finding 7: Redundant Database Queries on Every Request

* **Severity**: **Low / Performance Impact**
* **Location**: [server/middleware/auth.global.ts:212, 249](file:///c:/Users/PRAKASH/Documents/PROJECTS/FASTIFY/nuxt4/server/middleware/auth.global.ts#L212), [server/utils/auth.ts:43](file:///c:/Users/PRAKASH/Documents/PROJECTS/FASTIFY/nuxt4/server/utils/auth.ts#L43)
* **Explanation**: On every single API request, the server executes:
  1. `TokenBlacklist.findOne({ token, expiresAt: { $gt: new Date() } })` in `auth.global.ts`
  2. `User.findById(decoded.id)` in `auth.global.ts`
  3. `User.findById(userOid).lean()` in `requireAuthSession()` inside the endpoint handler.
* **Impact**: 3 round-trips to MongoDB for every authenticated request, adding latency and unnecessary database load.
* **Remediation**: Attach the verified user document to `event.context.userDoc` in `auth.global.ts` so `requireAuthSession()` can reuse it without re-querying MongoDB.

---

## 13. Logic and Flow Problems

1. **Client-side `document.cookie` clearing**:
   * `useAuth.ts:110-111` and `168-169` attempt `document.cookie = 'access_token=; path=/; expires=...'`. Because cookies are set with `HttpOnly`, this operation is completely ignored by browsers. Client state gets reset to `user.value = null`, but browser cookies remain intact until `/api/auth/logout` is called.
2. **Inconsistent Expiry Configuration**:
   * `jwt.ts:87` falls back to `7d` for refresh token expiry.
   * `.env:6` specifies `REFRESH_TOKEN_EXPIRY=30d`.
   * `Session.ts` sets TTL to `30 days`.
   * If `.env` is omitted, the JWT expires in 7 days while the database session expires in 30 days, causing early token expiration failures.
3. **Double `loginSchema` validation**:
   * `login.post.ts:23` uses `validateBody(loginSchema, body)` which calls `loginSchema.safeParse`.
   * If validation fails, `validation.ts` crashes due to the `require('h3')` issue instead of returning a clean error.

---

## 14. Duplication and Centralization Problems

### Duplicated Responsibilities

| Responsibility | Current Locations | Problems Caused | Recommended Single Source |
| :--- | :--- | :--- | :--- |
| **Token Refresh** | 1. `auth.global.ts:50-185`<br>2. `auth.global.ts:295-447`<br>3. `refresh.post.ts:22-232` | Concurrency bugs, divergent logic, maintenance nightmare | `server/services/authService.ts` -> `refreshSessionTokens()` |
| **Access Token Verification** | 1. `auth.global.ts:227`<br>2. `me.get.ts:19` | Inconsistent checks (me.get skips blacklist & lock checks) | Centralize in `auth.global.ts` |
| **User Entity Retrieval** | 1. `auth.global.ts:249`<br>2. `requireAuthSession:43` | 2 redundant DB queries per request | Fetch once in middleware and attach to `event.context.userDoc` |
| **Client HTTP Calls** | 1. `useAuth.ts:apiFetch`<br>2. `utils/api.ts:api`<br>3. `dashboard.vue:api` | Fragmented retry logic, inconsistent headers, SSR bugs | Single `useApi()` composable wrapping `$fetch` / `useRequestFetch` |

---

## 15. Over-Engineering Review

### What is Good and Should be Kept

* **Argon2id WebAssembly Hashing** (`crypto-hash.ts`): State-of-the-art password hashing.
* **HttpOnly Cookie Architecture**: Protects tokens from direct JavaScript XSS exfiltration.
* **Multi-tenant Firm Scoping** (`requireAuthSession`): Robust access control preventing horizontal privilege escalation between firms.
* **TTL-based Blacklisting & Session Expiry**: Clean MongoDB auto-purging of expired sessions and tokens.

### What is Unnecessary and Should be Removed or Simplified

1. **Weak Header-Based Device Fingerprinting**:
   * `generateDeviceFingerprint` in `security.ts:14-25` hashes `User-Agent`, `Accept-Language`, and `Accept-Encoding`.
   * The code contains comments admitting this is a weak, easily spoofable signal that causes false positives during browser updates. It is not used for hard gating.
   * *Recommendation*: Remove fingerprinting from the core token payload; rely on IP velocity and session table tracking.
2. **Silent Middleware Auto-Refresh Complexity**:
   * Having the server middleware intercept requests with expired access tokens and silently rotate refresh tokens during standard data fetching creates race conditions and complex cookie rewriting.
   * *Recommendation*: Let expired access tokens return standard `401 Unauthorized` (`TOKEN_EXPIRED`). Let the client's HTTP interceptor call `POST /api/auth/refresh` once, rotate tokens, and transparently retry the request.

---

## 16. Current Architecture Diagram

```
                     ┌───────────────────────────┐
                     │        Nuxt 4 Client      │
                     │  (useState: auth_user)    │
                     └─────────────┬─────────────┘
                                   │
               ┌───────────────────┴───────────────────┐
               │                                       │
     Cookie: access_token                    Cookie: refresh_token
     (HttpOnly, Max-Age 15m)                 (HttpOnly, Max-Age 30d)
               │                                       │
               ▼                                       ▼
 ┌───────────────────────────┐           ┌───────────────────────────┐
 │   server/middleware/      │           │   server/api/auth/        │
 │     auth.global.ts        │           │    refresh.post.ts        │
 ├───────────────────────────┤           ├───────────────────────────┤
 │ 1. TokenBlacklist.findOne │           │ 1. verifyRefreshToken     │
 │ 2. verifyAccessToken      │           │ 2. Session.findOneAndUpdate│
 │ 3. User.findById (lock)   │           │ 3. Check 30s grace window │
 │ [If expired: silent       │           │ 4. Generate new tokens    │
 │  refresh duplicate logic] │           │ 5. Set new cookies        │
 └─────────────┬─────────────┘           └─────────────┬─────────────┘
               │                                       │
               ▼                                       │
 ┌───────────────────────────┐                         │
 │     API Route Handler     │                         │
 │ (e.g. /api/wages/...)     │                         │
 ├───────────────────────────┤                         │
 │ requireAuthSession(event) │                         │
 │ -> User.findById again!   │                         │
 └─────────────┬─────────────┘                         │
               │                                       │
               ▼                                       ▼
 ┌───────────────────────────────────────────────────────────────────┐
 │                       MongoDB Collections                         │
 │  - Users (Argon2id password hashes, lock status, firms)           │
 │  - Sessions (PLAINTEXT refresh tokens, IP, expiresAt)             │
 │  - TokenBlacklist (PLAINTEXT blacklisted tokens, TTL index)       │
 │  - SecurityLogs (Security audit events)                           │
 └───────────────────────────────────────────────────────────────────┘
```

---

## 17. Real-Code Evidence

### Evidence 1: ESM `require()` Bug in `server/utils/validation.ts`

* **File**: `server/utils/validation.ts`
* **Lines**: 74–81
```typescript
    // Import createError dynamically to avoid circular dependencies
    const { createError } = require('h3');
    throw createError({
      statusCode: 400,
      statusMessage: 'Validation failed',
      data: { errors }
    });
```
* **Analysis**: `package.json` specifies `"type": "module"`. When invalid body data is passed to `validateBody()`, execution hits `require('h3')`, causing `ReferenceError: require is not defined in ES module scope`.

---

### Evidence 2: Plaintext Refresh Token Storage in `Session.ts`

* **File**: `server/models/Session.ts`
* **Lines**: 30–36
```typescript
const SessionSchema: Schema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  refreshToken: { type: String, required: true, unique: true, index: true },
  previousRefreshToken: { type: String, index: true },
  previousRotatedAt: { type: Date },
  lastRefreshAttempt: { type: Date },
  deviceFingerprint: { type: String, required: true, index: true },
```
* **Analysis**: The full refresh token string is indexed and stored in plain text.

---

### Evidence 3: Triplicated Silent Refresh in `auth.global.ts` (Missing Atomic Concurrency Lock)

* **File**: `server/middleware/auth.global.ts`
* **Lines**: 375–396
```typescript
              // RT-B1: Support token rotation in silent refresh when enabled
              let newRefreshToken = refreshTokenValue;
              const shouldRotate = process.env.ROTATE_REFRESH_TOKEN === 'true';
              if (shouldRotate) {
                newRefreshToken = generateRefreshToken(user, deviceFingerprint);
                session.previousRefreshToken = refreshTokenValue;
                session.previousRotatedAt = new Date();
                session.refreshToken = newRefreshToken;
                session.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
              } else {
                session.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
              }

              // RT-B3: Update session metadata (IP, user agent, device info, location, last activity)
              const clientIP = getRequestIP(event, { xForwardedFor: true }) || 'unknown';
              const userAgent = getHeader(event, 'user-agent') || 'unknown';
              session.ipAddress = clientIP;
              session.userAgent = userAgent;
              session.deviceInfo = parseDeviceInfo(userAgent);
              session.location = getLocationFromIP(clientIP);
              session.lastActivity = new Date();
              await session.save();
```
* **Analysis**: Unlike `refresh.post.ts`, this code executes a non-atomic `findOne` followed by `session.save()`. Concurrent API calls with expired access tokens race to rotate and overwrite the session token.

---

### Evidence 4: Bypassed Blacklist and Lockout Checks in `/api/auth/me.get.ts`

* **File**: `server/api/auth/me.get.ts`
* **Lines**: 6–26
```typescript
export default defineEventHandler(async (event) => {
  // Get token from cookie
  const accessToken = getCookie(event, 'access_token');
  
  if (!accessToken) {
    throw createError({
      statusCode: 401,
      statusMessage: 'No access token'
    });
  }

  try {
    // Verify the token
    const decoded = verifyAccessToken(accessToken);
    
    // Fetch user from database
    const user = await User.findById(decoded.id)
      .select('-password -securitySettings')
      .populate({ path: 'firms.firm', model: Firm })
      .lean();
```
* **Analysis**: Does not check `isTokenBlacklisted()`, does not verify `user.status !== 'suspended'`, does not check `user.checkAndUnlockAccount()`, does not check `Authorization` header, and does not call `connectDB()`.

---

## 18. Detailed Examples & Edge-Case Traces

### Example 1 — Normal Login Flow

1. User enters email and password on `/login`.
2. Client sends `POST /api/auth/login`.
3. Server validates body with `loginSchema` (Zod), finds user, checks status (`active`), verifies Argon2id password hash, resets failed login counter.
4. Server generates `accessToken` (15m) and `refreshToken` (30d).
5. Server creates a `Session` record in MongoDB, sets two HttpOnly cookies (`access_token`, `refresh_token`), and returns `{ user, accessToken, refreshToken }`.
6. Client updates `user.value` state in memory and navigates to `/dashboard`.

---

### Example 2 — Access Token Expiration & Silent Refresh

1. After 15 minutes, `access_token` expires.
2. User clicks on "Bills" -> client issues `GET /api/accounting/bills`.
3. `auth.global.ts` intercepts the request, calls `verifyAccessToken(token)` which throws `TOKEN_EXPIRED`.
4. Catch block extracts `refresh_token` from cookie, validates signature with `verifyRefreshToken`, validates session in DB, and checks user status.
5. If `ROTATE_REFRESH_TOKEN=true`, generates a new access token and refresh token, updates `Session` in DB, updates HttpOnly cookies in response headers, populates `event.context.user`, and lets `bills.get.ts` execute.
6. The request succeeds transparently without user disruption.

---

### Example 3 — Explicit Refresh via Client Interceptor

1. Client utility (`utils/api.ts`) sends an API request.
2. If server returns 401, client `api` interceptor calls `auth.rotateToken()`.
3. `rotateToken()` checks `clientRefreshPromise` lock. If none is active, it calls `POST /api/auth/refresh`.
4. `refresh.post.ts` verifies refresh token, updates session with `findOneAndUpdate`, issues new cookies, and returns new tokens.
5. Client retries the original request with new cookies.

---

### Example 4 — Refresh Token Expiration

1. User is inactive for >30 days; `refresh_token` expires.
2. User makes a request -> `auth.global.ts` fails to verify access token and refresh token.
3. Middleware throws `401 Unauthorized: Invalid or expired token`.
4. Client route middleware redirects user to `/login?reason=session_expired`.

---

### Example 5 — Logout Flow

1. User clicks Logout.
2. Client calls `POST /api/auth/logout`.
3. Server deactivates session (`isActive = false, revokedReason = 'User logout'`), adds `refreshToken` and `accessToken` to `TokenBlacklist` collection in MongoDB with TTL index, and sets `Set-Cookie: access_token=; Max-Age=0` and `Set-Cookie: refresh_token=; Max-Age=0`.
4. Client resets `user.value = null`, `selectedFirmId.value = null`, and redirects to `/login`.

---

### Example 6 — Concurrent API Requests During Token Expiration

1. User opens dashboard with 4 simultaneous queries (`/firms/settings/gst`, `/firms/:id/members`, `/inventory/stock`, `/accounting/bills`).
2. If `access_token` is expired, all 4 requests hit `auth.global.ts` at the same instant.
3. Because `auth.global.ts` lacks atomic locking, all 4 attempt to rotate the same refresh token in MongoDB simultaneously.
4. **Current Bug**: One request finishes last, overwriting the session token in MongoDB. The client receives multiple cookie updates in parallel. Subsequent requests may fail with `401 Refresh token does not match session`.

---

### Example 7 — Multi-Device & Session Limit

1. User logs in from 10 different browsers/devices (`MAX_ACTIVE_SESSIONS = 10`).
2. On 11th login, `login.post.ts` queries active sessions, finds 10, sorts by `lastActivity: 1` (oldest first), and deactivates the least recently used session (`isActive = false, revokedReason = 'Exceeded maximum active sessions limit'`).
3. If the user returns to Device 1, its next refresh attempt fails with `401 Session deactivated: Exceeded maximum active sessions limit`.

---

### Example 8 — Stolen / Replayed Refresh Token

1. Attacker steals an old refresh token that was already rotated 1 hour ago.
2. Attacker sends `POST /api/auth/refresh`.
3. Server checks DB: token matches neither `session.refreshToken` nor `session.previousRefreshToken` (30s grace elapsed).
4. Server rejects request with `401 Refresh token does not match session`.
5. **Current Bug**: The server fails to revoke the user's active session, allowing the legitimate user and any other attacker tokens to continue operating.

---

### Example 9 — SSR Request Execution

1. User navigates directly to `/dashboard` (F5 reload or direct URL).
2. Nuxt SSR server renders the page.
3. `app/middleware/auth.global.ts` invokes `initAuth()`.
4. `initAuth()` calls `useRequestFetch('/api/auth/me')`, forwarding incoming SSR cookies to Nitro.
5. Nitro validates the cookie, returns user data, and populates `useState('auth_user')`.
6. Nuxt serializes `useState` into HTML payload for client hydration.

---

### Example 10 — Client Hydration

1. Client receives HTML and hydrated `useState('auth_user')`.
2. `app/middleware/auth.global.ts` runs on client navigation.
3. `initAuth()` checks `if (isInitialized.value && user.value) return;` (idempotency guard).
4. Client avoids redundant network calls and renders the authenticated UI immediately without layout shift.

---

## 19. Severity Classification

| Issue ID | Vulnerability / Issue | Severity | Status | Architectural Change Required? |
| :--- | :--- | :--- | :--- | :--- |
| **SEC-01** | `require('h3')` ESM crash in `validation.ts` | **Critical** | Confirmed | No (Fix import statement) |
| **SEC-02** | Plaintext Refresh Tokens stored in MongoDB | **High** | Confirmed | Yes (Add SHA-256 token hashing) |
| **SEC-03** | Missing Token Family Revocation on Reuse | **High** | Confirmed | Yes (Revoke all user sessions on reuse) |
| **SEC-04** | Race Condition in Middleware Silent Refresh | **High** | Confirmed | Yes (Centralize refresh service with locking) |
| **SEC-05** | Refresh Token vs. Session Validity Discrepancies | **High** | Confirmed | Yes (Align JWT `exp` with DB session TTL) |
| **SEC-06** | Raw JWTs exposed in JSON response bodies | **Medium** | Confirmed | No (Strip tokens from JSON payloads) |
| **SEC-07** | Inconsistent auth/security checks in `/me` | **Medium** | Confirmed | No (Unify with standard middleware/guard) |
| **SEC-08** | Client attempted `document.cookie` clears on HttpOnly cookies | **Medium** | Confirmed | No (Remove dead code; rely on `/logout`) |
| **SEC-09** | Inconsistent Refresh Token Expiry fallbacks | **Low** | Confirmed | No (Align constants to 30d across files) |
| **SEC-10** | 3x DB queries per request (Performance) | **Low** | Confirmed | Yes (Pass `userDoc` in `event.context`) |

---

## 20. Recommended Architecture

### Proposed Design

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             CLIENT LAYER (Vue 3)                            │
├─────────────────────────────────────────────────────────────────────────────┤
│  - Single useApi() composable (auto-attaches X-Firm-ID, handles 401 retry)  │
│  - Single useAuth() composable (manages useState('auth_user'))              │
│  - Zero client-side token parsing or localStorage persistence               │
└─────────────────────────────────────────────────────────────────────────────┘
                                   │ HTTP (Cookies: access_token, refresh_token)
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           NITRO SERVER PIPELINE                             │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. Security Middleware (server/middleware/01.security.global.ts):           │
│    - Security headers, CORS, in-memory rate limiting                        │
├─────────────────────────────────────────────────────────────────────────────┤
│ 2. Authentication Middleware (server/middleware/02.auth.global.ts):         │
│    - Extracts access_token cookie                                           │
│    - Verifies JWT signature & claims                                        │
│    - Checks in-memory/Redis TokenBlacklist cache                            │
│    - Single DB query: User.findById(decoded.id) -> attaches to context      │
│    - If access token expired: Returns 401 (TOKEN_EXPIRED)                   │
│      (Leaves refresh responsibility to client interceptor to avoid races)   │
├─────────────────────────────────────────────────────────────────────────────┤
│ 3. Centralized Auth Service (server/services/authService.ts):               │
│    - authenticateUser(email, password, event)                               │
│    - refreshSession(refreshToken, event) -> Atomic locking + SHA256 hashes  │
│    - terminateSession(refreshToken, userId, event)                          │
│    - revokeAllUserSessions(userId, reason)                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│ 4. Route Authorization Guards (server/utils/auth.ts):                       │
│    - requireAuthSession(event) -> reads event.context.userDoc (0 new DB queries) │
│    - requireWageRole(event, allowedGrades)                                  │
│    - requireSuperAdmin(event)                                               │
└─────────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DATABASE LAYER                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│ - Session collection stores refreshTokenHash (SHA-256) instead of plaintext │
│ - TokenBlacklist collection stores tokenHash (SHA-256) with TTL index       │
│ - User collection stores Argon2id password hash                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 21. Migration & Refactoring Plan

### Phase 1 — Immediate Critical & High Security Fixes

1. **Fix `server/utils/validation.ts`**: Replace dynamic `require('h3')` with top-level `import { createError } from 'h3';`.
2. **Hash Refresh Tokens in Database**:
   * Update `server/models/Session.ts` to store `refreshTokenHash: string` and `previousRefreshTokenHash: string`.
   * When creating or rotating tokens, compute `hashToken(refreshToken)` using SHA-256 before saving to MongoDB.
3. **Implement Token Family Revocation on Reuse**:
   * In refresh handler, if an outdated refresh token is received outside the 30-second grace window, immediately call `revokeAllSessions(decoded.id, 'Token reuse detected')`.
4. **Remove Raw Tokens from JSON Responses**:
   * Modify `login.post.ts` and `refresh.post.ts` to return only `{ user }` and `{ success: true }`. Tokens remain securely encapsulated in `HttpOnly` cookies.

### Phase 2 — Centralize Authentication & Eliminate Duplication

1. **Create `server/services/authService.ts`**:
   * Move login credential validation, session creation, token generation, and token rotation into a single service.
   * `login.post.ts`, `refresh.post.ts`, and `logout.post.ts` become thin controller endpoints calling `authService`.
2. **Simplify Server Middleware**:
   * Remove the two massive silent refresh duplicate blocks (lines 50–185 and 295–447) from `server/middleware/auth.global.ts`.
   * On expired access tokens, simply throw `401 TOKEN_EXPIRED`. Let client-side `useApi()` catch 401, call `/api/auth/refresh` once, and retry.
3. **Fix `/api/auth/me`**:
   * Make `/api/auth/me` use standard `requireAuthSession(event)` so it inherits all security, lockout, and blacklist checks.

### Phase 3 — Optimize Performance & Database Round-Trips

1. **Attach `userDoc` to Event Context**:
   * In `auth.global.ts`, when `User.findById(decoded.id)` is fetched to check lockout status, assign `event.context.userDoc = user`.
   * In `requireAuthSession(event)`, read `event.context.userDoc` directly instead of querying MongoDB a second time.

### Phase 4 — Client-Side Simplification

1. **Unify HTTP Transport**:
   * Remove `utils/api.ts` and `dashboard.vue:api`.
   * Provide a single, robust `useApi()` composable that wraps Nuxt's `$fetch` / `useRequestFetch()`, automatically injects `X-Firm-ID`, and uses a singleton promise lock to refresh tokens on 401 responses.
2. **Remove Dead Cookie-Clearing Code**:
   * Remove `document.cookie = 'access_token=; ...'` statements from `useAuth.ts`.

---

## 22. Testing Strategy

| Test Case | Scenario | Expected Result |
| :--- | :--- | :--- |
| **TC-01: Valid Login** | Submit correct credentials | Returns user object, sets HttpOnly `access_token` and `refresh_token` cookies, redirects to `/dashboard`. |
| **TC-02: Invalid Body** | Submit short password (<8 chars) | Returns `400 Bad Request` with structured validation errors (no 500 ESM crash). |
| **TC-03: Account Lockout** | 5 consecutive wrong passwords | Account locks for 30 minutes; subsequent attempts return `403 Account locked`. |
| **TC-04: Suspended User** | Admin marks user `status: 'suspended'` | Next API request immediately rejected with `403 Account suspended`; tokens blacklisted. |
| **TC-05: Access Token Expiry** | Wait 15m or mock expired JWT | Client receives 401, triggers single `/api/auth/refresh`, rotates tokens, retries original request transparently. |
| **TC-06: Concurrent Refresh** | 5 simultaneous requests with expired access token | Singleton lock fires exactly 1 refresh request; all 5 requests complete successfully. |
| **TC-07: Refresh Token Reuse** | Attacker replays old rotated refresh token after 35s | Request rejected with 401; all active sessions for that user account are revoked. |
| **TC-08: Max Active Sessions** | User logs in from 11th device | 1st device session deactivated; 11th device active. |
| **TC-09: Logout** | User logs out | Cookies cleared (`Max-Age=0`), session marked `isActive: false`, tokens blacklisted. |
| **TC-10: SSR Hydration** | Direct reload on `/dashboard` | SSR renders authenticated HTML; client hydrates without flicker or 401s. |

---

## 23. Files Reviewed

* `nuxt4/server/middleware/auth.global.ts`
* `nuxt4/server/middleware/security.global.ts`
* `nuxt4/server/utils/jwt.ts`
* `nuxt4/server/utils/auth.ts`
* `nuxt4/server/utils/security.ts`
* `nuxt4/server/utils/crypto-hash.ts`
* `nuxt4/server/utils/validation.ts`
* `nuxt4/server/utils/admin-guard.ts`
* `nuxt4/server/utils/wage-authz.ts`
* `nuxt4/server/utils/trusted-ips.ts`
* `nuxt4/server/utils/session-cleanup.ts`
* `nuxt4/server/models/User.ts`
* `nuxt4/server/models/Session.ts`
* `nuxt4/server/models/TokenBlacklist.ts`
* `nuxt4/server/models/SecurityLog.ts`
* `nuxt4/server/api/auth/login.post.ts`
* `nuxt4/server/api/auth/logout.post.ts`
* `nuxt4/server/api/auth/refresh.post.ts`
* `nuxt4/server/api/auth/me.get.ts`
* `nuxt4/server/api/auth/signup.post.ts`
* `nuxt4/server/api/auth/security-logs.get.ts`
* `nuxt4/app/composables/useAuth.ts`
* `nuxt4/app/utils/api.ts`
* `nuxt4/app/middleware/auth.global.ts`
* `nuxt4/app/app.vue`
* `nuxt4/app/pages/login.vue`
* `nuxt4/app/pages/signup.vue`
* `nuxt4/app/pages/dashboard.vue`
* `nuxt4/server/api/accounting/bills.get.ts`
* `nuxt4/server/api/accounting/parties.get.ts`
* `nuxt4/server/api/advances.post.ts`
* `nuxt4/server/api/ai-chat/chat.post.ts`
* `nuxt4/server/api/firms.get.ts`
* `nuxt4/nuxt.config.ts`
* `nuxt4/package.json`
* `nuxt4/.env` & `nuxt4/.env.example`

---

## 24. Files / Areas That Could Not Be Verified

* **Multi-Instance / Cluster Rate Limiting**: The current rate limiter uses an in-memory Map (`server/middleware/security.global.ts`). Whether a distributed Redis cache is planned for multi-instance deployments cannot be confirmed from the codebase.
* **External Email / MFA Verification**: There is no email verification or multi-factor authentication (SMS/TOTP) implemented in the current codebase.

---

## 25. Final Risk Summary

The application has established strong foundational security practices (Argon2id hashing, HttpOnly cookies, multi-tenant firm validation, security headers). However, the critical ESM `require()` crash in `validation.ts`, plaintext refresh token persistence in MongoDB, lack of token-family revocation on reuse, and triplicated refresh logic in the middleware create tangible operational and security risks. 

Following the 5-phase refactoring plan outlined in Section 21 will eliminate these vulnerabilities and simplify the codebase into a clean, maintainable, enterprise-grade authentication architecture.
