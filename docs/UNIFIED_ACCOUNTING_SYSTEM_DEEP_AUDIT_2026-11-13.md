# Unified Accounting System - Deep Audit Follow-up

**Audit date:** 2026-11-13
**Audit type:** Read-only static code review
**Review baseline:** `e4a2865` plus the current worktree changes to eight accounting implementation files
**Overall assessment:** **The latest changes address several earlier defects, but close-lease ownership, non-transactional cancellation fallback, TDS identity/history, reconciliation completeness, legacy ledger population, and idempotent replay remain material integrity risks.**

> This is a source-code review, not an accounting opinion, statutory compliance certification, or confirmation of live balances. No production database, credentials, or financial data were accessed. Validate tax/accounting behavior with a qualified finance owner and representative test data before relying on reports or posting changes.

## 1. Executive conclusion

The re-audit reviewed the current worktree changes to the year-end close, period-lock model, bill cancellation, TDS threshold endpoint, reconciliation service, ledger model, unified posting service, and generic voucher-to-PostgreSQL synchronization.

Meaningful improvements are present: the close now activates a period lock before the trial-balance read and uses a ten-minute lease; cancellation propagates stock errors; the TDS endpoint validates calendar dates and resolves more selectors; bill reconciliation checks the specific control-account leg and party; labor advance reconciliation checks a GL debit amount; generic multi-row PostgreSQL writes use a transaction; and the ledger index no longer uses the unsupported `$ne` partial-filter predicate.

The fixes are not yet sufficient for an authoritative ledger:

1. The ten-minute close lease has no renewal or fencing token. An expired or stale worker can still finalize or reset a newer worker's close, and older `IN_PROGRESS` locks with no expiry cannot be reclaimed.
2. Bill cancellation now aborts on stock errors when MongoDB transactions work, but its no-transaction fallback can leave the bill and reversal posted before a stock error.
3. TDS selector scoping is improved but still reads party data without firm scope; leader lookup failure can fall back to an unverified identifier. Threshold history and prior-tax matching still include unrelated debit activity and can misattribute TDS across sections or mixed vouchers.
4. Reconciliation adds useful bill/advance checks, but party/labor/bank headline totals are still GL-derived. Some labor checks can match the wrong leader or a future-dated GL voucher.
5. New `isReversed: false` filters and the unique index omit legacy active rows where `isReversed` is missing, while canonical ledger reads still include those rows.
6. The PostgreSQL multi-row write is now atomic within PostgreSQL, but MongoDB/PostgreSQL coordination remains a non-durable saga. Posting replay still has transaction, legacy-row, and payload-equivalence gaps.

## 2. Scope and method

Reviewed the eight modified implementation files in the worktree against baseline `e4a2865`, plus adjacent canonical ledger and period-lock behavior. The separate untracked audit-opinion document was not treated as source evidence. This review was read-only; no application build, test suite, database query, migration, or financial-data repair was run.

Severity describes potential financial-integrity impact, not exploitability. Findings identify observable code behavior; deployment configuration and representative operating data may affect impact.

## 3. Findings

### F-01 - Close lease expiry does not fence stale close workers
**Severity: Critical**

`executeClose()` now atomically acquires an active lock and allows an `IN_PROGRESS` close to be reclaimed after its ten-minute `closeLeaseExpiresAt` ([acquisition](../server/utils/accounting/fiscal-year-closing.service.ts#L167-L218)). There is no lease renewal while closing, and completion and failure cleanup update by firm/FY/status rather than by a unique close-owner token ([completion and cleanup](../server/utils/accounting/fiscal-year-closing.service.ts#L389-L430)).

If a close runs longer than ten minutes, a second worker can reclaim it. The first worker can still commit closing/opening entries and mark the lock `CLOSED`; if it fails, its cleanup can reset the second worker's `IN_PROGRESS` lock to `NOT_CLOSED` and deactivate it. A pre-existing `IN_PROGRESS` record with no `closeLeaseExpiresAt` also matches neither the reclaim filter nor the normal `NOT_CLOSED` filter, leaving it stuck until manual intervention. The active lock blocks new posting attempts, but a posting that passed `enforcePeriodLock()` before lock acquisition is not fenced from committing afterward.

**Required:** Renew leases and add a monotonically unique close-owner/fencing token. Require that token on every close write, finalization, and cleanup; an expired worker must not be able to commit or release another worker's lock. Define recovery for legacy in-progress locks and coordinate with already-running posting transactions before accepting the close snapshot.

### F-02 - Bill cancellation can still partially commit on the no-transaction fallback
**Severity: High**

Stock errors are now logged and rethrown, so a supported MongoDB transaction can abort bill, ledger, and stock writes together ([stock-error handling](../server/api/accounting/bills/[id]/cancel.post.ts#L150-L163)). However, the handler retries `executeCancel(undefined)` when transaction setup reports an unsupported deployment ([fallback](../server/api/accounting/bills/[id]/cancel.post.ts#L168-L190)). `executeCancel()` saves the cancelled bill and posts the ledger reversal before it processes stock movements ([bill and ledger writes](../server/api/accounting/bills/[id]/cancel.post.ts#L24-L98)). If a stock movement then throws on the fallback path, those prior writes have no transaction to roll back.

The response is an error rather than success, which improves observability, but the persisted bill/ledger state can still be partially cancelled while inventory remains unchanged.

**Required:** Do not use a non-transactional fallback for this financial operation unless it implements a durable, idempotent cancellation workflow with compensation and reconciliation. Verify all stock and stock-register writes participate in the same session on transactional deployments.

### F-03 - TDS party resolution can expose another firm's party data and accept an unresolved leader
**Severity: High**

When `partyId` is supplied, the endpoint sets `resolvedPartyId` and calls `Party.findById()` without a firm predicate ([party resolution](../server/api/accounting/tds/threshold-check.get.ts#L59-L75)). The response includes the resulting PAN and party details ([threshold response](../server/api/accounting/tds/threshold-check.get.ts#L265-L283)). A party ID belonging to another firm can therefore be read by an authenticated user of the current firm; the subsequent ledger query is firm-scoped, but that does not scope the Party lookup or prevent the PAN/name disclosure.

For `leaderId`, if PostgreSQL is unavailable or no matching firm-scoped leader is found, the endpoint sets `resolvedAccountHead` to `accountHead || leaderId` and proceeds ([leader fallback](../server/api/accounting/tds/threshold-check.get.ts#L76-L95)). With only an unresolved ID, the ledger query uses that opaque ID as an account head and can return a misleading zero prior total rather than rejecting an unverified deductee.

The new date round-trip and finite-rate checks are improvements. Remaining input concerns: `parseFloat()` accepts numeric prefixes (for example, a value beginning with a number followed by text), and the generic 0-30% limit is not tied to section-specific statutory rate validation even though the endpoint computes Section 194C thresholds.

**Required:** Resolve Party records with both `_id` and current-firm scope, reject missing/foreign parties, and fail closed when a leader cannot be resolved. Parse amount/rate strings strictly and apply finance-approved section-specific rate rules.

### F-04 - TDS YTD and catch-up amounts can still use unrelated activity
**Severity: High**

The prior YTD query sums every positive debit for the selected `partyId` or exact account head in the FY; it does not restrict those debits to Section 194C-eligible credit/payment events or a canonical taxable base ([YTD filter and aggregation](../server/api/accounting/tds/threshold-check.get.ts#L108-L130)). Other debit activity for that party can inflate the threshold.

The prior TDS-leg query accepts any TDS section but does not require `statutory.tdsSection === '194C'`. It then associates candidate legs to prior debits by voucher group. Name/narration substring matching can misidentify a deductee, and the legacy fallback tests whether there is only one entry in the already-scoped `priorEntries`, not whether the entire voucher group has only one debit/deductee ([tax-leg matching](../server/api/accounting/tds/threshold-check.get.ts#L132-L188)). A mixed legacy voucher can therefore mark the selected party's debit as taxed because another party or section has a TDS leg in the same group. Even when the deductee matches, the code adds the full debit amount as already taxed without matching the withheld amount to the applicable taxable base.

**Required:** Build the threshold from explicit eligible transactions for the same deductee and statutory section. Match TDS credits to source transaction, deductee, section, and taxable base; remove name-substring and scoped-entry-count fallbacks or make legacy ambiguity an explicit incomplete result.

### F-05 - Reconciliation improvements do not yet establish independent balances or exact labor parity
**Severity: High**

Party, labor-leader, and bank summary "sub-ledger" totals still add the corresponding GL net balance for registered entities rather than deriving independent operational balances ([labor summary](../server/utils/accounting/sl-gl-reconciler.service.ts#L202-L210), [party summary](../server/utils/accounting/sl-gl-reconciler.service.ts#L430-L445), [bank summary](../server/utils/accounting/sl-gl-reconciler.service.ts#L650-L666)). New bill checks improve the evidence by selecting control-account legs and comparing the bill party/amount, but this remains invoice-level validation, not a full outstanding balance including receipts, applications, and adjustments ([bill control-leg verification](../server/utils/accounting/sl-gl-reconciler.service.ts#L467-L555)).

The labor-advance check selects the first debit leg whose account type is `LABOR_LEADER` or `ADVANCE_TO_LABOR` without requiring that leg to match the PostgreSQL leader name. Multiple leaders in one voucher can therefore be compared against the same GL leg. It also reads GL legs by voucher ID without a `transactionDate <= toDate` cutoff, and accepts a match to either net or gross amount without selecting the expected basis from TDS mode ([labor advance parity](../server/utils/accounting/sl-gl-reconciler.service.ts#L231-L315)).

**Required:** Reconcile party/bank/labor balances to independent source ledgers at the same cutoff. Match labor postings by leader and period dimensions, apply the expected gross/net rule, and constrain GL legs to the report cutoff. Keep invoice control-leg checks as a separate document-level control.

### F-06 - Cross-database labor writes remain a non-durable saga
**Severity: High**

The generic voucher handler now wraps its batch of PostgreSQL labor-advance inserts in `sql.begin()`, fixing the earlier partial-row-commit behavior within that PostgreSQL transaction ([batch write](../server/api/accounting/vouchers.post.ts#L132-L175)). MongoDB posting still commits before PostgreSQL synchronization, and on a reported sync error the handler compensates by marking the GL voucher reversed ([compensation](../server/api/accounting/vouchers.post.ts#L176-L222)). The dedicated advance and settlement endpoints also remain separate MongoDB-then-PostgreSQL operations ([advance](../server/api/labor/payments/advance.post.ts#L45-L128), [settlement](../server/api/labor/payments/settle.post.ts#L52-L131)).

A timeout after PostgreSQL commit can still cause the application to treat the sync as failed and void the MongoDB voucher while PostgreSQL retains its rows. Retrying successful PostgreSQL writes can also duplicate rows because no source-operation idempotency key is established by this change.

**Required:** Keep the PostgreSQL transaction, and add durable cross-store state, source-operation idempotency, retry, and reconciliation. Treat ambiguous commit results as unresolved rather than assuming either commit or compensation succeeded.

### F-07 - `isReversed: false` filters omit legacy effective ledger rows
**Severity: High**

New TDS, reconciliation, and idempotency queries require `isReversed: false`; the ledger index also includes only documents explicitly equal to false ([TDS queries](../server/api/accounting/tds/threshold-check.get.ts#L108-L145), [reconciliation filters](../server/utils/accounting/sl-gl-reconciler.service.ts#L140-L147), [ledger index](../server/models/Ledger.ts#L184-L194)). Existing active ledger rows created before `isReversed` was populated may have the field missing. The canonical `LedgerService.getEffectiveLedgerMatch()` still uses `{ isReversed: { $ne: true } }`, which includes missing values ([canonical filter](../server/utils/accounting/ledger.service.ts#L618-L623)).

Until legacy rows are migrated, threshold checks and reconciliation can omit effective transactions that appear in trial balance/account-balance reports. The partial unique index likewise does not constrain missing-field rows, so it is not a complete uniqueness guarantee during or after migration.

**Required:** Decide and document the canonical effective-row predicate. Backfill legacy rows (including `legIndex` and firm identity as required), detect duplicate keys, then align all reports and index membership. Verify report parity before enabling the index in production.

### F-08 - Duplicate-key replay handling is not a reliable idempotency boundary
**Severity: High**

`postVoucher()` catches every E11000 from `insertMany()` and queries the existing group using `isReversed: false` ([insert and replay handler](../server/utils/accounting/unified-posting.service.ts#L171-L196)). That query omits legacy rows with a missing reversal flag. When the insert was part of a MongoDB transaction, a duplicate-key write may abort the transaction, making a follow-up read on the same session unsuitable as a replay path. The returned replay result also does not verify that the existing voucher legs match the retry payload.

The external voucher pre-check remains separate from insertion, and the service still allows callers to omit the MongoDB session ([posting API](../server/utils/accounting/unified-posting.service.ts#L55-L75), [external-ID check](../server/utils/accounting/unified-posting.service.ts#L102-L126)). The now-supported partial index is an improvement, but it does not replace a required transaction and a firm-scoped source idempotency key.

**Required:** Reserve an idempotency key atomically with the posting, require a transaction for multi-leg writes, and resolve duplicate-key outcomes outside an aborted transaction. Return a replay only after verifying the same source key and payload identity.

## 4. Prior finding disposition

| Prior finding | Current status |
|---|---|
| Reversal counter-vouchers removed the original from effective balances | **Resolved in inspected paths.** Original and reversal remain effective and are linked with reversal metadata. |
| Year-end carry-forward used a different ledger population | **Resolved.** Carry-forward uses `LedgerService.getTrialBalance()`; current F-01 concerns close ownership and write synchronization, not the carry-forward query. |
| GL-derived reconciliation totals | **Partially addressed.** Bill control-leg and labor advance amount checks were added; headline party/labor/bank totals remain GL-derived (F-05). |
| TDS candidate selection treated broad tax accounts as TDS | **Partially addressed.** Explicit metadata/account-head filtering remains; current TDS history still needs section/source matching (F-04). |
| Threshold cutoff and basic input validation | **Partially addressed.** Date validation and finite bounds improved, but entity-scoped history, strict numeric parsing, and section-specific rates remain open (F-03/F-04). |
| Payout TDS metadata loss | **Improved in prior source changes.** The subcontractor payout persists a statutory snapshot; end-to-end register tests are still required. |
| Cross-database compensation and partial PostgreSQL insert | **Partially addressed.** Generic multi-row PG inserts are now transactional and compensation errors are explicit, but the cross-store saga remains non-durable (F-06). |
| External voucher duplicate guard | **Partially addressed.** The partial-index operator is now supported; missing-field migration, session-safe replay, and source-level idempotency remain open (F-07/F-08). |

## 5. Remediation order

1. **Fence close ownership.** Add lease renewal and owner tokens; prevent stale workers from finalizing or unlocking a newer close, and coordinate in-flight postings.
2. **Remove or redesign non-transactional bill cancellation fallback.** Do not leave a cancelled bill/ledger reversal with unchanged inventory.
3. **Make TDS resolution firm-scoped and fail closed.** Strictly parse inputs and calculate prior amounts only from eligible Section 194C source transactions.
4. **Finish independent reconciliation.** Compare operational balances and exact party/leader legs at matching cutoffs.
5. **Add durable dual-database synchronization.** Preserve PG transactionality and add idempotent source keys, retry, and reconciliation.
6. **Migrate ledger state and complete idempotency.** Backfill legacy rows before relying on `isReversed: false` or unique-index behavior; require transactions and payload-aware replay.

## 6. Minimum acceptance tests

- Hold a close beyond its lease; allow a second worker to attempt recovery; verify the stale worker cannot finalize or clear the new owner's lock. Test legacy `IN_PROGRESS` locks with no expiry and a posting already in flight at close acquisition.
- Force stock reversal failure both with MongoDB transactions enabled and through the no-transaction fallback; verify no path leaves an unreported partial cancellation.
- Request threshold results with a party from another firm, an unresolved leader while PostgreSQL is unavailable, numeric strings with trailing nonnumeric characters, and rates at configured boundaries; verify rejection or correct firm-scoped results.
- Test 194C history against non-194C TDS, unrelated debit activity, mixed-party legacy vouchers, partial withholding, and ambiguous source mappings.
- Reconcile a multi-leader voucher and a future-dated ledger voucher against an earlier cutoff; verify correct leader, amount basis, and cutoff handling.
- Compare trial balance, TDS threshold, and reconciliation results with legacy active rows missing `isReversed`; run migration/index validation on representative data.
- Force duplicate-key insertion inside and outside MongoDB transactions, retry with identical and conflicting payloads, and verify deterministic outcomes.
- Simulate PostgreSQL timeout-after-commit and retries; verify no PostgreSQL duplicate and no untracked MongoDB compensation.

## 7. Final status

The current worktree meaningfully improves close locking, bill-cancellation error handling, TDS input validation, invoice/advance reconciliation, PostgreSQL batch atomicity, and the ledger index predicate. It does **not** yet establish safe close lease ownership, atomic cancellation on all supported deployment paths, firm-scoped TDS identity and source-level statutory history, independent reconciliation, legacy-ledger parity, or reliable cross-store/idempotent posting. **F-01 through F-08 should be resolved and covered by integration tests before the system is treated as an authoritative consolidated ledger.**
