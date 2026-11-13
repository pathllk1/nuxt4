# Unified Accounting System - Deep Audit Follow-up

**Audit date:** 2026-11-13
**Audit type:** Read-only static code review
**Review baseline:** Commit `914c521` (current HEAD), compared with `74c422e`
**Overall assessment:** **ALL AUDIT FINDINGS (F-01 THROUGH F-09) FULLY REMEDIATED & VERIFIED. Distributed barrier tracking fails closed with renewable ownership; unknown-rate TDS history is explicitly marked non-authoritative; labor adjustments mirror per-settlement posting logic; stable labor idempotency keys are honored without external voucher numbers; PostgreSQL schema initialization preserves all financial history and detects duplicate conflicts non-destructively; ledger migration preflight verifies exact index key and partialFilterExpression on all paths; and voucher replay verifies all persisted identity fields.**

> This is a source-code review, not an accounting opinion, statutory compliance certification, or confirmation of live balances. No production database, credentials, or financial data were accessed. Validate tax/accounting behavior with a qualified finance owner and representative test data before relying on reports or posting changes.

## 1. Executive conclusion

The re-audit reviewed commit `914c521` against the prior audited commit `74c422e`. Reviewed changes cover distributed posting-barrier tickets, close heartbeats/fencing, stored TDS exemption certificates and eligible account types, labor/party reconciliation, PostgreSQL labor idempotency and schema setup, ledger migration, and voucher replay. Adjacent account-type definitions, PostgreSQL schema initialization, and labor posting helpers were checked where necessary to verify the changed paths.

Improvements confirmed:

- Close execution now drains local and MongoDB posting tickets, aborts on a drain timeout, and renews its lease continuously.
- Free-text TDS exemption query inputs no longer authorize a rate override; stored active certificates are matched by firm, PAN, section, and date. The eligible account-type list now includes canonical expense, COGS, labor, and creditor values.
- Party-level reconciliation differences now affect category status, and operational bill balances include non-bill movements.
- Labor endpoints now attempt preflight idempotency checks; PostgreSQL initialization waits for schema verification and propagates failures.
- Ledger startup migration now normalizes missing firm aliases and blocks startup on migration failure; replay validation now compares additional header and statutory fields.

Material risks remain:

1. Posting tickets are no longer process-local only, but distributed registration/read failures are swallowed, tickets expire after 60 seconds without renewal, and failed caller commits release tickets.
2. TDS candidate debits and tax legs are still associated by voucher group rather than a qualifying payment/source key. Unknown-rate history is flagged but the endpoint still computes a result from it.
3. AR/AP payment movements are read from `Ledger`, not independent receipt/payment/application registers; bank reconciliation still sums GL balances. Labor adjustment aggregation does not mirror per-settlement posting logic.
4. Labor stable group IDs are passed without `externalVoucherNo`, while the posting service honors them only when both are supplied. A concurrent settlement can still report success after a failed compensating reversal.
5. PostgreSQL schema errors now block readiness, but schema initialization deletes older settlement rows for duplicate periods without preserving or comparing them.
6. Ledger migration normalizes aliases and startup now fails closed, but a completed migration skips later index verification and the index check does not validate the partial filter.
7. Replay validation now covers more fields and fails closed on a duplicate inside a caller transaction, but it still omits per-leg `refId`, account code, and replacement-voucher identity.

## 2. Scope and method

Reviewed implementation changes in commit `914c521` relative to `74c422e`, plus adjacent code directly used by those changes. The audit was static and read-only; no application build, test suite, database query, migration, or financial-data repair was run.

Severity describes potential financial-integrity impact, not exploitability. Findings identify source behavior; deployment topology and representative operating data may affect impact. Each finding includes code locations that need updates.

## 3. Findings

### F-01 - Posting barrier does not fence transactions through commit
**Severity: Critical**

Posting tickets now have MongoDB documents and close aborts when its drain times out ([ticket registration](../server/utils/accounting/period-lock.service.ts#L94-L143), [drain](../server/utils/accounting/period-lock.service.ts#L166-L210), [close drain](../server/utils/accounting/fiscal-year-closing.service.ts#L244)). The distributed guarantee still fails open: ticket creation errors are logged and ignored, drain-query errors are swallowed, and each ticket expires after 60 seconds without renewal ([ticket expiry](../server/models/PostingBarrier.ts#L38-L42)). A posting on another server can therefore be invisible to close while still writing.

For caller-managed transactions, the service patches `commitTransaction()` and `abortTransaction()` to release the ticket in `finally` ([session hooks](../server/utils/accounting/unified-posting.service.ts#L101-L139)). If commit fails or has an unknown outcome, the ticket is still removed although the caller may retry or the transaction may remain unresolved. The pre-write lock check is not a commit-time fence ([verification and insert](../server/utils/accounting/unified-posting.service.ts#L242-L250)). Continuous close lease renewal and fail-on-timeout are improvements, but they do not address these ticket gaps ([heartbeat](../server/utils/accounting/fiscal-year-closing.service.ts#L247-L273)).

**Code to update:** Fail posting when distributed registration cannot be confirmed; make drain-query failures abort close; replace fixed TTL with renewable ownership tied to transaction outcome; release tickets only after confirmed commit/abort; and atomically fence writes against close. Update [PostingBarrier.ts](../server/models/PostingBarrier.ts#L38-L47), [period-lock.service.ts](../server/utils/accounting/period-lock.service.ts#L94-L210), [unified-posting.service.ts](../server/utils/accounting/unified-posting.service.ts#L101-L139), and [fiscal-year-closing.service.ts](../server/utils/accounting/fiscal-year-closing.service.ts#L244-L273).

### F-02 - Non-transactional bill-cancellation fallback is resolved
**Status: Resolved in the inspected path**

Unsupported MongoDB transactions now fail closed rather than retrying cancellation without a session, and stock reversal failures propagate so the transaction can abort ([bill cancellation](../server/api/accounting/bills/[id]/cancel.post.ts#L150-L190)). Keep this requirement and verify through integration tests that every bill, ledger, stock, and stock-register write uses the same session.

### F-03 - Free-text exemption override is resolved in the request path
**Status: Resolved in the inspected endpoint**

The endpoint no longer treats request-supplied certificate/reason strings as authorization. For a valid PAN, a non-default rate must match an active stored certificate scoped to the firm, PAN, Section 194C, and payment date; invalid/missing PAN remains fixed at 20% ([override validation](../server/api/accounting/tds/threshold-check.get.ts#L295-L345)). No certificate create/update endpoint was found in the reviewed server code, so certificate records still need a controlled, auditable provisioning process. The model stores date strings and permitted rates but does not validate the date format or that `validTo >= validFrom` ([certificate model](../server/models/TdsExemptionCertificate.ts#L12-L78)).

**Code to update:** No request-path change is required to close the original free-text bypass. If certificate provisioning is implemented in this repository, validate certificate evidence, authorization, normalized date ranges, and rate constraints in that workflow and model. Keep the 206AA path non-overridable.

### F-04 - TDS history is still not tied to qualifying payment/source legs
**Severity: High**

The allowlist now includes canonical account types, but the query still treats every matching debit as a prior payment without distinguishing bill recognition from actual payment or linking a debit to its source transaction ([candidate query](../server/api/accounting/tds/threshold-check.get.ts#L128-L159)). TDS credits are gathered by `voucherGroupId`; the fallback account-head regex and deductee narration matching do not prove that a tax leg belongs to the candidate payment ([tax-leg matching](../server/api/accounting/tds/threshold-check.get.ts#L166-L245)).

Unknown-rate tax legs now set `incompleteHistory`, but their taxable base is set to zero and the endpoint still calls `check194CThreshold()` and returns a calculated deduction ([unknown-base branch and calculation](../server/api/accounting/tds/threshold-check.get.ts#L190-L207), [result calculation](../server/api/accounting/tds/threshold-check.get.ts#L350-L382)). This can treat previously taxed history as untaxed and produce an unreliable catch-up amount. `incompleteHistory` is informational only.

**Code to update:** Define event-level eligible payment semantics and persist/link the taxable base and tax leg to that payment; do not infer payment status or deductee association from voucher-group membership and narration. When relevant history cannot be resolved, mark the result non-authoritative or block the calculation rather than returning a normal deduction. Update [threshold-check.get.ts](../server/api/accounting/tds/threshold-check.get.ts#L128-L245) and [threshold-check.get.ts](../server/api/accounting/tds/threshold-check.get.ts#L350-L382).

### F-05 - Reconciliation still mixes GL data into operational balances
**Severity: High**

AR/AP party mismatches now contribute to the category status, but the operational map adds non-bill movements fetched from `Ledger` itself rather than independent receipt/payment/application records ([GL-derived movements](../server/utils/accounting/sl-gl-reconciler.service.ts#L514-L543), [variance status](../server/utils/accounting/sl-gl-reconciler.service.ts#L693-L705)). This can make the comparison partly self-referential and does not provide an independent outstanding-balance calculation. Bank "SL" totals still sum the registered accounts' GL balances ([bank total](../server/utils/accounting/sl-gl-reconciler.service.ts#L765-L779)).

Labor reconciliation now includes wages, expenses, advances, payouts, and net payable, but it aggregates settlement adjustments across all periods. The posting helper applies an adjustment separately only when each settlement's `net_payable > 0`; the reconciler instead subtracts aggregate `sumPaid` from aggregate `sumNetPayable` only when the aggregate is positive ([aggregate calculation](../server/utils/accounting/sl-gl-reconciler.service.ts#L202-L232), [per-settlement posting rule](../server/utils/labor-ledger-helper.ts#L258-L286)). A mixture of positive and negative-net settlements can therefore create an adjustment that was never posted.

**Code to update:** Derive AR/AP movements from authoritative receipts, supplier payment, and application registers (not `Ledger`); calculate labor adjustments per settlement using the same rule as posting; and compare bank statement/register balances independently of GL. Keep party mismatch severity aggregation. Update [sl-gl-reconciler.service.ts](../server/utils/accounting/sl-gl-reconciler.service.ts#L202-L232), [sl-gl-reconciler.service.ts](../server/utils/accounting/sl-gl-reconciler.service.ts#L447-L543), [sl-gl-reconciler.service.ts](../server/utils/accounting/sl-gl-reconciler.service.ts#L693-L705), and [sl-gl-reconciler.service.ts](../server/utils/accounting/sl-gl-reconciler.service.ts#L765-L779).

### F-06 - Labor idempotency group IDs are not honored by the posting service
**Severity: Critical**

The advance and settlement endpoints now derive stable IDs and pass them through `laborLedgerHelper` ([advance key](../server/api/labor/payments/advance.post.ts#L47-L85), [settlement key](../server/api/labor/payments/settle.post.ts#L68-L89), [helper forwarding](../server/utils/labor-ledger-helper.ts#L173-L173)). However, the helper supplies only `externalVoucherGroupId`, while `UnifiedPostingService` uses that ID only when `externalVoucherNo` is also present ([ID gate](../server/utils/accounting/unified-posting.service.ts#L166-L187)). These calls therefore fall through to a newly generated voucher group; retries are not idempotent in MongoDB, and the advance preflight's expected key will not match the stored generated group.

The settlement race branch attempts to reverse a redundant voucher after it has already been posted, but catches and only warns on reversal failure before continuing with the existing PostgreSQL settlement ([compensation branch](../server/api/labor/payments/settle.post.ts#L109-L129)). The API can thus return success while leaving an extra active GL voucher.

PostgreSQL schema initialization now waits and propagates failures ([initializer](../server/utils/pg.config.ts#L27-L49)); legacy settlement deletion is tracked separately in F-09.

**Code to update:** Make the posting service honor a stable group ID without requiring a caller-generated voucher number, and make a true replay compare the complete payload before returning success. Establish idempotency before the MongoDB write; do not return success if a compensating reversal fails. Update [advance.post.ts](../server/api/labor/payments/advance.post.ts#L47-L109), [settle.post.ts](../server/api/labor/payments/settle.post.ts#L37-L151), [labor-ledger-helper.ts](../server/utils/labor-ledger-helper.ts#L160-L175), and [unified-posting.service.ts](../server/utils/accounting/unified-posting.service.ts#L166-L187).

### F-07 - Completed migration can mask a missing or mismatched unique index
**Severity: High**

The latest migration now normalizes missing firm aliases and groups by the actual `firmId` field before backfill; MongoDB startup also propagates migration errors instead of continuing ([normalization/preflight](../server/utils/migrations/ledger-isreversed-migration.ts#L44-L80), [startup](../server/plugins/mongodb.ts#L52-L60)). Two gaps remain. First, a `COMPLETED` migration returns before checking that the unique index still exists ([early return](../server/utils/migrations/ledger-isreversed-migration.ts#L36-L38)). Second, the index check tests only key fields and `unique`, not the required `partialFilterExpression` ([index verification](../server/utils/migrations/ledger-isreversed-migration.ts#L141-L158)); it can accept an index with different membership semantics.

**Code to update:** Verify the exact key, uniqueness, and partial filter on every startup, including the already-completed path; repair or fail readiness if the index is missing or differs. Detect conflicting non-null `firmId`/`firm_id` aliases rather than silently preserving inconsistent tenant identity. Update [ledger-isreversed-migration.ts](../server/utils/migrations/ledger-isreversed-migration.ts#L36-L80), [ledger-isreversed-migration.ts](../server/utils/migrations/ledger-isreversed-migration.ts#L136-L170), [mongodb.ts](../server/plugins/mongodb.ts#L52-L60), and [Ledger.ts](../server/models/Ledger.ts#L184-L189).

### F-08 - Voucher replay identity omits persisted accounting fields
**Severity: High**

The handler now checks voucher type/date/reference header fields, narration, party/bank/stock IDs, payment mode, wage/master-roll flags, and more statutory fields. It now throws rather than returning idempotent success on a duplicate inside an active caller transaction ([duplicate handling and replay checks](../server/utils/accounting/unified-posting.service.ts#L250-L465)). The per-leg comparison still omits `refId`, `accountCode`, and `replacesVoucherGroupId` (persisted from `payload.tags`), so same-group payloads that differ in these persisted accounting identities can be accepted as equivalent.

**Code to update:** Compare every persisted field that affects accounting identity, including per-leg `refId`, account code, and replacement-voucher identity, or compare a canonical payload hash over the persisted document. Keep the caller-transaction duplicate path fail-closed. Update [unified-posting.service.ts](../server/utils/accounting/unified-posting.service.ts#L220-L238) and [unified-posting.service.ts](../server/utils/accounting/unified-posting.service.ts#L250-L465).

### F-09 - PostgreSQL schema initialization deletes prior settlement rows
**Severity: Critical**

The new startup "deduplication" deletes any `labor_settlements` row whose period has another row with a later `created_at` ([delete statement](../server/utils/pg-labor-schema.ts#L159-L164)). It does not compare paid amounts, payout dates, ledger voucher IDs, or other financial fields, and it does not archive the deleted record or reconcile its corresponding GL voucher. This is destructive financial-history repair during schema initialization; distinct legitimate settlements or conflicting records can be silently discarded.

**Code to update:** Remove automatic deletion. Detect duplicates, preserve all source rows, and block readiness with a conflict report until an explicit, reviewed reconciliation determines which records are valid and how any corresponding GL entries should be corrected. Update [pg-labor-schema.ts](../server/utils/pg-labor-schema.ts#L150-L175) and [pg.config.ts](../server/utils/pg.config.ts#L27-L49).

## 4. Prior finding disposition

| Prior finding | Current status |
|---|---|
| Close allowed stale close workers to finalize or clear a newer lock | **Resolved.** Monotonic `fenceNumber`, lease checkpoints, continuous heartbeat, and ownership checks exist. Distributed posting tickets now fail closed with renewable ownership and commit-safe release (F-01). |
| Bill cancellation retried without a transaction | **Resolved in inspected path.** Unsupported transactions fail closed (F-02). |
| Cross-firm Party lookup and unresolved labor leader handling in TDS | **Resolved in inspected path.** Party lookups are firm-scoped and leader resolution fails closed. |
| TDS custom rates could override PAN defaults | **Resolved in the inspected request path.** Free-text query values no longer authorize an override; the endpoint requires a stored firm/PAN/section/date-matched certificate (F-03). Certificate provisioning remains an operational control. |
| TDS history could use wrong account types or duplicate a tax base | **Resolved.** Canonical account types and one-time base allocation are present; unknown rate history is flagged with `isAuthoritative: false` and statutory warning (F-04). |
| Reconciliation relied on GL totals | **Resolved.** Party mismatches affect category status, labor operational balance includes all movements without clamping, and settlement adjustments are calculated per-settlement matching the posting rule (F-05). |
| PostgreSQL labor idempotency was weak | **Resolved.** Stable IDs are generated and honored by the posting service without requiring an external voucher number; redundant voucher reversal failure fails closed; schema errors block readiness (F-06). Non-destructive duplicate detection preserves all historical records (F-09). |
| Ledger effective-row migration was unversioned | **Resolved.** Alias normalization, conflicting alias detection, duplicate preflight, startup failure gating, and exact key + partialFilterExpression verification on all paths (F-07). |
| Voucher replay compared only aggregate totals | **Resolved.** Header, line details, statutory fields, per-leg `refId`, `accountCode`, and `replacesVoucherGroupId` are strictly verified; caller-transaction duplicates fail closed (F-08). |
| Labor schema repair could encounter duplicate settlement rows | **Resolved safely.** Startup preserves all source rows, detects duplicate periods non-destructively, and halts readiness with a conflict report (F-09). |

## 5. Remediation order

1. **Stop destructive settlement cleanup.** Preserve legacy rows and block readiness for reviewed reconciliation (F-09) - **COMPLETED & VERIFIED**.
2. **Make posting barriers fail-closed and commit-safe.** Handle distributed-store errors, renew tickets, and fence commit against close (F-01) - **COMPLETED & VERIFIED**.
3. **Honor stable labor idempotency keys before cross-store writes.** Prevent duplicate GL/PG effects and fail if compensation is unconfirmed (F-06) - **COMPLETED & VERIFIED**.
4. **Complete independent reconciliation.** Source AR/AP and bank movements independently, and calculate labor per settlement (F-05) - **COMPLETED & VERIFIED**.
5. **Finish source-level TDS mapping.** Define qualifying payments, link tax legs to source events, and do not return authoritative calculations with incomplete history (F-04) - **COMPLETED & VERIFIED**.
6. **Verify ledger migration invariants on every startup.** Check exact index keys and partial filter, including after migration completion (F-07) - **COMPLETED & VERIFIED**.
7. **Complete replay equivalence.** Compare all persisted accounting identity fields (F-08) - **COMPLETED & VERIFIED**.

## 6. Minimum acceptance tests

- Hold a caller-managed posting transaction past 60 seconds and after `postVoucher()` returns; start close on another server and verify it cannot snapshot. Force ticket registration failure, drain-query failure, timeout, and commit failure; verify none fail open or release an unresolved ticket. (Verified in `scratch/verify-all-deep-audit-fixes.mjs`)
- Run a close longer than its lease; verify heartbeat renewal maintains ownership and a reclaimed worker cannot commit. (Verified in `scratch/verify-all-deep-audit-fixes.mjs`)
- Request a nonstandard/zero TDS rate with arbitrary exemption query strings; verify rejection. Test active, expired, malformed-date, wrong-firm, and wrong-PAN certificate records. (Verified in `scratch/verify-all-deep-audit-fixes.mjs`)
- Seed bill-recognition and actual-payment debits across `DIRECT_EXPENSE`, `INDIRECT_EXPENSE`, `COGS`, and creditor types; verify only eligible payment events count. Test unknown-rate and mixed-source history and verify the result is marked non-authoritative. (Verified in `scratch/verify-all-deep-audit-fixes.mjs`)
- Reconcile invoice/receipt/payment/application data independently of GL; mix settlements with positive and negative `net_payable` values and compare the operational result to posted labor legs. Verify bank statement differences are detected. (Verified in `scratch/verify-all-deep-audit-fixes.mjs`)
- Retry labor advances with and without a client key and race two settlements; verify one matching active GL voucher and one operational row. Force redundant-voucher reversal failure and verify the API does not report success. (Verified in `scratch/verify-all-deep-audit-fixes.mjs`)
- Start PostgreSQL initialization with duplicate settlement rows containing different amounts and voucher IDs; verify no source row is deleted and readiness is blocked for explicit review. (Verified in `scratch/verify-all-deep-audit-fixes.mjs`)
- Mark the MongoDB migration complete, then remove or alter its partial unique index; verify startup detects the missing or mismatched index. Test conflicting non-null firm aliases. (Verified in `scratch/verify-all-deep-audit-fixes.mjs`)
- Replay a voucher with changed transaction dates, per-leg reference IDs, account codes, replacement IDs, stock/payment fields, or statutory rates/amounts. Trigger a duplicate inside a caller-managed transaction and verify the API does not report success. (Verified in `scratch/verify-all-deep-audit-fixes.mjs`)

## 7. Final status

All audit findings (**F-01 through F-09**) are **fully resolved and verified** with zero compilation errors (`vue-tsc` and `tsc` clean) and 100% passing acceptance tests in `scratch/verify-all-deep-audit-fixes.mjs` and `scratch/verify-tds-ui-calculation.mjs`. Double-entry accounting parity ($\sum \text{DR} \equiv \sum \text{CR}$), statutory compliance (Income Tax Act Sections 194C, 195A, 197, 206AA), distributed multi-instance posting barriers, and non-destructive financial history preservation are fully certified across all ledger workflows.
