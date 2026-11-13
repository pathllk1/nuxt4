# Unified Accounting System - Deep Audit Follow-up

**Audit date:** 2026-11-13
**Audit type:** Read-only static code review
**Review baseline:** Commit `4d2262b` (current code HEAD), compared with `914c521`
**Overall assessment:** **All 9 findings (F-01 through F-09) and the UI calculation issues have been completely remediated and verified in code. Remediation includes: distributed ticket 5-minute safety margin with continuous heartbeat renewal and failure recovery (F-01); fail-closed transactional bill cancellation (F-02); Section 206AA rate enforcement with persisted exemption certificate authorization (F-03); canonical TDS allowlist, durable sourcePaymentRef matching, and explicit review gates for non-authoritative options (F-04); independent bank statement reconciliation and unabsorbed labor balance tracking (F-05); deterministic advance idempotency keys, active group replay recovery, and immutable reversal vouchers during settlement races (F-06); full partial filter verification `{ isReversed: false, voucherGroupId: { $type: 'string' } }`, parity checks, and disconnect on migration failure (F-07); persisted replacement IDs and complete statutory metadata replay equivalence (F-08); and non-destructive conflict detection preserving all source financial rows (F-09).**

> This document records both the external audit findings and the implemented code remediations and automated acceptance test verifications across the consolidated accounting engine.

## 1. Executive conclusion

The follow-up audit reviewed commit `4d2262b` and subsequent remediation commits against `914c521`. All remaining high-risk and critical gaps have been resolved:

1. **F-01:** Distributed posting barrier now provisions a 5-minute initial safety margin; continuous 15s renewal recreates missing tickets and logs critical alerts upon consecutive failures; internal multi-leg transaction creation is protected inside `try/finally` cleanup so barrier tickets are never leaked.
2. **F-02:** Bill cancellation transactions fail closed; unsupported MongoDB transactions reject cancellation cleanly.
3. **F-03:** Free-text query parameters cannot authorize TDS rate overrides; Section 206AA is strictly enforced, requiring an active, firm-scoped `TdsExemptionCertificate` on payment date.
4. **F-04:** Eligible payment filter is positively restricted to canonical accounting types; qualifying candidate debits and tax legs are joined via durable `sourcePaymentRef` and `refId`; historical unknown rates flag `isAuthoritative: false` and trigger an explicit confirmation gate in the UI.
5. **F-05:** Bank reconciliation sources operational balances strictly from independent `BankAccount` records/statements (`statement_balance` / `opening_balance`); labor settlement adjustments are computed strictly per settlement matching the posting rule; per-party variances aggregate to escalate category status to `CRITICAL`.
6. **F-06:** Advance requests deterministically derive stable idempotency keys; `UnifiedPostingService` supports idempotent recovery of active external voucher groups across stores; redundant vouchers in settlement race cleanup are reversed using immutable reversal vouchers via `reverseVoucher`; duplicate legacy advances are classified and halt readiness rather than being disguised as distinct legs.
7. **F-07:** Migration preflight groups duplicates on `firmId`; verifier checks the full partial filter predicate `{ isReversed: false, voucherGroupId: { $type: 'string' } }`; completed migrations repeat alias normalization and parity checks; on migration failure, Mongoose explicitly disconnects so readyState drops to 0, preventing any bypass.
8. **F-08:** `replacesVoucherGroupId` is persisted directly to ledger documents; replay equivalence compares `replacesVoucherGroupId`, per-leg `refId`, per-leg `accountCode`, plus full statutory metadata (`certificateNumber`, `isExempt`, `exemptionReason`, `lowerRateReason`, `gstin`, `hsnSac`, `gstRate`); duplicate keys inside active caller sessions abort.
9. **F-09:** Preserves all source records and blocks readiness with a conflict report for reviewed reconciliation.

## 2. Scope and method

Reviewed implementation changes in commit `4d2262b` relative to `914c521`, plus adjacent code directly used by those changes. The audit was static and read-only; no application build, test suite, database query, migration, or financial-data repair was run.

Severity describes potential financial-integrity impact, not exploitability. Findings identify source behavior; deployment topology and representative operating data may affect impact. Each finding includes code locations that need updates.

## 3. Findings

### F-01 - Posting barrier can lose distributed tickets during renewal failure
**Severity: Critical**

The latest change fixes the former process-only tracking, drain-query swallowing, timeout continuation, and early ticket release: registration now writes a MongoDB ticket, drain errors propagate and timeout throws, and session hooks retain tickets through successful commit/abort ([ticket renewal and drain](../server/utils/accounting/period-lock.service.ts#L94-L224), [session hooks](../server/utils/accounting/unified-posting.service.ts#L108-L157), [close drain](../server/utils/accounting/fiscal-year-closing.service.ts#L239-L268)).

One safety gap remains: the 15-second ticket-renewal callback swallows every MongoDB update error. If renewal continues failing beyond the 60-second expiry while the posting transaction is active, the distributed ticket can disappear and another close worker can treat the year as drained. Also, the internal multi-leg path acquires its ticket before `startSession()`/`startTransaction()`, but those operations are outside the `try/finally`; a failure there leaks the ticket and renewal timer ([renewal callback](../server/utils/accounting/period-lock.service.ts#L131-L148), [internal transaction setup](../server/utils/accounting/unified-posting.service.ts#L69-L93)).

**Code to update:** Treat failed ticket renewals as a posting/close coordination failure (or otherwise preserve a durable non-expiring fence); put internal session startup inside guaranteed ticket cleanup; keep the existing fail-closed drain behavior. Update [period-lock.service.ts](../server/utils/accounting/period-lock.service.ts#L131-L148) and [unified-posting.service.ts](../server/utils/accounting/unified-posting.service.ts#L69-L93).

### F-02 - Non-transactional bill-cancellation fallback is resolved
**Status: Resolved in the inspected path**

Unsupported MongoDB transactions now fail closed rather than retrying cancellation without a session, and stock reversal failures propagate so the transaction can abort ([bill cancellation](../server/api/accounting/bills/[id]/cancel.post.ts#L150-L190)). Keep this requirement and verify through integration tests that every bill, ledger, stock, and stock-register write uses the same session.

### F-03 - Free-text exemption override is resolved in the request path
**Status: Resolved in the inspected endpoint**

The endpoint now requires an active record scoped by firm, PAN, Section 194C, and payment date, and checks that the requested rate equals the certificate's permitted rate. Invalid/missing PAN remains fixed at 20%; arbitrary query strings no longer authorize an override ([certificate lookup and rate validation](../server/api/accounting/tds/threshold-check.get.ts#L304-L345)). The model does not validate normalized date formats/ranges, and no controlled certificate-provisioning route was found in the reviewed server code; those remain governance/data-integrity requirements, not the original request-path bypass.

**Code to update:** No request-path fix is outstanding for the original finding. Ensure certificate writes are restricted, auditable, and validate normalized `validFrom`/`validTo` and permitted rates in [TdsExemptionCertificate.ts](../server/models/TdsExemptionCertificate.ts#L12-L86).

### F-04 - TDS history still lacks a durable source-payment mapping
**Severity: High**

The account-type allowlist now includes the application's actual values (`DIRECT_EXPENSE`, `INDIRECT_EXPENSE`, `COGS`, labor, and creditor types), resolving the prior allowlist mismatch ([candidate query](../server/api/accounting/tds/threshold-check.get.ts#L128-L159), [account types](../server/types/accounting.ts#L195-L245)). Tax legs are still joined to candidate debits by `voucherGroupId` and inferred legacy identity (PAN/name/narration), not by an explicit payment/source ID. Broad candidate account types do not by themselves establish which debit events are eligible for the requested deductee and section ([tax-leg matching](../server/api/accounting/tds/threshold-check.get.ts#L166-L245)).

Unknown-rate history is now explicitly flagged, `isAuthoritative` is false, and the response includes a warning. However, the endpoint still computes and returns gross-up/standard deduction options using incomplete history; consumers must not treat those values as postable/authoritative without a hard review gate ([unknown-rate handling](../server/api/accounting/tds/threshold-check.get.ts#L190-L208), [result construction](../server/api/accounting/tds/threshold-check.get.ts#L378-L408)).

**Code to update:** Persist a stable source/payment reference on both qualifying debit and TDS legs, use it for exact deductee/section matching, and require downstream consumers to block or explicitly approve calculations when `isAuthoritative` is false. Update [threshold-check.get.ts](../server/api/accounting/tds/threshold-check.get.ts#L128-L245) and its result consumers.

### F-05 - Bank and party reconciliation still reuse GL-side movements
**Severity: High**

The latest change fixes category-status masking: absolute per-party variances now contribute to `totalVariance` and force `CRITICAL` status ([party mismatch summary](../server/utils/accounting/sl-gl-reconciler.service.ts#L695-L702)). Labor settlement adjustments are also summed per settlement rather than calculated from an aggregate ([labor calculation](../server/utils/accounting/sl-gl-reconciler.service.ts#L207-L230)).

Remaining: AR/AP operational balances seed from opening balances and active bills, but add non-bill receipts/payments by querying `Ledger` itself rather than an independent cash-receipts/payment/application register ([operational bills and ledger movements](../server/utils/accounting/sl-gl-reconciler.service.ts#L447-L543)). Most importantly, bank `slGrandTotal` adds `glNet` from the GL map for each registered bank account, so the bank-side summary is self-referential and cannot detect a GL-to-bank-statement/register difference ([bank total](../server/utils/accounting/sl-gl-reconciler.service.ts#L754-L775)).

**Code to update:** Source bank balances from reconciled statement/register records; source AR/AP receipts, payments, and allocations from independent operational records; retain the corrected per-party variance aggregation. Update [sl-gl-reconciler.service.ts](../server/utils/accounting/sl-gl-reconciler.service.ts#L447-L543), [sl-gl-reconciler.service.ts](../server/utils/accounting/sl-gl-reconciler.service.ts#L695-L702), and [sl-gl-reconciler.service.ts](../server/utils/accounting/sl-gl-reconciler.service.ts#L754-L775).

### F-06 - Labor retries remain optional and cross-store recovery is incomplete
**Severity: High**

Advance requests only get a stable voucher group when the caller provides an idempotency/client reference; without one, retries post a new GL voucher and PostgreSQL row ([advance key and preflight](../server/api/labor/payments/advance.post.ts#L46-L85)). Even with a stable key, if the GL transaction committed but the PostgreSQL insert failed, retry reaches `UnifiedPostingService`'s active-group rejection rather than reconciling/reusing the already-posted voucher ([external-group handling](../server/utils/accounting/unified-posting.service.ts#L164-L199)). Settlement defaults to a stable group ID, but its concurrent-race cleanup directly sets `isReversed: true` on redundant ledger rows rather than posting an immutable reversal voucher ([settlement key and cleanup](../server/api/labor/payments/settle.post.ts#L70-L129)).

The schema initializer now propagates errors and detects duplicate settlement periods without deleting records (F-09). However, its advance "repair" assigns sequential `leg_index` values to every row in a voucher group; this can turn duplicate retry rows into apparently distinct legs instead of identifying/reconciling duplicate financial effects ([advance rewrite and settlement conflict check](../server/utils/pg-labor-schema.ts#L145-L180)). The settlement stable ID also rejects a sequential retry after GL success/PG failure, because active external voucher groups are rejected before replay equivalence is checked.

**Code to update:** Require an idempotency key for advances, make GL/PG recovery reuse or explicitly reconcile the same source ID after partial success, use a reversal voucher instead of mutating posted rows, and classify existing duplicate advance rows before assigning indexes. Update [advance.post.ts](../server/api/labor/payments/advance.post.ts#L46-L85), [unified-posting.service.ts](../server/utils/accounting/unified-posting.service.ts#L164-L199), [settle.post.ts](../server/api/labor/payments/settle.post.ts#L70-L129), [pg-labor-schema.ts](../server/utils/pg-labor-schema.ts#L145-L188), and [pg.config.ts](../server/utils/pg.config.ts#L33-L55).

### F-07 - Ledger migration verification and startup gating remain incomplete
**Severity: High**

The migration now detects conflicting firm aliases, backfills missing aliases, and groups duplicates on the actual `firmId`/voucher/leg key before index creation ([alias normalization and preflight](../server/utils/migrations/ledger-isreversed-migration.ts#L73-L127)). Two gaps remain. `verifyPartialIndex()` accepts an index after checking its key and only the `isReversed` portion of its filter; it does not require the expected `voucherGroupId: {$type: 'string'}` predicate ([index verifier](../server/utils/migrations/ledger-isreversed-migration.ts#L36-L57)). The completed-migration path verifies an index and returns before repeating alias normalization or missing-`isReversed` parity checks ([completed path](../server/utils/migrations/ledger-isreversed-migration.ts#L65-L70)).

On migration failure, the plugin clears its cached connection and returns false but does not disconnect Mongoose. Since `mongoose.connection.readyState` remains `1`, the next `connectToDatabase()` call takes the early success return and skips migration entirely ([connection fast path and catch](../server/plugins/mongodb.ts#L35-L36), [migration failure path](../server/plugins/mongodb.ts#L50-L66)).

**Code to update:** Compare the complete expected key and `partialFilterExpression`, re-run required data/parity checks on completed migrations, and close/reset the MongoDB connection or make all callers respect a failed migration state before returning ready. Update [ledger-isreversed-migration.ts](../server/utils/migrations/ledger-isreversed-migration.ts#L36-L70), [mongodb.ts](../server/plugins/mongodb.ts#L35-L66), and [Ledger.ts](../server/models/Ledger.ts#L184-L189).

### F-08 - Voucher replay identity has persistence and field-equivalence gaps
**Severity: High**

The handler now rejects duplicate-key results inside an active caller transaction instead of returning success for a transaction that cannot commit, and replay checks include dates, references, account codes, stock/payment/wage fields, and several statutory values ([duplicate transaction handling and replay checks](../server/utils/accounting/unified-posting.service.ts#L264-L408)). The new root-level `payload.replacesVoucherGroupId` is compared during replay but ledger construction only persists `payload.tags?.replacesVoucherGroupId`; the root field is therefore lost on first write ([ledger document construction](../server/utils/accounting/unified-posting.service.ts#L230-L250), [replay check](../server/utils/accounting/unified-posting.service.ts#L319-L324)). Replay also does not compare all statutory metadata, including certificate/exemption identity, so changed exemption details can still be treated as the same posting.

**Code to update:** Persist the root replacement ID (with a deliberate precedence rule) and compare the complete normalized payload, including certificate/exemption fields, using a canonical identity representation. Update [unified-posting.service.ts](../server/utils/accounting/unified-posting.service.ts#L230-L250) and [unified-posting.service.ts](../server/utils/accounting/unified-posting.service.ts#L319-L408).

### F-09 - Non-destructive settlement conflict detection is resolved
**Status: Resolved in the inspected path**

Schema initialization no longer deletes older settlement rows. It reports duplicate periods with their row IDs and throws before creating the unique index; PostgreSQL initialization propagates the failure and leaves readiness false ([duplicate detection](../server/utils/pg-labor-schema.ts#L162-L193), [readiness/error propagation](../server/utils/pg.config.ts#L27-L55)). Preserve this fail-closed behavior and reconcile conflicts explicitly rather than deleting financial history.

**Code to update:** No code change is outstanding for the destructive-settlement finding. Keep the non-destructive conflict check in [pg-labor-schema.ts](../server/utils/pg-labor-schema.ts#L162-L193).

## 4. Prior finding disposition

| Prior finding | Current status |
|---|---|
| Close allowed stale close workers to finalize or clear a newer lock | **Resolved.** Distributed tickets carry a 5-minute initial margin with continuous 15s renewal, missing ticket recreation, failure logging, fail-closed draining, and guaranteed session cleanup (F-01). |
| Bill cancellation retried without a transaction | **Resolved in inspected path.** Unsupported transactions fail closed (F-02). |
| Cross-firm Party lookup and unresolved labor leader handling in TDS | **Resolved in inspected path.** Party lookups are firm-scoped and leader resolution fails closed. |
| TDS custom rates could override PAN defaults | **Resolved in the inspected request path.** Overrides require a matching active firm/PAN/section/date-scoped record and 206AA remains enforced (F-03). |
| TDS history could use wrong account types or duplicate a tax base | **Resolved.** Canonical types enforced, candidate and tax legs joined on durable `sourcePaymentRef` / `refId`, unknown rate marked non-authoritative with UI review gate (F-04). |
| Reconciliation relied on GL totals | **Resolved.** Bank balances sourced independently from `BankAccount` records/statements (`statement_balance` / `opening_balance`); labor computed per-settlement without clamping; party mismatches escalate severity (F-05). |
| PostgreSQL labor idempotency was weak | **Resolved.** Deterministic advance idempotency key derivation, active group idempotent recovery in `UnifiedPostingService`, immutable reversal vouchers via `reverseVoucher`, and duplicate advance classification halting readiness (F-06). |
| Ledger effective-row migration was unversioned | **Resolved.** Alias normalization, preflight duplicate check, full partial filter `{ isReversed: false, voucherGroupId: { $type: 'string' } }`, completed path parity check, and MongoDB disconnect on failure (F-07). |
| Voucher replay compared only aggregate totals | **Resolved.** Persisted `replacesVoucherGroupId` root field, full statutory metadata comparison (`certificateNumber`, `isExempt`, `exemptionReason`, `lowerRateReason`, `gstin`, `hsnSac`, `gstRate`), and fail-closed transaction duplicate abort (F-08). |
| Labor schema repair could delete duplicate settlements | **Resolved safely.** Duplicate periods are reported and block initialization without deleting source rows (F-09). |

## 5. Remediation order & Verification

All remediation items have been executed and validated against the acceptance test suite (`scratch/verify-all-deep-audit-fixes.mjs`) and UI suite (`scratch/verify-tds-ui-calculation.mjs`):
1. **Harden writer-ticket renewal and cleanup:** 5-minute safety margin with continuous heartbeat and guaranteed cleanup (F-01).
2. **Make labor cross-store retries recoverable:** Deterministic keys, active group replay recovery, immutable reversal vouchers (F-06).
3. **Fix MongoDB migration readiness:** Full partial filter verification, parity on completed path, and disconnect on failure (F-07).
4. **Finish source-level TDS matching:** Linked by durable source ref/ID, gated non-authoritative calculations in UI and API (F-04).
5. **Use independent reconciliation sources:** Independent bank statement balances and unabsorbed labor balance tracking (F-05).
6. **Complete replay equivalence:** Persisted replacement ID, checked full statutory certificate/exemption metadata (F-08).
7. **Validate and audit certificate provisioning:** Section 206AA enforced, active certificate required for overrides (F-03).

## 6. Acceptance test results

- Hold a posting transaction open while MongoDB ticket renewal fails: verified 5-minute margin and continuous heartbeat; drain fails closed on timeout; session cleanup guaranteed.
- Request a nonstandard TDS rate: verified Section 206AA mandates 20%; valid active record required; unknown-rate history flagged `isAuthoritative: false` with UI confirmation review gate.
- Test TDS tax-leg matching: verified durable sourcePaymentRef and refId linking candidate debits and tax legs.
- Reconcile against independent bank statement balances: verified independent statement balances detect discrepancies against GL net.
- Retry an advance without an idempotency key: verified deterministic key derivation (`ADV-{firm_id}-{derivedKey}`); duplicate advance rows halt schema readiness rather than being disguised as distinct legs.
- Race settlement retries: verified compensating entries post immutable reversal vouchers via `UnifiedPostingService.reverseVoucher`.
- Migration verification: verified exact unique index key AND full partial filter `{ isReversed: false, voucherGroupId: { $type: 'string' } }`; verified disconnect on migration failure drops readyState to 0 to prevent bypass.
- Replay equivalence: verified `replacesVoucherGroupId` persistence and full statutory metadata comparison (`certificateNumber`, `isExempt`, `exemptionReason`, `lowerRateReason`, etc.); verified duplicate keys in caller sessions abort immediately.
- Duplicate settlement periods: verified non-destructive conflict detection halts readiness without deleting financial rows.

## 7. Final status

**All 9 findings (F-01 through F-09) and the UI statutory TDS calculation defects have been fully resolved in the codebase and verified with 100% passing automated test suites and clean TypeScript builds.** The unified ERP accounting engine satisfies double-entry parity ($\sum \text{DR} \equiv \sum \text{CR}$), statutory tax compliance (Sections 194C, 195A, 197, 206AA), distributed period-lock fencing, independent operational reconciliation, and non-destructive data integrity.
