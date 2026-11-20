# Unified Accounting System - Deep Audit Follow-up

**Audit date:** 2026-11-14
**Audit type:** Re-audit of current worktree changes (static source review)
**Review baseline:** Commit `8c24ebb2b60d7e2b864efc4ceb545827f7ca715c`; findings below are assessed against the worktree after the current remediation changes.
**Overall assessment:** The accounting paths were tightened substantially: mandatory request identity and dates, exact replay checks, fail-closed cross-store handling, source-linked TDS for inspected labor and subcontractor producers, disabled speculative advance allocation, and explicit unavailable reconciliation states. This does **not** establish that the accounting system is fully correct or production-ready. Independent AR/AP and dated bank registers remain absent, multi-database work cannot be atomic, TDS validation is not uniformly enforced at every posting boundary, and runtime/database behavior was not verified.

## 1. Executive conclusion

Do not treat unavailable operational comparisons as zero or as proof of parity. Where the application cannot establish authoritative source evidence, the changed code now generally blocks the operation or reports the result as unavailable. That is safer than a fabricated accounting value, but it does not replace the missing registers or source workflows.

Material remediation made in the worktree:

- Voucher dates, UUID request keys, account resolution, voucher type, and supplied amounts are validated explicitly; malformed input is no longer silently converted into a zero/current-date/JOURNAL default.
- Generic and labor TDS source references are persisted, and labor-linked TDS input is checked for an exact Section 194C source link.
- Labor advance retries compare the source voucher and full persisted request attributes. Settlement retries check the existing settlement before rejecting an already-settled period.
- PostgreSQL labor synchronization failures are surfaced with the GL voucher identity and same-key recovery instruction; no ledger-compensation mutation is attempted.
- Ordinary voucher edits refuse labor-linked vouchers and fail closed when PostgreSQL is unavailable.
- SL/GL entity reads are firm-scoped; diagnostic repair no longer posts speculative adjustments or reports success when a variance remains.
- AR/AP and bank reconciliation totals are represented as unavailable without independent registers; employee advance audit amounts and types are validated.
- The legacy advance-allocation path is disabled because it previously wrote a labor row without an evidenced GL-to-labor transfer.
- Certificate date/range validation and persisted statutory replay comparison are present.

Important remaining limitations:

1. AR/AP receipt/payment/allocation registers and dated bank statements are not implemented. Those reconciliations cannot establish dated operational balances.
2. Cross-store operations span MongoDB and PostgreSQL. Same-key retries and explicit recovery errors reduce risk, but they do not make a Mongo commit and a PostgreSQL commit atomic.
3. Generic TDS UI calculations can be submitted to the generic voucher endpoint without server-side threshold/history validation. The specialized subcontractor endpoint instead blocks when prior history is present but unverifiable; this is conservative but restricts use.
4. Posting-ticket and close-lease renewal callbacks record renewal failures asynchronously; they are checked at the commit/finalization boundary, not by immediately cancelling in-flight database work.
5. A production build did not complete: the local Node process terminated with an out-of-memory error during the Vite client build. No database or integration tests were run.

## 2. Scope and verification

Reviewed the current worktree changes against the repository HEAD baseline, including voucher posting/editing, labor advance/settlement, TDS threshold and subcontractor payout paths, period locks/year-end close, reconciliation/detail/repair routes, migration checks, and related UI changes. No credentials or environment files were inspected.

Verification performed:

- `npx vue-tsc --noEmit` — passed.
- `git diff --check` — passed; Git emitted only line-ending conversion warnings.
- `npm run build` — did not complete; Node/Vite terminated with an out-of-memory error during client compilation (exit code 134).
- No live MongoDB/PostgreSQL queries, migrations, index checks, or behavioral/integration tests were run.

Severity describes potential financial-integrity impact. “Resolved in source” means the inspected source now addresses the stated code finding; it does not assert production data correctness or successful deployment.

## 3. Findings and dispositions

### F-01 - Posting barriers and close fencing
**Severity: Critical — partially resolved**

Posting now requires MongoDB readiness and distributed ticket registration; a renewal error is retained and causes the pre-commit assertion to fail. The close drain and transaction startup are within the close ownership cleanup boundary, and the close lease is renewed and checked before finalization. However, the renewal timer reports failure asynchronously. A close worker can observe an expired/missing ticket and proceed to its snapshot before the writer reaches its commit assertion. The writer should then fail its fresh period-lock check, but this coordination protocol has not been exercised under concurrent Mongo failures or multiple workers.

**Remaining code to harden/test:** Prove with concurrent integration tests that a close cannot finalize while a failed-renewal writer can still commit; test commit ambiguity and abort/cleanup failure. Consider an explicit durable fence/lease protocol with an immediately observable failed-owner state.

- [period-lock.service.ts](../server/utils/accounting/period-lock.service.ts#L105-L182) — ticket registration, renewal failure latch, commit assertion, and release.
- [period-lock.service.ts](../server/utils/accounting/period-lock.service.ts#L213-L255) — distributed drain.
- [fiscal-year-closing.service.ts](../server/utils/accounting/fiscal-year-closing.service.ts#L265-L300) — cleanup boundary, heartbeat, and session setup.
- [fiscal-year-closing.service.ts](../server/utils/accounting/fiscal-year-closing.service.ts#L430-L480) — lease verification and fenced finalization.

### F-02 - TDS source linkage and history authority
**Severity: High — partially resolved**

Stable source references are now written by the inspected labor advance, generic voucher UI, and subcontractor payout producers. The TDS threshold endpoint marks history incomplete when a candidate payment has no voucher group, no matching TDS leg, an ambiguous/missing source reference, or invalid tax-base data. The UI is expected to block applying non-authoritative calculations, and the subcontractor route refuses to process a payout when it finds prior payments whose tax history it cannot verify.

The generic voucher posting API does not independently recompute/validate TDS threshold history or enforce the UI authority state. A caller can bypass the UI and submit TDS metadata directly. Other payment producers outside the inspected subset also need a source-reference audit.

**Code to update:** Enforce TDS source/history rules at the server posting boundary for every TDS-bearing voucher, or route such vouchers only through a server-authoritative TDS workflow. Inventory all TDS posting producers and test missing, duplicate, and mismatched source references.

- [threshold-check.get.ts](../server/api/accounting/tds/threshold-check.get.ts#L158-L270) — prior payment/TDS join and incomplete-history detection.
- [threshold-check.get.ts](../server/api/accounting/tds/threshold-check.get.ts#L410-L445) — authority flags.
- [vouchers.post.ts](../server/api/accounting/vouchers.post.ts#L96-L126) — current labor-only TDS server checks.
- [labor-ledger-helper.ts](../server/utils/labor-ledger-helper.ts#L115-L220) — stable labor payment/TDS source references.
- [subcontractor-payout.post.ts](../server/api/accounting/subcontractor-payout.post.ts#L180-L265) — fail-closed history gate and source-linked legs.

### F-03 - TDS certificate data governance
**Severity: Medium — schema validation resolved; operational governance unverified**

Certificate dates are validated as real ISO calendar dates and the model rejects a reversed validity range. Rate overrides in the inspected routes require exactly one active, firm-scoped Section 194C certificate with a matching permitted rate. This source review did not establish that certificate creation, revocation, and audit history are restricted to an authorized workflow.

**Remaining action:** Verify and enforce who can create/change/revoke certificates, preserve an audit trail, and test certificate status/date/rate boundaries against persisted records.

- [TdsExemptionCertificate.ts](../server/models/TdsExemptionCertificate.ts#L4-L14) — strict calendar-date predicate.
- [TdsExemptionCertificate.ts](../server/models/TdsExemptionCertificate.ts#L60-L108) — field validators and validity-range check.
- [threshold-check.get.ts](../server/api/accounting/tds/threshold-check.get.ts#L338-L376) — rate override authorization.
- [subcontractor-payout.post.ts](../server/api/accounting/subcontractor-payout.post.ts#L112-L139) — subcontractor rate override check.

### F-04 - Independent reconciliation populations and as-of balances
**Severity: High — fail-closed reporting improved; authoritative registers remain missing**

AR/AP and bank summaries now return unavailable totals rather than ledger-derived or present-day balances presented as independent historical subledgers. Detail responses say the same. Labor reconciliation uses PostgreSQL sources and the settlement adjustment expression accounts for both signs where the settlement posting logic permits it; numeric conversion errors are no longer silently converted to zero in employee-advance reconciliation.

The firm still has no independent AR/AP receipt/payment/allocation register or dated bank statement register in the inspected code. Therefore those comparisons remain unavailable by design, not resolved. Labor’s summary formula and cutoff population should still be reconciled against actual operational scenarios, including unsettled periods and historical edits, using integration fixtures.

**Remaining code:** Implement source registers and cutoff-aware balance selection before making AR/AP or bank parity claims. Validate labor summary against all source transactions and posting leg identities.

- [sl-gl-reconciler.service.ts](../server/utils/accounting/sl-gl-reconciler.service.ts#L182-L240) — labor operational totals.
- [sl-gl-reconciler.service.ts](../server/utils/accounting/sl-gl-reconciler.service.ts#L438-L645) — party reconciliation remains unavailable.
- [sl-gl-reconciler.service.ts](../server/utils/accounting/sl-gl-reconciler.service.ts#L646-L775) — bank reconciliation remains unavailable.
- [sl-gl-reconciler.service.ts](../server/utils/accounting/sl-gl-reconciler.service.ts#L786-L910) — employee advance reconciliation and numeric validation.
- [sl-gl-detail.get.ts](../server/api/accounting/audit/sl-gl-detail.get.ts#L150-L235) — explicit unavailable AR/AP and bank detail.

### F-05 - SL/GL detail tenant scope and input validation
**Severity: High — resolved in inspected endpoint**

Party, bank, and employee reads are scoped to the authenticated firm; `toDate` is validated as a real calendar date. Employee advance detail now rejects invalid amounts and unknown record types rather than silently treating them as zero/ignoring them. Continue to keep returned entity projections minimal; broader tenant authorization behavior was not tested against a live database.

- [sl-gl-detail.get.ts](../server/api/accounting/audit/sl-gl-detail.get.ts#L12-L48) — request/category/date validation and firm identity.
- [sl-gl-detail.get.ts](../server/api/accounting/audit/sl-gl-detail.get.ts#L50-L60) — firm-scoped Party lookup.
- [sl-gl-detail.get.ts](../server/api/accounting/audit/sl-gl-detail.get.ts#L184-L195) — firm-scoped BankAccount lookup.
- [sl-gl-detail.get.ts](../server/api/accounting/audit/sl-gl-detail.get.ts#L240-L280) — firm-scoped MasterRoll and Advance filters.
- [sl-gl-detail.get.ts](../server/api/accounting/audit/sl-gl-detail.get.ts#L300-L325) — invalid balance input rejection.

### F-06 - Advance-variance repair correctness
**Severity: Critical — speculative repair removed**

The endpoint now requires an explicit reconcile action, validates a firm-scoped employee and date, and returns a conflict if GL and subledger differ. It performs no automatic financial mutation and reports success only when the measured variance is already below the threshold. Invalid GL/subledger amounts and unsupported advance types are rejected.

**Remaining action:** None for automatic repair behavior. Any future repair must be source-document-driven, idempotent, and update/reconcile both registers; a variance alone is not sufficient evidence to post.

- [fix-advance-variance.post.ts](../server/api/accounting/audit/fix-advance-variance.post.ts#L10-L47) — action, ID/date, firm scope, and authorization.
- [fix-advance-variance.post.ts](../server/api/accounting/audit/fix-advance-variance.post.ts#L60-L110) — input checks and no-mutation conflict/success outcomes.

### F-07 - Labor advance/settlement idempotency and cross-store recovery
**Severity: High — request identity and replay checks improved; distributed atomicity remains impossible**

Advance and settlement require caller UUIDs. The advance serializes by period, checks replay before the settled-state rejection, and compares period, source voucher identity, date, mode, bank, TDS values, and gross amount. Settlement compares its full material payout payload before handling the already-settled state. Generic voucher updates refuse linked labor vouchers and require PostgreSQL to establish whether a link exists.

MongoDB GL posting and PostgreSQL operational writes still cannot commit atomically together. The routes return explicit same-key recovery instructions after a partial cross-store outcome. This is a recoverable failure protocol, not atomicity or proof that all partial outcomes have been reconciled.

**Remaining action:** Add failure-injection tests at each commit boundary, then provide an operational recovery/reconciliation queue for unresolved same-key operations. Do not remove the explicit errors or retry with a new key.

- [advance.post.ts](../server/api/labor/payments/advance.post.ts#L20-L58) — strict request validation.
- [advance.post.ts](../server/api/labor/payments/advance.post.ts#L62-L145) — serialized replay, stable GL identity, and cross-store error.
- [settle.post.ts](../server/api/labor/payments/settle.post.ts#L60-L155) — locked period, replay-before-status check, and explicit recovery.
- [vouchers.post.ts](../server/api/accounting/vouchers.post.ts#L150-L220) — transaction coordination and labor synchronization failure.
- [voucher update route](../server/api/accounting/vouchers/%5BvoucherGroupId%5D.put.ts#L36-L64) — fail-closed PostgreSQL link check and labor-edit refusal.

### F-08 - Labor schema duplicate classification
**Severity: High — resolved in inspected initializer**

Advance duplicate preflight groups by the same firm/period/voucher/leg identity represented by the unique index, preserving distinct multi-leg entries while blocking true duplicate legs. The initializer preserves conflicting records and prevents readiness instead of silently deleting them.

- [pg-labor-schema.ts](../server/utils/pg-labor-schema.ts#L150-L170) — duplicate grouping includes `leg_index`.
- [pg-labor-schema.ts](../server/utils/pg-labor-schema.ts#L202-L210) — unique group/leg and request indexes.

### F-09 - Ledger migration index and parity
**Severity: High — resolved in inspected source; database state unverified**

The migration verifier checks the expected key and strict partial-filter fields; the completed-migration path checks both missing and null `isReversed` values and reruns the migration if parity is not met. The duplicate preflight uses the effective-row population that would be backfilled into the index.

**Remaining action:** Verify the actual deployed MongoDB index options and migration parity in each environment before declaring operational readiness. No database inspection was run.

- [ledger-isreversed-migration.ts](../server/utils/migrations/ledger-isreversed-migration.ts#L32-L68) — expected unique partial-index definition.
- [ledger-isreversed-migration.ts](../server/utils/migrations/ledger-isreversed-migration.ts#L108-L142) — completed-path parity and duplicate preflight.
- [ledger-isreversed-migration.ts](../server/utils/migrations/ledger-isreversed-migration.ts#L174-L230) — backfill, final parity, and completion record.

### F-10 - Voucher replay equivalence
**Severity: High — materially improved; canonical header identity still needs tests**

Replay comparison includes creator identity, replacement group, per-leg references/dimensions/amounts, source-payment reference, and the persisted statutory fields including HSN/SAC and GST rate. The inspected comparator is substantially stricter than aggregate-total equivalence.

**Remaining code to review:** Compare any persisted voucher-level identifiers/material metadata not covered by the current comparator (including externally supplied voucher number where applicable), and add tests proving that every persisted financially/statutorily material field rejects a changed replay. No automated replay tests were present in the validation run.

- [unified-posting.service.ts](../server/utils/accounting/unified-posting.service.ts#L960-L1005) — voucher-level identity.
- [unified-posting.service.ts](../server/utils/accounting/unified-posting.service.ts#L1008-L1215) — per-leg and statutory replay equivalence.
- [unified-posting.service.ts](../server/utils/accounting/unified-posting.service.ts#L185-L230) — external voucher-group replay path.

### F-11 - Speculative ledger-to-labor advance allocation
**Severity: High — blocked fail-closed**

The previous allocation endpoint wrote a labor advance row with a synthetic group label without a source-linked GL transfer. That behavior is removed. The UI no longer offers the operation and the route returns a conflict without changing records.

**Remaining action:** Reintroduce allocation only with an explicit, idempotent transfer/allocation record linked to the original GL source and consumed balance, including concurrency protection against allocating the same source twice.

- [allocate-advance.post.ts](../server/api/labor/payments/allocate-advance.post.ts#L1-L11) — intentional no-mutation rejection.
- [labor period page](../app/pages/labor/period/%5Bid%5D.vue#L95-L135) — allocation action removed; separate GL balance is informational.

### F-12 - Subcontractor payout history and retry restrictions
**Severity: High — fail-closed, functionality restricted**

The payout route validates firm/user authorization, requires a UUID, validates date/payment/liquidity account, enforces statutory rate/certificate checks, links source references, and posts with a stable external group ID. It refuses to post if prior same-head payments exist because this route cannot establish their complete threshold/TDS linkage. This avoids an unsupported catch-up calculation but means the route cannot service those deductees until a complete authoritative history workflow is available. The generic payout retry behavior has not been exercised against concurrent duplicate requests.

**Remaining action:** Integrate this route with the authoritative TDS history workflow and test concurrent same-key retries, certificate revocation, threshold crossing, and missing-PAN cases.

- [subcontractor-payout.post.ts](../server/api/accounting/subcontractor-payout.post.ts#L20-L67) — authenticated firm, UUID, date, mode validation.
- [subcontractor-payout.post.ts](../server/api/accounting/subcontractor-payout.post.ts#L105-L178) — firm-scoped statutory/liquidity validation.
- [subcontractor-payout.post.ts](../server/api/accounting/subcontractor-payout.post.ts#L180-L205) — fail-closed prior history check.
- [subcontractor-payout.post.ts](../server/api/accounting/subcontractor-payout.post.ts#L210-L305) — source-linked posting and transaction handling.

## 4. Required next validation

1. Run a production build in an environment with sufficient memory; the current local build died during client compilation.
2. Add/run focused integration tests for voucher replay field mismatch, barrier/close races, PostgreSQL failure after Mongo commit, labor advance/settlement retries, and TDS history that has missing/duplicate links.
3. Confirm deployed Mongo indexes and migration parity; inspect no production records without an approved database procedure.
4. Implement independent AR/AP receipt/payment/allocation registers and dated bank statements before reporting those reconciliation categories as available.
5. Keep all unavailable totals nullable and every unresolved cross-store outcome visible. Do not replace these states with zero, synthesized IDs, automatic variance postings, or new request keys.

**Conclusion:** Several original source-code findings are fixed or mitigated, but the system is not fully audited or proven safe. Remaining limitations are explicitly identified above; a clean type-check is not a substitute for accounting workflow, database, concurrency, and failure-injection tests.
