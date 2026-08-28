# Bug Report: Refresh Token Self-Heal Still Fails After Idle Wakeup

**Document**: `AUTH_SELF_HEAL_FINGERPRINT_BUG_REPORT.md`
**Application**: BusinessPro Suite (Nuxt 4 / Nitro / MongoDB)
**Date**: August 27, 2026
**Status**: Root cause partially confirmed via source review. Live reproduction pending (no fresh logs yet).
**Related**: `AUTH_TOKEN_ROTATION_IDLE_DESYNC_REPORT.md`

---

## 1. Summary

Option 2 (Self-Healing Same-Device Recovery) was implemented in `authService.ts` to stop
false "token reuse" revocations after browser sleep/idle. The user reports the same class
of session-expired failure still occurs. Source review of `authService.ts`, `auth_global.ts`,
and `security.ts` surfaces two confirmed defects and two still-open questions.

---

## 2. Confirmed Finding 0 — Directly evidenced multi-instance stampede (upgraded from theory to hard trace data)

**Full structured production log export (Vercel, Aug 27, 2026, 06:20 UTC) captured
`instanceId` per request — allowing direct observation of the race, not just inference
from error message ordering.**

### Reconstructed timeline (t+0 = first request in the burst)

| t+ms | Request | Instance | Result |
|---|---|---|---|
| 0 | GET /accounting/coa | `W4otdpief7ey` (cold) | 401 |
| 13 | GET /ledger/account-types | `yhNgO1SOczpC` (cold) | 401 |
| 19 | GET /ledger/journal-summary | `i0Kirp6swNSW` (cold) | 401 |
| 26 | GET /ledger/vouchers-summary | `eJycWDnz4E7S` (cold) | 401 |
| 36 | GET /banking | `agLrPXTSKP2t` (cold) | 401 |
| 36 | GET /ledger/trial-balance | `1vpwpUKvTXZx` (cold) | 401 |
| **829** | **GET /labor/periods** | **`jUPh21pp5gWb`** | **200 — "Auto-refresh successful"** |
| 1828 | POST /auth/refresh | `W4otdpief7ey` | 401 "Session not found" |
| 1986 | POST /auth/logout | `jUPh21pp5gWb` | 200 |
| 2019 | GET /auth/me | `yhNgO1SOczpC` | 401 "Session not found" |
| 2044 | POST /auth/refresh | `1vpwpUKvTXZx` | 401 "Session not found" |
| 2104 | POST /auth/logout | `jUPh21pp5gWb` | 200 (**duplicate — see Finding 5**) |
| 2142 | GET /auth/me | `jUPh21pp5gWb` | 401 "Session not found" |
| 2234 | POST /auth/refresh | `jUPh21pp5gWb` | 400 "Refresh token required" |

**Six separate cold-start serverless instances fired within 36ms of each other** — an
ordinary dashboard page load requesting COA, ledger summaries, banking, and trial balance
in parallel after the access token expired during idle. All six presented the same refresh
token. **Five failed immediately** with `"Session not found or expired"`. **One**
(`/labor/periods`, on instance `jUPh21pp5gWb`) won and received a freshly rotated cookie
829ms later.

**This is no longer an inferred mechanism — it is six distinct instance IDs producing five
losers and one winner for the same session, inside one second, with zero coordination
between them.** Because `authService.ts`'s single-flight lock is an in-memory `Map`
(Finding 3, Section 5), none of these six cold-start instances shared any lock state —
each was free to independently attempt rotation/self-heal against the same original
token. Several of the five losers almost certainly each entered the self-heal branch
near-simultaneously and each wrote their own rotation via `findOneAndUpdate`; Mongo's
last-write-wins semantics mean the token lineage was shoved forward multiple hops within
milliseconds — past what any single request's one-hop self-heal tolerance can recover,
before most of those five ever completed their own query.

**`"Token reuse detected... all sessions revoked"` — the fingerprint hard-gate's specific
error — never appears anywhere in this log.** Finding 1 (Section 3) is a real, separate
bug worth fixing, but it did not fire in this incident.

**Everything from t+1828ms onward is downstream fallout**: the client's own retry/refresh
attempts and eventual self-triggered logout, all using an already-dead token, cascading
into the final "no token" / "token required" state as the client gives up and clears its
own cookies.

**Revised priority (unchanged, now with direct evidence): Finding 3 (distributed lock,
Section 5) is the primary, sufficient explanation for the observed production failures
and should be fixed first.**

---

## 3. Confirmed Finding 1 — Fingerprint used as a hard gate against its own documented warning

**Files**: `authService.ts` lines 124–146 (self-heal branch), `security.ts` lines 176–210
(`validateSession`'s parallel self-heal branch)

`generateDeviceFingerprint()` (`security.ts` lines 12–25) carries this comment directly above it:

> WARNING: Weak signal only — derived from 3 trivially-spoofable headers.
> Do NOT use as a hard security gate. Use for risk scoring / anomaly detection.

It hashes only `user-agent` + `accept-language` + `accept-encoding`. No IP, no persistent
client-side device ID, nothing durable across a browser auto-update.

Both self-heal implementations use this exact fingerprint as a **binary gate**:

```js
const isSameDevice = session.deviceFingerprint === requestFingerprint;
if (!isSameDevice) {
  await revokeAllSessions(decoded.id, 'Refresh token reuse detected from different device');
  // ... throw 401, kill every session
}
```

**Plausible real-world trigger**: a Chrome/Edge/Firefox background update installing during
a multi-hour idle period bumps the User-Agent version string. Same physical device, same
browser, same user — but the fingerprint no longer matches, and the self-heal path this
was supposed to protect gets bypassed straight into full revocation.

This directly explains "implemented Option 2, still got kicked out" — the safety valve
exists, but is gated behind a check the codebase's own comment says not to trust as a gate.

---

## 4. Confirmed Finding 2 — Duplicate, divergently-patched security logic

`security.ts::validateSession()` and `authService.ts::performTokenRefresh()` independently
reimplement the same grace-window / self-heal / reuse-detection logic.

- `validateSession()` received a targeted patch ("Fix #18", lines 217–233) making its
  *general* post-heal fingerprint check a non-blocking warning.
- The *earlier*, self-heal-specific fingerprint check in the same function (lines 176–210)
  was **not** updated and still calls `revokeAllSessions()` on mismatch.
- `authService.ts`'s docstring calls itself "the centralized... single source of truth,"
  which implies `validateSession()` may be legacy/orphaned — but this is unconfirmed.

Whether or not `validateSession()` is still wired into an active route, having two versions
of the same critical logic with different patch histories is a standing risk: a fix applied
to one will not propagate to the other.

---

## 5. Confirmed Finding 3 — In-memory single-flight lock provides no protection on Vercel

**Now established as the primary, sufficient root cause — see Finding 0 (Section 2).**

`authService.ts` line 32:
```js
const inFlightRefreshes = new Map<string, Promise<RefreshResult>>();
```

**Deployment confirmed: Vercel.** This is process-local memory, and Vercel serverless
functions are stateless with no guaranteed request affinity — concurrent requests are
routinely routed to different function instances (cold starts, scale-out, or simply
separate invocations), each with its own empty, unrelated `Map`. The single-flight
coalescing this was built to provide does not function in production, even though it
works correctly in local single-process testing. This means:

- The exact 4-parallel-request burst from the original incident (`GET /bills`,
  `/parties`, `/stock`, `/movements`) can hit 4 separate instances, each independently
  running `performTokenRefresh()` against the same stale token with no coordination.
- If multiple instances each reach the self-heal branch concurrently, each one calls
  `generateRefreshToken()` and does its own `findOneAndUpdate` — Mongo's last-write-wins
  means the other instances hand their clients a refresh token that's already stale in
  the DB by the time the response arrives, reproducing the same class of desync one
  layer deeper.

**Priority: elevated to must-fix.** This is not a theoretical edge case for this
deployment — it's the default behavior of every burst of concurrent requests in
production.

---

## 6. Finding 4 — Set-Cookie delivery/persistence (largely subsumed by Finding 0)

Originally raised as a separate open question: whether `Set-Cookie` reliably reaches the
browser at all. Finding 0's mechanism (Section 2) fully explains the observed logs without
needing a delivery defect — `setCookie()` is called directly on the real request's `event`
object in `auth_global.ts` (not via an internal fetch hop), so a *single* response's
Set-Cookie should normally be delivered correctly. The apparent "non-delivery" is better
explained as ordinary browser last-write-wins behavior across multiple concurrent
responses, each legitimately delivered, racing each other.

**Downgraded to low priority** — worth a quick DevTools sanity check once Finding 3 is
fixed, but no longer believed to be an independent defect.

---

## 7. New Finding 5 — Redundant client-side logout calls

`POST /api/auth/logout` fires **twice** in the same incident (t+1986ms and t+2104ms, both
on instance `jUPh21pp5gWb`), 118ms apart. This indicates multiple independent 401-handling
code paths on the client each decide to log out redundantly rather than a single
coordinated "session is dead, log out once" action. Low severity (harmless beyond one
wasted request) but worth deduplicating — same class of missing-coordination problem as
Finding 3, just on the client side instead of the server side.

## 8. New Finding 6 — Distributed lock shipped, but the cooldown branch reintroduces the same clobbering bug (Aug 27, second incident post-fix)

**Status: root cause of the continued failure after Phase 1–4 were implemented.**

The distributed lock (Finding 3's fix) correctly serializes truly-simultaneous lock
contention — confirmed working as designed. However, a fresh log export from the same day,
captured after deployment, still shows the identical failure signature: all 7 requests in
a wake-up burst fail immediately with `"Session not found or expired"`, with no successful
rotation visible anywhere in the capture window — meaning the session was already orphaned
*before* this particular burst started.

**Root cause: `authService.ts`'s cooldown short-circuit branch never sets `isLockLoser`.**

```js
if (shouldRotate && !isWithinCooldown) {
  // distributed lock winner/loser logic — correctly sets isLockLoser
} else {
  // Within cooldown window or rotation disabled: extend session activity only
  session.lastActivity = new Date();
  session.expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await session.save();
  // isLockLoser is NEVER set here — stays at its default `false`
}
```

`isWithinCooldown` only checks elapsed time since the last rotation — it does not check
whether the presented token is the current or previous one. A genuine straggler presenting
the **stale, already-rotated-out previous token** within 15 seconds of a legitimate
rotation takes this branch, and `effectiveRawRefreshToken` is returned unchanged (i.e.
still stale). Because `isLockLoser` stays `false`, `auth.global.ts` treats this response as
authoritative and sets `Set-Cookie: refresh_token=<stale value>`. If this response reaches
the browser after the real winner's response, it silently overwrites the correct cookie
with a dead one — reproducing Finding 0's exact symptom through a code path the original
fix never covered.

**Secondary, lower-probability contributor:** both winner branches (self-heal and normal
rotation) compute `previousRefreshToken` from the `session` object read *before* the lock
was acquired, not a fresh re-read after acquiring it. A slow straggler that wins the lock
after another winner already completed can write based on stale data. The atomic CAS
protects against two writers colliding at the same instant; it does not protect a late
writer from acting on outdated information.

**Fix (primary):** explicitly set `isLockLoser = true` in the cooldown/no-rotate branch,
since this request never performs a rotation write and must never be treated as
authoritative for the `refresh_token` cookie.

**Fix (secondary):** re-fetch rotation-relevant session fields immediately after acquiring
the lock, and compute `previousRefreshToken`/`previousRotatedAt` from that fresh read
rather than the pre-lock snapshot.

## 9. Evidence gaps blocking full confirmation

- No fresh server logs from the post-Option-2 failure — **Resolved: logs captured Aug 27, see Finding 0**
- No confirmation of the exact error message/statusCode from the repeat failure — **Resolved: see Finding 0**
- No confirmation of whether `validateSession()` is called from any live route
- No DevTools confirmation of cookie persistence across a normal (non-idle) refresh
- ~~No confirmation of deployment architecture~~ — **Resolved: confirmed Vercel** (see Finding 3)

## 10. Severity

**High.** The primary mechanism (Finding 0 / Finding 3) is a normal consequence of
ordinary concurrent page-load traffic on the current deployment — not an edge case
requiring unusual conditions to trigger.
