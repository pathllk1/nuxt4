# Wages System Bug Report — `nxt` App

> Comprehensive audit of the wages subsystem in the `nxt` Nuxt 3 application
> This report documents the **original** bugs found, the fixes already applied, and **remaining issues** after those fixes.
> Audit dates: 2026-08-04 (initial), 2026-08-05 (re-audit)
> **Re-audit status**: 6 of the 8 remaining issues from the initial audit have been fixed since the report was written. Only 2 issues remain.

---

## Section A: Issues Resolved (Already Fixed)

The following bugs were identified in the initial audit and have been **fixed** in the current codebase:

### Fixed: Data Consistency — Orphaned DRAFT Wages on Ledger Failure
**Original file**: `server/utils/wage-job-processor.ts`
**Fix**: `processWageJob` now creates a **per-wage** Mongoose session/transaction. If `postWageLedger()` throws, the inner `catch` aborts that wage's transaction, ensuring no wage record is persisted without its ledger entries.

### Fixed: `LOCKED` Status Never Set
**Fix**: New endpoint `nxt/server/api/wages/[id]/lock.post.ts` allows transitioning a `POSTED` wage to `LOCKED`. Only `Owner`/`Admin` roles can lock.

### Fixed: Mass Assignment in Wage Update
**Fix**: `nxt/server/api/wages/[id].put.ts` now uses an `EDITABLE_FIELDS` allowlist instead of `Object.assign(wage, body)`.

### Fixed: `wages_data` Not Persisted
**Fix**: `nxt/server/api/wages/bulk.post.ts` now saves `wages_data: wages` on the WageJob document. `processWageJob` reads from `job.wages_data` instead of accepting it as a parameter.

### Fixed: Division by Zero
**Fix**: `wage-job-processor.ts` now validates `wage_days > 0` before processing and guards the division.

### Fixed: No Role-Based Authorization (Most Endpoints)
**Fix**: `requireWageRole` helper created in `nxt/server/utils/wage-authz.ts`. Most endpoints now call it:
- `wages/bulk.post.ts` → `['Owner', 'Admin', 'Manager']`
- `wages/[id].put.ts` → `['Owner', 'Admin', 'Manager']`
- `wages/[id].delete.ts` → `['Owner', 'Admin']`
  - `wages/month.get.ts` → `['Owner', 'Admin', 'Manager']` (Staff removed in B6 — see Section B)
- `wages/export.post.ts`, `wages/bank-report.get.ts`, `wages/epf-esic-report.get.ts`, `wages/bulk-slips.get.ts` → `['Owner', 'Admin', 'Manager']`

### Fixed: `master-rolls/[id].put.ts` Bypassed `requireAuthSession`
**Fix**: Now calls `requireAuthSession(event)` and uses an `EDITABLE_FIELDS` allowlist.

### Fixed: `master-rolls/import.post.ts` Same Bypass + Mass Assignment
**Fix**: Now calls `requireAuthSession(event)` and uses `pickAllowlisted()` with `IMPORTABLE_FIELDS`.

### Fixed: Progress Tracking Inconsistency
**Fix**: `processed_wages` now consistently tracks successful-only. Progress percentage uses `i + 1` (actual count) instead of `i + BATCH_SIZE`.

### Fixed: Redundant `$in` Query + N+1 Problem
**Fix**: `eligible-employees.post.ts` now uses `{ firm_id: user.firm_id }` and batches the "last wage" lookup into a single query.

### Fixed: Filename Injection in Headers
**Fix**: All download endpoints now sanitize filenames using `safeFilenamePart()`.

### Fixed: Old Advance Repayments Not Cleaned on Update
**Fix**: `wages/[id].put.ts` now deletes old `Advance` repayments before re-creating new ones.

### Fixed: No Concurrency Control (Race Condition)
**Fix**: `Wage.ts` model now has `optimisticConcurrency: true`. `wages/[id].put.ts` handles `VersionError` with a 409 response.

### Fixed: `master_roll_id` Not Cast to ObjectId
**Fix**: `wage-job-processor.ts` validates with `mongoose.isValidObjectId()` and casts to `ObjectId`.

---

## Section B: Additional Fixes Found During Re-Audit (Fixed Since Initial Report)

The following bugs were listed as "still present" in the initial audit but have been **fixed** as of 2026-08-05:

### B1-Fixed: `master-rolls/bulk-update.put.ts` — `requireAuthSession` + Allowlist Applied

**Severity**: High (was Security)
**File**: `server/api/master-rolls/bulk-update.put.ts`

**What was wrong**: Read `x-firm-id` from headers and spread `{ ...update.data }` directly into `findOneAndUpdate`.

**Fix applied**:
- Line 37: Now calls `requireAuthSession(event)` instead of reading the `x-firm-id` header.
- Lines 8-32: `EDITABLE_FIELDS` allowlist defined. `pickEditable()` function filters input to only allowed fields before passing to `findOneAndUpdate`.
- Line 56: Uses `{ ...pickEditable(update.data || {}), updated_by: user._id }`.

### B2-Fixed: `master-rolls/stats.get.ts` — `requireAuthSession` Applied

**Severity**: Medium (was Security)
**File**: `server/api/master-rolls/stats.get.ts`

**What was wrong**: Read firm context from `x-firm-id` header without `requireAuthSession`.

**Fix applied**:
- Line 7: Now calls `requireAuthSession(event)`.
- Lines 9-20: Uses `user.firm_id` for all queries instead of the header value.

### B3-Fixed: `wages/bulk.post.ts` — Validation Errors Return 400 (Not 500)

**Severity**: Low (was Error Handling)
**File**: `server/api/wages/bulk.post.ts`

**What was wrong**: Catch block returned 500 with raw `err.message` for all errors.

**Fix applied**:
- Lines 125-134: Now checks `err.statusCode` first (re-throws existing createErrors). Then checks for validation patterns (`/validation failed|cannot exceed gross salary/i`) and returns 400 with the message. Otherwise returns 500 with a **generic** message: `'Failed to create wages. Please try again or contact support.'`.

### B4-Fixed: `wage-job-processor.ts` — `session.endSession()` Guarded

**Severity**: Low (was Resource Leak)
**File**: `server/utils/wage-job-processor.ts`

**What was wrong**: `session.endSession()` in `finally` could throw if `startSession()` failed first.

**Fix applied**:
- Line 47: `let session: mongoose.ClientSession | undefined;` initialized to `undefined`.
- Lines 177-180: `finally` block now guards with `if (session) { await session.endSession(); }`.

### B5-Fixed: `wages/[id].put.ts` — Advance Repayment Validated Against Outstanding Balance

**Severity**: Low (was Data Quality)
**File**: `server/api/wages/[id].put.ts`

**What was wrong**: Advance repayment record created unconditionally if `advance_deduction > 0`, without checking outstanding balance.

**Fix applied**:
- Lines 120-141: Before creating the `Advance` repayment record, now queries all advances for the employee, computes the outstanding balance, and returns a 400 error if `advance_deduction` exceeds the outstanding balance.

### B6-Fixed: `wages/month.get.ts` — `Staff` Role Removed (PII Protection)

**Severity**: Medium (was Data Exposure)
**File**: `server/api/wages/month.get.ts`

**What was wrong**: Allowed `Staff` role to access endpoint that populates Aadhar and bank account numbers.

**Fix applied**:
- Line 11: `requireWageRole(event, user, ['Owner', 'Admin', 'Manager'])` — `Staff` removed from allowed roles.

### B7-Fixed: Role Checks Added to 5 Read-Only Endpoints

**Severity**: Medium (was Security / Data Exposure)
**Files**:

| File | Fix |
|------|-----|
| `wages/job/[jobId].get.ts` | Line 7: `requireWageRole(event, user, ['Owner', 'Admin', 'Manager'])` added |
| `wages/history/[masterRollId].get.ts` | Line 7: `requireWageRole(event, user, ['Owner', 'Admin', 'Manager'])` added |
| `wages/slip/[id].get.ts` | Line 118: `requireWageRole(event, user, ['Owner', 'Admin', 'Manager'])` added |
| `wages/eligible-employees.post.ts` | Line 47: `requireWageRole(event, user, ['Owner', 'Admin', 'Manager'])` added |
| `master-rolls/export.get.ts` | Line 13: `requireWageRole(event, user, ['Owner', 'Admin', 'Manager'])` added |

All five endpoints now import and call `requireWageRole`.

---

## Section C: Resolved Issues (All Issues Fixed)

### C1-Fixed: `wages/history/[masterRollId]/export.get.ts` — `requireWageRole` Added

**File**: `server/api/wages/history/[masterRollId]/export.get.ts`
**Status**: Fixed — Calls `requireWageRole(event, user, ['Owner', 'Admin', 'Manager'])`.

---

### C2-Fixed: `wage-job-processor.ts` — Idempotency on Job Retries

**File**: `server/utils/wage-job-processor.ts`
**Status**: Fixed — Pre-checks if wage record already exists before starting Mongoose transaction. If found, records existing wage as successful and skips re-creation, making job retries completely idempotent.

---

## Status Summary

All reported issues (14 initial bugs + 7 re-audit bugs + 2 final section C issues) are **100% resolved**.

---

## Section E: Login Page Layout Bug (Not Wages-Related)

### Missing Sidebar, Navbar, and Footer on Login Page

**Severity**: Medium (UX)
**Files**: `app/layouts/default.vue:51-53`, `app/pages/login.vue:81-83`

**Description**:

The login page (`app/pages/login.vue`) sets `definePageMeta({ layout: 'default' })` and renders a full-screen centered card. The `default.vue` layout has an `isAuthPage` computed property that checks if the current route is `/login` or `/signup`:

```typescript
const isAuthPage = computed(() => {
  return ['/login', '/signup'].includes(route.path);
});
```

When `isAuthPage` is `true`, all three navigation components are conditionally hidden:

```html
<AppHeader v-if="!isAuthPage" />
<AppSidebar v-if="!isAuthPage" class="hidden md:block" />
<footer v-if="!isAuthPage" class="block h-0 relative z-50">
  <AppFooter />
</footer>
```

This is why the sidebar, navbar, and footer are not visible on the login page — they are explicitly excluded by the `isAuthPage` guard.

**Fix**: Remove `'/login'` and `'/signup'` from the `isAuthPage` array in `default.vue:51-53` if navigation should be visible on auth pages. Alternatively, create a dedicated `auth.vue` layout (without navigation) and use `definePageMeta({ layout: 'auth' })` on login/signup pages to keep the bare design while making the `isAuthPage` check explicit in the layout name.

