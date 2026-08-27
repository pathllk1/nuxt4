# TODO / Fix Checklist: Refresh Token Rotation Idle-Wakeup Recovery

**Companion to**: `AUTH_SELF_HEAL_FINGERPRINT_BUG_REPORT.md`
**Date**: August 27, 2026
**Updated**: Reprioritized after production log capture confirmed the primary mechanism
(see Finding 0 in the bug report) — distributed lock is now Phase 1, not Phase 3.

---

## Phase 0 — Gather remaining evidence

- [x] Reproduce and capture the exact error — **done: "Session not found or expired"
      escalating to "Refresh token has been revoked", see Finding 0**
- [x] Confirm deployment target — **confirmed: Vercel (serverless)**
- [ ] Confirm whether `security.ts::validateSession()` is called from any active
      route/middleware, or is dead code (grep for `validateSession(`)
- [ ] DevTools → Application → Cookies: confirm `refresh_token` cookie value actually
      changes after one normal, non-idle refresh cycle (low priority now — see Finding 4
      in the report, largely explained by Phase 1's root cause instead)

---

## Phase 1 — Fix the distributed lock (Finding 3 / Finding 0 — now the primary fix)

This is the fix that actually explains the captured production logs. Do this first.

- [ ] Replace `inFlightRefreshes` (in-memory `Map` in `authService.ts` line 32) with a
      shared lock that works across serverless instances. Options, in order of
      simplicity given the existing stack (Mongo, no Redis mentioned so far):
  - [ ] Atomic `findOneAndUpdate` on the `Session` document itself — add a
        `refreshLockedUntil` timestamp field; a request only proceeds with rotation
        if it can atomically claim the lock (`refreshLockedUntil < now`), else it
        waits briefly and re-reads the session for the winning result instead of
        rotating again itself
  - [ ] OR: a dedicated `RefreshLock` collection keyed by `sessionId`, same atomic-claim
        pattern, auto-expiring via TTL index as a safety net
  - [ ] OR: Redis if it gets added to the stack later — simplest primitive for this,
        worth it only if Redis is justified elsewhere too
- [ ] Add a test simulating N concurrent refresh calls with the same stale token
      **across separate process/module instances** (not just parallel promises in one
      process — that would still pass with the old in-memory Map and hide the bug);
      assert only one rotation occurs in the database, and only one winning cookie
      value is returned across all N responses
- [ ] Sanity-check after deploying: confirm the `refresh_token` cookie value in DevTools
      stays consistent across a burst of parallel page-load requests (this doubles as
      the Phase 0 Set-Cookie check, now expected to just work)

---

## Phase 2 — Fix the fingerprint hard-gate (Finding 1)

Real bug, contradicts its own code comment, but did **not** fire in the captured
incident — do this after Phase 1, not instead of it.

- [ ] In `authService.ts` self-heal branch (~lines 124–146): stop revoking all sessions
      purely on fingerprint mismatch. Pick one:
  - [ ] Downgrade to match `security.ts`'s Fix #18 behavior — log as
        `anomaly_detected` (medium severity) and let self-heal proceed regardless
        of fingerprint, **or**
  - [ ] Only escalate to `revokeAllSessions()` when there's evidence of *conflicting*
        concurrent usage — i.e. the session's current (non-stale) `refreshToken` has
        *also* already been used/rotated by a separate request — not merely "headers
        differ from last time"
- [ ] Apply the same decision to `security.ts::validateSession()` lines 176–210,
      **or** confirm it's dead code (Phase 0) and delete it instead

---

## Phase 3 — Resolve duplicate logic (Finding 2)

- [ ] Decide: keep `performTokenRefresh()` as the single source of truth (per its own
      docstring) and delete `validateSession()`, **or** make `validateSession()`
      delegate to `performTokenRefresh()` instead of reimplementing it
- [ ] Grep all callers of `validateSession` before removing/refactoring

---

## Phase 4 — Regression prevention

- [ ] Integration test: single device, simulate rotation, wait past grace period,
      replay the old token → expect self-heal (200), not revocation
- [ ] Integration test: two different fingerprints presenting the same rotated-out
      token → expect revocation (confirms genuine-theft path still works)
- [ ] Integration test: N parallel requests with a stale token, simulated across
      separate instances → expect exactly one DB rotation, not N, and no client ever
      ends up holding a cookie more than one hop behind the database

---

## Phase 5 — Client-side polish (Finding 5, low priority)

- [ ] Deduplicate the client's 401-handling logout trigger — logs show `/api/auth/logout`
      firing twice within ~120ms for the same failure cascade. Add a simple in-flight
      guard so only one logout request is sent per failure episode.

---

## Open question to resolve before Phase 2

- [ ] Is fingerprint-based device matching meant to be a security control at all,
      given the function's own comment disclaims it as spoofable? If a real "same
      device" signal is needed, consider a long-lived random device ID set once at
      login in a separate (non-httpOnly, low-sensitivity) cookie, checked here instead
      of derived from volatile request headers.
