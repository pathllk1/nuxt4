# Unified Accounting System - Deep Audit Follow-up

**Audit date:** 2026-11-13
**Audit type:** Read-only static code review
**Review baseline:** Commit `0a0e9a1` (current HEAD), compared with `e4a2865`
**Overall assessment:** **The latest changes resolve several prior defects, but a close-time posting race, TDS history attribution, reconciliation totals, labor synchronization/idempotency, ledger migration safety, and voucher replay remain material risks.**

> This is a source-code review, not an accounting opinion, statutory compliance certification, or confirmation of live balances. No production database, credentials, or financial data were accessed. Validate tax/accounting behavior with a qualified finance owner and representative test data before relying on reports or posting changes.

## 1. Executive conclusion

The re-audit reviewed the implementation changes in the current commit, including year-end close ownership, bill cancellation, TDS threshold calculation, SL/GL reconciliation, PostgreSQL labor synchronization, ledger backfill/index behavior, and voucher replay. Adjacent `TdsCalculator`, period-lock, and PostgreSQL labor-schema code was also inspected to verify the changed paths.

Improvements confirmed:

- Close acquisition is now compare-and-set, a unique execution token gates finalization and cleanup, and stale in-progress locks without a lease can be reclaimed.
- Bill cancellation no longer retries without a MongoDB transaction.
- TDS party lookups are firm-scoped, leader lookup fails closed, and amount/rate strings are parsed strictly.
- Labor advance parity checks now apply a date cutoff and choose a debit amount based on TDS mode.
- TDS, reconciliation, and replay queries use the effective-row predicate that includes missing `isReversed` values; new ledger writes set `isReversed: false`.
- PostgreSQL inserts are transaction-wrapped in the reviewed paths, and duplicate voucher replay now compares debit and credit totals.

These changes do not yet establish a reliable consolidated ledger. The most significant residuals are:

1. A posting transaction that passed the period-lock read before close acquisition can still commit after the close snapshot.
2. TDS history can classify non-tax credits as TDS, inherit TDS metadata onto bank legs, and reuse one tax leg's base for multiple source entries.
3. The new labor "operational total" is not a net labor balance; it sums advances, ignores settlements, and falls back to GL when the sum is zero.
4. The generic voucher idempotency check can silently drop legitimate second and later labor-advance rows in one voucher.
5. Ledger backfill runs as an unversioned startup update, ignores failures beyond a warning, and does not preflight unique-index conflicts.
6. Voucher replay checks aggregate totals, not the actual legs, and the posting API still permits writes without a MongoDB session.

## 2. Scope and method

Reviewed the accounting implementation changes in commit `0a0e9a1` relative to `e4a2865`, plus adjacent sources directly used by those changes. The audit was static and read-only; no application build, test suite, database query, migration, or financial-data repair was run.

Severity describes potential financial-integrity impact, not exploitability. Findings identify source behavior; deployment configuration and representative operating data may affect impact. The code links below identify the implementation lines that need changes.

## 3. Findings

### F-01 - Close ownership is improved, but postings in flight are not fenced
**Severity: Critical**

The close now activates a period lock before the trial-balance read and stores a unique `closeExecutionToken`. Finalization and failure cleanup require that token, so a stale close worker cannot finalize or clear a newer worker's lock. The code also reclaims an `IN_PROGRESS` lock with a null lease. These are substantial improvements ([acquisition and snapshot](../server/utils/accounting/fiscal-year-closing.service.ts#L168-L240), [token-checked finalization and cleanup](../server/utils/accounting/fiscal-year-closing.service.ts#L393-L441)).

However, the period-lock guard only reads the lock; it does not coordinate the lock document with the ledger write ([guard](../server/utils/accounting/period-lock.service.ts#L25-L53), [posting guard](../server/utils/accounting/unified-posting.service.ts#L62-L80)). A posting transaction can read "unlocked," then the close can activate its lock and take a ledger snapshot, and the earlier posting can commit after that snapshot. The close can therefore finalize against a balance that omits an already-authorized posting, leaving that posting inside the closed period after closing/opening entries have been generated.

The ten-minute lease has no heartbeat. Token-checked finalization prevents a reclaimed stale worker from committing its close transaction, but a long close can still be unnecessarily preempted and restarted. The token is an equality-based ownership token, not a monotonically ordered fencing number across workers.

**Code to update:** Add a writer barrier or equivalent serialization so close acquisition cannot race with postings that already passed the guard; ensure in-flight posting transactions drain or conflict before the close snapshot. Add lease renewal and abort promptly when ownership is lost. Update [fiscal-year-closing.service.ts](../server/utils/accounting/fiscal-year-closing.service.ts#L168-L240), [period-lock.service.ts](../server/utils/accounting/period-lock.service.ts#L25-L53), and [unified-posting.service.ts](../server/utils/accounting/unified-posting.service.ts#L62-L80).

### F-02 - Non-transactional bill-cancellation fallback is resolved
**Status: Resolved in the inspected path**

The handler now rejects deployments where MongoDB transactions are unsupported instead of retrying the cancellation without a session. Stock reversal errors are propagated, so the cancellation transaction can abort rather than returning an error after partially changing stock ([bill cancellation](../server/api/accounting/bills/[id]/cancel.post.ts#L150-L190)). Keep the transaction requirement and verify in integration tests that every stock, stock-register, bill, and ledger write uses the same session.

### F-03 - TDS rate overrides can bypass PAN-based statutory rates
**Severity: High**

The endpoint now validates rate syntax and bounds the supplied rate to 0-20. But it accepts any value in that range and uses `customRate` in preference to the PAN-derived rate ([input validation](../server/api/accounting/tds/threshold-check.get.ts#L45-L55), [rate selection](../server/api/accounting/tds/threshold-check.get.ts#L267-L277)). `TdsCalculator.validatePan()` sets 20% for missing/invalid PAN and 1% or 2% for valid PAN entity classes ([PAN rate defaults](../server/utils/accounting/tds-calculator.ts#L40-L81)). A request-supplied rate can override those defaults, including choosing a lower rate when PAN is unavailable, or zero without an explicit exemption decision.

This endpoint is a calculator, not a posting endpoint, so no production withholding error is asserted. Its result can nevertheless drive an incorrect withholding decision if consumers treat the response as statutory guidance.

**Code to update:** Derive the permitted Section 194C rate from PAN/entity type and any explicit statutory exemption; do not allow an untrusted query parameter to override Section 206AA or the applicable 1%/2% rate. If a business override is required, validate and authorize it as a separate, auditable operation. Update [threshold-check.get.ts](../server/api/accounting/tds/threshold-check.get.ts#L45-L55) and [tds-calculator.ts](../server/utils/accounting/tds-calculator.ts#L40-L81).

### F-04 - TDS history can mistake ordinary credits for tax and overstate prior-taxed base
**Severity: Critical**

The YTD query is now firm- and deductee-scoped and excludes several unrelated account types, but its `$nin` filter is a denylist rather than a positive definition of eligible Section 194C source transactions ([YTD filter](../server/api/accounting/tds/threshold-check.get.ts#L128-L145)). Other debit entries for the selected party can still inflate prior YTD.

More seriously, the candidate tax-leg query accepts positive credits whose account head contains `contractor` or `subcontractor`, even without TDS metadata ([candidate selection](../server/api/accounting/tds/threshold-check.get.ts#L151-L168)). A contractor payable credit can therefore be treated as a TDS credit. In addition, `UnifiedPostingService` copies `payload.tags.statutory` onto every voucher leg when the leg has no statutory object ([leg construction](../server/utils/accounting/unified-posting.service.ts#L151-L168)). The subcontractor payout puts `isTds: true` in its statutory snapshot and passes that snapshot in voucher-level tags even when TDS is zero and no TDS-payable leg is emitted ([payout snapshot and tags](../server/api/accounting/subcontractor-payout.post.ts#L151-L173), [voucher tags](../server/api/accounting/subcontractor-payout.post.ts#L198-L209)). The bank credit can inherit the TDS marker and qualify as a prior TDS leg because the query selects positive credits. That can mark an untaxed payment as already taxed and suppress catch-up TDS.

Finally, the loop uses the same first matching voucher-group TDS leg for each `priorEntries` row and adds a base for each row ([matching and accumulation](../server/api/accounting/tds/threshold-check.get.ts#L185-L218)). When one voucher has multiple source debit legs for one deductee, the same recorded/calculated tax base can be counted repeatedly. The payout snapshot also does not populate `taxableAmount`, so the fallback calculation is routinely used.

**Code to update:** Attach statutory TDS metadata only to the actual tax-liability leg; require a positive TDS amount and canonical section/account identity; remove the contractor-name heuristic. Define eligible 194C source events positively, link TDS to the source entry/deductee/section, and allocate a tax base once across matching entries. Update [threshold-check.get.ts](../server/api/accounting/tds/threshold-check.get.ts#L128-L218), [unified-posting.service.ts](../server/utils/accounting/unified-posting.service.ts#L151-L168), and [subcontractor-payout.post.ts](../server/api/accounting/subcontractor-payout.post.ts#L151-L209).

### F-05 - Reconciliation totals are not independent operational balances
**Severity: High**

Labor reconciliation now queries PostgreSQL, but `slOperationalTotal` is only `SUM(labor_advances.amount)` through the cutoff. It does not subtract advances applied in labor settlements or otherwise derive the outstanding labor balance. If the sum is positive, it replaces the labor SL total with gross advances; if it is zero, the code falls back to adding the GL balance itself. The zero case can therefore report matching totals without an independent labor comparison ([labor total and fallback](../server/utils/accounting/sl-gl-reconciler.service.ts#L182-L218)). Party and bank headline "SL" totals still add the GL net for registered party/bank records ([party summary](../server/utils/accounting/sl-gl-reconciler.service.ts#L435-L458), [bank summary](../server/utils/accounting/sl-gl-reconciler.service.ts#L657-L679)).

The advance-level check now filters by ledger date and selects a debit leg by leader name, which fixes earlier gaps. But `head.includes(targetLeaderName)` can match a different leader with a longer/similar name, and it chooses the first matching debit in the voucher group without an exact source-line identity ([advance verification](../server/utils/accounting/sl-gl-reconciler.service.ts#L243-L329)).

**Code to update:** Compute labor outstanding balances from advances, settlements, adjustments, and the same cutoff; do not fall back to GL as the SL value when the operational sum is zero. Derive party and bank totals from their operational registers. Match labor rows to exact leader/source-line IDs rather than substring names or first matching voucher legs. Update [sl-gl-reconciler.service.ts](../server/utils/accounting/sl-gl-reconciler.service.ts#L182-L218), [sl-gl-reconciler.service.ts](../server/utils/accounting/sl-gl-reconciler.service.ts#L243-L329), [sl-gl-reconciler.service.ts](../server/utils/accounting/sl-gl-reconciler.service.ts#L435-L458), and [sl-gl-reconciler.service.ts](../server/utils/accounting/sl-gl-reconciler.service.ts#L657-L679).

### F-06 - Labor advance idempotency can silently discard valid rows; cross-store writes remain a saga
**Severity: Critical**

The generic voucher handler collects one `advancesToInsert` item per eligible voucher entry, then uses `(firm_id, period_id, ledger_voucher_group_id)` as an existence check ([collection and check](../server/api/accounting/vouchers.post.ts#L132-L169)). If a single voucher has two legitimate labor lines for the same period, the first is inserted and the second sees that first row and is skipped. The PostgreSQL schema has no unique constraint on this key or a source-line key ([labor table definitions](../server/utils/pg-labor-schema.ts#L89-L114)). Concurrent requests can also both pass the check and insert duplicate rows.

The dedicated advance endpoint performs a SELECT-then-INSERT without a transaction and returns an existing row without comparing its amount or other payload ([advance idempotency check](../server/api/labor/payments/advance.post.ts#L75-L101)). Settlement performs a similar existence check in a transaction, but there is no matching unique constraint and it also accepts the existing row without verifying the retry payload ([settlement check](../server/api/labor/payments/settle.post.ts#L81-L105)).

The dedicated advance and settlement endpoints call the labor ledger helper before their PostgreSQL existence checks. The helper posts a new voucher through `UnifiedPostingService` without supplying a stable external source key ([advance posting](../server/utils/labor-ledger-helper.ts#L39-L170), [settlement posting](../server/utils/labor-ledger-helper.ts#L187-L314)). A retry can therefore get a new voucher-group ID, so the subsequent PostgreSQL lookup by that new ID does not recognize the earlier attempt and can insert a duplicate. These operations still post to MongoDB before PostgreSQL and rely on compensating reversal if synchronization fails ([generic compensation](../server/api/accounting/vouchers.post.ts#L185-L220), [advance compensation](../server/api/labor/payments/advance.post.ts#L103-L132), [settlement compensation](../server/api/labor/payments/settle.post.ts#L107-L139)). A timeout after PostgreSQL commit can still leave PostgreSQL committed while the MongoDB voucher is compensated.

**Code to update:** Give each source labor line a stable idempotency key, or aggregate lines explicitly before inserting; never let a same-voucher existence check discard a distinct amount. Reuse a stable request/source key before posting to MongoDB. Add database uniqueness on the actual source key, compare payloads on retries, and make ambiguous cross-store commits durable/retriable instead of assuming compensation resolves them. Update [vouchers.post.ts](../server/api/accounting/vouchers.post.ts#L132-L184), [pg-labor-schema.ts](../server/utils/pg-labor-schema.ts#L89-L114), [advance.post.ts](../server/api/labor/payments/advance.post.ts#L75-L101), [settle.post.ts](../server/api/labor/payments/settle.post.ts#L81-L105), and [labor-ledger-helper.ts](../server/utils/labor-ledger-helper.ts#L39-L170).

### F-07 - Startup ledger backfill is not a safe migration boundary
**Severity: High**

The TDS/reconciliation/replay paths now use `{ isReversed: { $ne: true } }`, which includes active legacy rows with a missing flag, and new ledger writes explicitly set `isReversed: false`. A backfill was added after MongoDB connection, but it updates the whole ledger collection during connection startup, performs overlapping updates, and catches any failure as a warning while allowing the application to continue ([startup backfill](../server/plugins/mongodb.ts#L56-L68)). There is no duplicate-key preflight before changing legacy rows to `false`; those rows then become members of the unique partial index on `(firmId, voucherGroupId, legIndex)` ([index](../server/models/Ledger.ts#L184-L189)). A legacy duplicate can make the backfill fail after partial progress, leaving the index population incomplete while the app proceeds.

**Code to update:** Move the backfill to a versioned migration with duplicate detection, resumable progress, explicit success/failure status, and post-migration parity checks. Do not treat a warning as successful migration or enable strict index assumptions until the backfill is complete. Update [mongodb.ts](../server/plugins/mongodb.ts#L56-L68) and coordinate the rollout with [Ledger.ts](../server/models/Ledger.ts#L184-L189).

### F-08 - Voucher replay checks totals, not voucher identity or complete transaction outcome
**Severity: High**

The duplicate-key path now queries outside the supplied session and rejects debit/credit total mismatches, which is an improvement ([replay handler](../server/utils/accounting/unified-posting.service.ts#L171-L206)). But equal totals do not prove equal ledger legs: account heads/types, party/bank IDs, statutory metadata, narration, and per-leg amounts can differ while the retry is incorrectly returned as a successful replay.

`postVoucher()` still accepts an optional session and calls `insertMany()` without a transaction when none is supplied ([posting signature and insert](../server/utils/accounting/unified-posting.service.ts#L62-L80), [insert call](../server/utils/accounting/unified-posting.service.ts#L168-L173)). A multi-leg insert can therefore partially persist if a later document fails. When the insert error occurs inside a transaction, the catch reads outside that session and may return success without resolving the caller's now-aborted transaction; a later commit by the caller can still fail.

**Code to update:** Require a transaction for multi-leg posting. Use a firm-scoped source idempotency key and compare canonical per-leg payloads before returning a replay. Define how the caller aborts or resolves its transaction after a duplicate-key error; do not return success while leaving the supplied session unusable. Update [unified-posting.service.ts](../server/utils/accounting/unified-posting.service.ts#L62-L80) and [unified-posting.service.ts](../server/utils/accounting/unified-posting.service.ts#L168-L206).

## 4. Prior finding disposition

| Prior finding | Current status |
|---|---|
| Close lease allowed stale worker to finalize or reset a new worker's lock | **Partially resolved.** Token-checked finalization/cleanup and null-lease reclaim are present; in-flight postings can still commit after the close snapshot (F-01). |
| Bill cancellation retried without a transaction | **Resolved in inspected path.** Unsupported transactions now fail closed; stock errors propagate (F-02). |
| TDS party lookup was not firm-scoped and leader IDs could be used as account heads | **Resolved in inspected path.** Party lookups are firm-scoped and unresolved leaders fail closed. |
| TDS input parsing and statutory rate validation | **Partially resolved.** Strict parsing is present, but a supplied rate can override PAN-based rates and can be zero (F-03). |
| TDS YTD and prior-tax history included unrelated activity or misattributed mixed vouchers | **Still open, with additional false-positive paths.** Contractor account heads, inherited statutory tags, broad debit selection, and per-entry reuse can distort catch-up amounts (F-04). |
| Reconciliation relied on GL totals | **Partially addressed.** Labor advances are queried independently, but the new total is not an outstanding balance; party and bank summaries remain GL-derived (F-05). |
| PostgreSQL labor sync had partial inserts and no replay guard | **Partially addressed, with a data-loss regression.** Transactional inserts and guards were added, but repeated same-period lines are skipped, concurrent duplicates remain possible, and cross-store writes are non-atomic (F-06). |
| Legacy `isReversed` rows were absent from strict queries/index | **Partially addressed.** Effective queries include missing values and startup backfill was added, but the backfill can fail or partially apply without gating readiness (F-07). |
| Duplicate voucher replay lacked payload comparison | **Partially addressed.** Debit/credit totals are compared, but per-leg identity and transaction outcome remain unverified (F-08). |

## 5. Remediation order

1. **Fence close against in-flight posting transactions.** Update `fiscal-year-closing.service.ts`, `period-lock.service.ts`, and `unified-posting.service.ts`; test a posting paused after its lock read.
2. **Correct TDS source identity and eligibility.** Update `threshold-check.get.ts`, `unified-posting.service.ts`, and `subcontractor-payout.post.ts`; only an actual, positive Section 194C liability leg should qualify as TDS.
3. **Prevent labor row loss and make dual-store recovery durable.** Update `vouchers.post.ts`, labor payment endpoints, and the PostgreSQL labor schema; use stable source-line keys and reconcile ambiguous outcomes.
4. **Build independent cutoff balances.** Update `sl-gl-reconciler.service.ts` to use net operational labor/party/bank balances and exact source-to-ledger identity.
5. **Lock down statutory rate overrides.** Update `threshold-check.get.ts` and `tds-calculator.ts` to enforce PAN/entity rules and explicit exemptions.
6. **Make ledger backfill a controlled migration.** Preflight duplicate index keys, migrate once with progress, and gate index/consumer assumptions on success.
7. **Complete posting idempotency.** Require transactional multi-leg writes and compare complete canonical payloads on replay.

## 6. Minimum acceptance tests

- Pause a posting after `enforcePeriodLock()` reads an open period; acquire the close lock and take the close snapshot; verify the posting cannot commit into the closed FY after the close finalizes. Also test lease expiry/reclaim and stale-worker abort.
- Run bill cancellation on a deployment without transaction support and force stock failure on a replica set; verify the unsupported path makes no writes and the transactional path rolls back every participant.
- Test missing/invalid PAN with query rates of 0%, 1%, 2%, and 20%; ensure only approved statutory outcomes are returned.
- Post a subcontractor payout with zero TDS and verify its bank leg is not classified as a TDS leg. Test contractor payable credits, mixed sections, multiple source debits per voucher, and exact taxable-base allocation.
- Reconcile a labor period with advances and settlements, a zero-advance period with nonzero GL, multiple similar leader names, and multiple leader debit legs; verify independent balances, exact matching, and cutoff behavior.
- Submit one generic voucher with two labor advance lines for the same period; verify both distinct rows or an explicitly aggregated amount is preserved. Retry a successful dedicated advance/settlement request with the same source key, then retry with a conflicting payload; verify one deterministic result and no duplicate or silent skip.
- Run the ledger migration against legacy missing/null rows and duplicate `(firmId, voucherGroupId, legIndex)` keys; verify the migration reports and blocks on conflicts rather than continuing as ready.
- Replay a voucher with equal total debit/credit but changed accounts, party IDs, or tax metadata; verify it is rejected. Test duplicate-key handling inside a caller-managed transaction and without a session.

## 7. Final status

The current revision resolves the bill-cancellation no-transaction fallback and improves close-owner checks, firm-scoped TDS identity, strict numeric parsing, cutoff-aware labor matching, effective-ledger queries, and PostgreSQL batch handling. It does **not** yet guarantee close snapshot consistency against in-flight postings, reliable Section 194C history/rates, independent reconciliation totals, lossless labor idempotency, safe ledger migration, or complete voucher replay identity. **F-01 and F-03 through F-08 should be resolved and covered by integration tests before the system is treated as an authoritative consolidated ledger.**
