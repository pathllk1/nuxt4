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

**Status: implemented and deployed. Serialization confirmed working — but see Phase 1b,
a second bug in the same function reintroduced the same symptom through a different path.**

- [x] Replace `inFlightRefreshes` (in-memory `Map`) with an atomic Mongo CAS lock on
      `Session.refreshLockedUntil`
- [x] Winner/loser split correctly implemented — losers poll and return access-token-only
- [x] Test simulating N concurrent refresh calls with the same stale token — deployed to
      production and confirmed the pure simultaneous-contention case is fixed
- [x] Sanity-checked after deploying — **but see Phase 1b: a fresh production incident on
      the same day shows the bug persists via a different code path in the same function**

---

## Phase 1b — Fix the cooldown-branch cookie authority bug (Finding 6 — FIXED)

- [x] In `authService.ts` step 7's `else` branch (cooldown / rotation-disabled path): explicitly set `isLockLoser = true` before returning. This branch never performs a rotation write, so it must never be treated as authoritative for the `refresh_token` cookie.
- [x] (Secondary, defense-in-depth) In both winner branches, re-fetch / use `lockedSession` values (`lockedSession.refreshToken`, `lockedSession.previousRefreshToken`, `lockedSession.previousRotatedAt`) directly from the fresh post-CAS-lock document rather than the pre-lock `session` snapshot — closes the TOCTOU gap for stragglers.

---

## Phase 2 — Fix the fingerprint hard-gate (Finding 1)

**Status: implemented.** The self-heal branch now logs `anomaly_detected` instead of
revoking on fingerprint mismatch, and writes the updated fingerprint back to the session.

- [x] Downgraded to a logged anomaly instead of `revokeAllSessions()` — self-heal proceeds
      regardless of fingerprint mismatch
- [x] Stored fingerprint updated on mismatch so the anomaly doesn't re-fire indefinitely
- [x] `security.ts::validateSession()` — confirmed dead code (Finding 2), deleted from `security.ts`

---

## Phase 3 — Resolve duplicate logic (Finding 2)

**Status: Completed.** `validateSession()` was deleted from `security.ts`.

- [x] Delete `validateSession()` from `security.ts` now that it's confirmed unused — duplicate logic removed.

---

## Phase 4 — Regression prevention

- [x] Concurrency validation: Distributed lock serializes concurrent refresh calls, winners rotate atomically, losers return access-token-only (`isLockLoser = true`), and cooldown stragglers never clobber cookies (`isLockLoser = true`).
- [x] Environment variable toggle: Verified `ROTATE_REFRESH_TOKEN=true` and `ROTATE_REFRESH_TOKEN=false` both operate without desynchronization.

---

## Phase 5 — Client-side polish (Finding 5)

**Status: Implemented.** `useAuth.ts` contains `clientInitAuthPromise` singleton lock, `logoutInFlight` guard, and a 2-second `LOGOUT_COOLDOWN_MS` throttle.

- [x] Added `clientInitAuthPromise` singleton lock to `initAuth()` in `useAuth.ts`
- [x] Added in-flight guard and 2-second cooldown to `logout()` in `useAuth.ts`

---

## Open question to resolve before Phase 2

- [ ] Is fingerprint-based device matching meant to be a security control at all,
      given the function's own comment disclaims it as spoofable? If a real "same
      device" signal is needed, consider a long-lived random device ID set once at
      login in a separate (non-httpOnly, low-sensitivity) cookie, checked here instead
      of derived from volatile request headers.
