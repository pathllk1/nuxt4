# Unified Accounting System - Deep Audit Follow-up

**Audit date:** 2026-11-13
**Audit type:** Read-only static code review
**Review baseline:** Commit `74c422e` (current HEAD), compared with `0a0e9a1`
**Overall assessment:** **The latest changes improve TDS identity, ledger migration, posting replay, and reconciliation, but the posting barrier is not commit-safe, eligible TDS activity is filtered incorrectly, operational reconciliation remains incomplete, and labor retries can still create duplicate effects.**

> This is a source-code review, not an accounting opinion, statutory compliance certification, or confirmation of live balances. No production database, credentials, or financial data were accessed. Validate tax/accounting behavior with a qualified finance owner and representative test data before relying on reports or posting changes.

## 1. Executive conclusion

The re-audit reviewed commit `74c422e` against the prior audited commit `0a0e9a1`. Reviewed changes cover period-lock posting barriers, close heartbeats/fencing, TDS rate and source matching, labor/party reconciliation, PostgreSQL labor idempotency, ledger migration, and voucher replay. Adjacent account-type definitions, PostgreSQL schema initialization, and labor posting helpers were checked where necessary to verify the changed paths.

Improvements confirmed:

- Close execution now increments a fence number, renews its lease at two checkpoints, and attempts to drain in-flight posting tickets.
- TDS history uses a positive account-type filter, allocates a tax base across entries, and the posting service no longer copies voucher-level statutory metadata to bank/cash/expense legs.
- Valid-PAN rate overrides now require an exemption input; invalid/missing PAN rejects rates below 20%.
- Labor reconciliation now subtracts settled advances and attempts operational party balances; labor-leg matching is exact rather than a loose substring.
- Generic labor advances now have source `leg_index` keys and PostgreSQL unique indexes; ledger backfill has a versioned migration and duplicate preflight.
- Multi-leg postings without a caller session now use an internal MongoDB transaction, and replay checks compare more per-leg fields.

Material risks remain:

1. The posting barrier is an in-process map, is released before the transaction commits, and the close proceeds after a drain timeout. It does not fence all posting workers at commit.
2. The TDS positive allowlist omits account-type values used by the application, and free-text exemption query parameters authorize arbitrary rate overrides.
3. Reconciliation derives party balances from invoices without receipts/applications, derives bank totals from the GL itself, and can report a healthy category summary despite offsetting party-level warnings.
4. Labor idempotency keys still depend on newly generated voucher IDs for retries; settlement can leave an extra GL voucher when a concurrent request finds an existing PostgreSQL settlement.
5. PostgreSQL schema migration failures are logged and swallowed; adding the unique indexes can fail on old data, while initialization is marked complete.
6. Ledger migration preflight does not exactly model the unique index key, and MongoDB startup continues after migration failure.
7. Voucher replay still omits several payload fields and can return success to a caller whose transaction has been aborted.

## 2. Scope and method

Reviewed implementation changes in commit `74c422e` relative to `0a0e9a1`, plus adjacent code directly used by those changes. The audit was static and read-only; no application build, test suite, database query, migration, or financial-data repair was run.

Severity describes potential financial-integrity impact, not exploitability. Findings identify source behavior; deployment topology and representative operating data may affect impact. Each finding includes code locations that need updates.

## 3. Findings

### F-01 - Posting barrier does not fence transactions through commit
**Severity: Critical**

`acquirePostingBarrier()` registers tickets in a module-local `Map`; `drainInFlightPostings()` observes only that process and returns after five seconds even when tickets remain ([ticket registry and drain](../server/utils/accounting/period-lock.service.ts#L71-L165), [close drain call](../server/utils/accounting/fiscal-year-closing.service.ts#L239-L268)). `verifyPostingBarrier()` is a fresh lock read immediately before `insertMany`, not a commit-time fence ([verification and insert](../server/utils/accounting/unified-posting.service.ts#L194-L205)).

The ticket is released in `postVoucher()`'s `finally` block when the service returns ([release](../server/utils/accounting/unified-posting.service.ts#L309-L313)). With a caller-managed session, the caller commits after that return. Even the new internally managed multi-leg path recursively calls `postVoucher()`, whose ticket is released before the outer wrapper commits ([internal transaction wrapper](../server/utils/accounting/unified-posting.service.ts#L69-L83)). Thus the close may see the ticket as drained and take its snapshot before the posting commits. A close on one server instance also cannot see tickets registered on another instance. There remains a race between the fresh pre-write check and the ledger insert/commit. The warning after a drain timeout says fencing will block writers at commit, but no such commit-time check is implemented.

Lease renewal is performed at the start and near finalization, not periodically. A long close can be reclaimed and then abort at its next renewal; this is safer than stale finalization but can cause avoidable failed closes.

**Code to update:** Replace the process-local map with a distributed writer barrier or database-level serialization that remains held until transaction commit/abort. Do not proceed with the snapshot after a drain timeout; recheck/fence writers atomically at commit, and make the lease heartbeat continuous or otherwise guarantee the lease cannot expire mid-close. Update [period-lock.service.ts](../server/utils/accounting/period-lock.service.ts#L71-L165), [unified-posting.service.ts](../server/utils/accounting/unified-posting.service.ts#L69-L83), [unified-posting.service.ts](../server/utils/accounting/unified-posting.service.ts#L194-L205), and [fiscal-year-closing.service.ts](../server/utils/accounting/fiscal-year-closing.service.ts#L239-L268).

### F-02 - Non-transactional bill-cancellation fallback is resolved
**Status: Resolved in the inspected path**

Unsupported MongoDB transactions now fail closed rather than retrying cancellation without a session, and stock reversal failures propagate so the transaction can abort ([bill cancellation](../server/api/accounting/bills/[id]/cancel.post.ts#L150-L190)). Keep this requirement and verify through integration tests that every bill, ledger, stock, and stock-register write uses the same session.

### F-03 - Free-text exemption inputs can authorize arbitrary TDS rate overrides
**Severity: High**

The rate validation now enforces 20% for invalid/missing PAN and the standard PAN-derived 1%/2% rates. However, `hasExemption` is true if any request query field `exemptionCertificateNo`, `exemptionReason`, or `certificateNumber` is nonempty; when true, the endpoint accepts any parsed rate from 0% to 20% ([override validation](../server/api/accounting/tds/threshold-check.get.ts#L280-L304)). The endpoint does not verify a certificate, issuer, effective period, permitted rate, or user authorization. A caller can therefore provide arbitrary text and request a lower or zero rate for a valid-PAN deductee.

**Code to update:** Resolve exemptions from a firm-scoped, authorized, persisted certificate record and validate its effective dates and rate; do not treat free-text query parameters as proof. Keep the 206AA path non-overridable. Update [threshold-check.get.ts](../server/api/accounting/tds/threshold-check.get.ts#L280-L304) and the request parsing at [threshold-check.get.ts](../server/api/accounting/tds/threshold-check.get.ts#L45-L55).

### F-04 - TDS eligible-payment allowlist omits real ledger account types
**Severity: High**

The positive `accountType` filter uses `DIRECT_EXPENSES`, `INDIRECT_EXPENSES`, and `COST_OF_GOODS_SOLD` ([YTD filter](../server/api/accounting/tds/threshold-check.get.ts#L128-L145)). The repository's canonical and active account types include `DIRECT_EXPENSE`, `INDIRECT_EXPENSE`, and `COGS`; the subcontractor payout itself posts its expense as `DIRECT_EXPENSE` ([account types](../server/types/accounting.ts#L195-L230), [payout leg](../server/api/accounting/subcontractor-payout.post.ts#L138-L148)). The YTD query therefore omits those debits. It also excludes `SUNDRY_CREDITORS`/`CREDITOR`, which can be the party-tagged debit account for supplier payments, even though the endpoint describes the history as prior payments. This can understate prior YTD and threshold crossings.

The new tax-base allocation prevents one candidate leg's base from being counted repeatedly, and statutory tags are now scoped to tax-liability legs. Remaining concerns: legacy candidates with `statutory.isTds: true` and a null section are still admitted; a generic "TDS Payable" account without section metadata can be attributed to 194C; and the fallback `creditAmount * 100` assumes every untagged TDS credit was withheld at 1% ([candidate and base logic](../server/api/accounting/tds/threshold-check.get.ts#L151-L224)). A 2% or 20% legacy withholding can consequently overstate the already-taxed base. Matching is still by voucher group rather than a source transaction identifier.

**Code to update:** Use the application's actual account-type constants and explicitly define which invoice/payment events count toward the threshold. Include payable debits when they represent qualifying payments, while excluding unrelated expense rows. Require an exact section/source mapping for legacy tax legs; if their rate/base is unknown, report history as incomplete rather than assuming 1%. Update [threshold-check.get.ts](../server/api/accounting/tds/threshold-check.get.ts#L128-L224), with the canonical types in [accounting.ts](../server/types/accounting.ts#L195-L230) as the source of allowed values.

### F-05 - Operational reconciliation is still incomplete and category status can mask party differences
**Severity: High**

Labor's new balance is `max(0, total advances - settled advances)`. It omits wages, expenses, settlement liabilities, and adjustments even though the GL `LABOR_LEADER` balance includes settlement wage/expense credits and payouts. The clamp also hides cases where settled advances exceed recorded advances ([labor operational total](../server/utils/accounting/sl-gl-reconciler.service.ts#L182-L224), [labor GL scope](../server/utils/accounting/sl-gl-reconciler.service.ts#L120-L158)).

The AR/AP operational map now adds opening balances and active bills, but it does not subtract receipts, supplier payments, applications, or other settlement allocations. The per-party mismatch is only a `WARNING`; these mismatches are not included in the category `totalVariance`. Offsetting per-party differences can therefore leave the category summary status `HEALTHY` while individual party mismatches exist ([party operational map and comparisons](../server/utils/accounting/sl-gl-reconciler.service.ts#L447-L541), [category status calculation](../server/utils/accounting/sl-gl-reconciler.service.ts#L650-L672)). The bank "SL" total still sums the GL balances for registered bank accounts; it is not derived from independent bank records/statements ([bank total](../server/utils/accounting/sl-gl-reconciler.service.ts#L728-L782)).

**Code to update:** Reconcile labor using complete wage/expense/advance/settlement state; compute AR/AP outstanding balances after receipts and applications; include the sum of absolute per-party variances in category severity; and use independent bank statement/register balances rather than copying GL. Update [sl-gl-reconciler.service.ts](../server/utils/accounting/sl-gl-reconciler.service.ts#L182-L224), [sl-gl-reconciler.service.ts](../server/utils/accounting/sl-gl-reconciler.service.ts#L447-L541), [sl-gl-reconciler.service.ts](../server/utils/accounting/sl-gl-reconciler.service.ts#L650-L672), and [sl-gl-reconciler.service.ts](../server/utils/accounting/sl-gl-reconciler.service.ts#L728-L782).

### F-06 - Labor retry keys are not stable across requests; schema-index failures are swallowed
**Severity: Critical**

The generic voucher path now keys advances by `firm_id`, `period_id`, `voucherGroupId`, and `leg_index`, and checks amount equality ([generic labor sync](../server/api/accounting/vouchers.post.ts#L132-L194)). The unique index is a useful safeguard, but a normal HTTP retry generates a new voucher group because this route does not supply a stable source idempotency key. The dedicated advance path has the same issue: `advance.post.ts` calls `postLaborAdvance()` before its PostgreSQL lookup, and that helper calls `UnifiedPostingService.postVoucher()` without an external source group ([advance API](../server/api/labor/payments/advance.post.ts#L42-L88), [helper posting](../server/utils/labor-ledger-helper.ts#L39-L170)). Each retry can therefore create a new GL voucher and a new PostgreSQL row despite the existence check.

Settlement has a similar race. The helper posts a new GL voucher before the PostgreSQL check; if a concurrent request has already committed the settlement by the time this request's `SELECT period_id` runs, the endpoint returns the existing row when `paid_amount` matches but does not reverse the newly posted voucher ([settlement posting and existing-row branch](../server/api/labor/payments/settle.post.ts#L32-L108)).

Schema changes add `leg_index` with default zero to existing rows and then create unique indexes ([schema migration](../server/utils/pg-labor-schema.ts#L120-L154)). Existing duplicate advance rows can all receive `leg_index = 0`, causing index creation to fail; duplicate settlement periods can likewise block the settlement index. The initializer catches and logs DDL errors, and PostgreSQL marks tables initialized before its asynchronous `Promise.all` completes ([schema initializer](../server/utils/pg-labor-schema.ts#L149-L155), [connection initialization](../server/utils/pg.config.ts#L33-L43)). The application can continue with missing uniqueness guarantees and will not retry initialization during that process.

**Code to update:** Establish a stable request/source-line key before posting to MongoDB, and reuse it across retries. If an existing settlement is found after a new GL voucher was posted, explicitly resolve/void that voucher or move idempotency before posting. Preflight and repair legacy duplicate rows before adding unique indexes, and make schema initialization failure visible to readiness/retry logic. Update [advance.post.ts](../server/api/labor/payments/advance.post.ts#L42-L101), [labor-ledger-helper.ts](../server/utils/labor-ledger-helper.ts#L39-L170), [settle.post.ts](../server/api/labor/payments/settle.post.ts#L32-L108), [pg-labor-schema.ts](../server/utils/pg-labor-schema.ts#L120-L155), and [pg.config.ts](../server/utils/pg.config.ts#L33-L43).

### F-07 - Ledger migration preflight does not exactly match the index and failure does not block readiness
**Severity: High**

The versioned migration preflights duplicate keys by grouping `firmId: {$ifNull: ['$firmId', '$firm_id']}` and `legIndex: {$ifNull: ['$legIndex', 0]}` ([preflight](../server/utils/migrations/ledger-isreversed-migration.ts#L44-L68)). The actual unique index keys on `firmId` only ([index](../server/models/Ledger.ts#L184-L189)). For legacy documents with no `firmId` but different `firm_id` values, preflight groups them separately while the index sees `firmId: null` for both; a collision can be missed. The migration does not backfill/normalize `firmId` before applying `isReversed: false` or verify that the expected unique index is present before recording `COMPLETED`.

The MongoDB plugin catches migration errors, logs them, and still returns a successful connection ([startup handling](../server/plugins/mongodb.ts#L53-L68)). A blocked/failed migration can therefore leave the app serving with legacy rows outside the partial unique index and without a readiness failure.

**Code to update:** Make preflight group by the exact unique-index key after normalizing `firmId`, backfill both firm aliases consistently, verify the index definition/state, and gate readiness on migration completion or an explicit safe compatibility mode. Update [ledger-isreversed-migration.ts](../server/utils/migrations/ledger-isreversed-migration.ts#L44-L130), [mongodb.ts](../server/plugins/mongodb.ts#L53-L68), and [Ledger.ts](../server/models/Ledger.ts#L184-L189).

### F-08 - Voucher replay identity and caller transaction outcome remain incomplete
**Severity: High**

The replay handler now checks leg count, account head/type, amounts, party/bank IDs, and presence plus section/PAN of statutory metadata ([replay comparison](../server/utils/accounting/unified-posting.service.ts#L204-L310)). It still does not compare transaction date, voucher type, narration, reference IDs, stock IDs, payment mode, wage/master-roll flags, or full statutory fields such as rate, TDS amount, taxable base, deductee ID/name, and exemption details. Same-group payloads can differ in those fields and still be returned as idempotent success.

When a duplicate-key error occurs in a caller-supplied transaction, the handler reads existing entries outside that session and may return success even though the caller's transaction is aborted; the caller can then fail at commit. The new internal transaction covers multi-leg calls without a session, but not all externally managed transaction paths ([transaction wrapper](../server/utils/accounting/unified-posting.service.ts#L62-L83), [duplicate/replay path](../server/utils/accounting/unified-posting.service.ts#L204-L310)).

**Code to update:** Compare every persisted field that affects accounting identity, or compare a canonical payload hash. Define an explicit duplicate result contract for caller-managed sessions; an aborted transaction must not be reported as a successful posting. Update [unified-posting.service.ts](../server/utils/accounting/unified-posting.service.ts#L62-L83) and [unified-posting.service.ts](../server/utils/accounting/unified-posting.service.ts#L204-L310).

## 4. Prior finding disposition

| Prior finding | Current status |
|---|---|
| Close allowed stale close workers to finalize or clear a newer lock | **Partially resolved.** Monotonic `fenceNumber`, lease checkpoints, and ownership checks were added; the new local barrier is released before transaction commit and is not distributed (F-01). |
| Bill cancellation retried without a transaction | **Resolved in inspected path.** Unsupported transactions fail closed (F-02). |
| Cross-firm Party lookup and unresolved labor leader handling in TDS | **Resolved in inspected path.** Party lookups are firm-scoped and leader resolution fails closed. |
| TDS custom rates could override PAN defaults | **Partially resolved.** PAN rules are enforced unless any free-text exemption query value is supplied (F-03). |
| TDS history could use wrong account types or duplicate a tax base | **Partially resolved, with allowlist regression.** Base allocation and tag scoping improved, but real account types are omitted and legacy rate fallback remains unsafe (F-04). |
| Reconciliation relied on GL totals | **Partially addressed.** Operational records are queried, but source balances omit key applications/settlements and bank totals remain GL-derived (F-05). |
| PostgreSQL labor idempotency was weak | **Partially addressed.** Source-line indexes and unique constraints were added, but retries lack stable request keys and schema failures are swallowed (F-06). |
| Ledger effective-row migration was unversioned | **Partially resolved.** Migration and duplicate preflight exist; preflight key mismatch and non-blocking startup remain (F-07). |
| Voucher replay compared only aggregate totals | **Partially resolved.** More leg fields are compared, but several accounting identity fields and caller transaction outcomes remain unchecked (F-08). |

## 5. Remediation order

1. **Make posting barriers distributed and commit-safe.** Hold tickets through actual transaction completion; close must fail or wait if the barrier cannot drain.
2. **Correct TDS rate authorization and eligible account types.** Remove free-text exemption authorization and align the allowlist to canonical ledger types.
3. **Finish source-level TDS mapping.** Require exact section/source links and remove assumed-rate legacy base calculations.
4. **Complete independent reconciliation.** Include receipts/applications, labor settlement balances, per-party variance severity, and independent bank statements.
5. **Use stable idempotency before cross-store writes.** Prevent duplicate GL/PG effects for retries and concurrent labor operations.
6. **Gate schema and ledger migrations.** Preflight exact index keys, repair duplicates, verify indexes, and fail readiness when migration is blocked.
7. **Complete replay equivalence and transaction handling.** Compare full accounting payloads and do not return success for an aborted caller transaction.

## 6. Minimum acceptance tests

- Hold a caller-managed posting transaction after `postVoucher()` returns but before commit; start close on the same and a different server instance; verify close waits or aborts and cannot snapshot before the posting outcome is known. Force a drain timeout and confirm close does not proceed.
- Run a close longer than its lease; verify heartbeat renewal maintains ownership and a reclaimed worker cannot commit.
- Request a nonstandard/zero TDS rate with only an arbitrary `exemptionReason` or certificate string; verify rejection absent a valid firm-scoped certificate.
- Seed prior debits using `DIRECT_EXPENSE`, `INDIRECT_EXPENSE`, `COGS`, and `SUNDRY_CREDITORS`; verify eligible 194C payments are included while unrelated rows are excluded.
- Test legacy TDS credits with unknown rates, missing section metadata, and mixed-source voucher groups; verify they are not silently treated as 1% Section 194C.
- Reconcile invoices with partial/full receipts, supplier payments, labor wages/expenses/advances/settlements, offsetting party variances, and bank statement differences; verify category and overall statuses expose each mismatch.
- Retry an advance request after a successful MongoDB+PostgreSQL commit and race two settlement requests; verify only one active GL voucher and one matching operational row remain.
- Start the PostgreSQL initializer with duplicate legacy advance/settlement rows; verify it preflights, reports, and blocks readiness rather than marking tables initialized.
- Test legacy ledger rows with missing `firmId` but `firm_id` populated across firms and colliding voucher/leg IDs; verify migration preflight matches the real index.
- Replay a voucher with changed dates, references, stock/payment fields, or statutory rates/amounts. Trigger a duplicate inside a caller-managed transaction and verify the API does not return success for an aborted transaction.

## 7. Final status

Commit `74c422e` addresses important gaps in close ownership, TDS tagging, ledger migration, replay comparison, and independent-source reconciliation. The implemented posting barrier still does not protect the commit boundary; TDS inputs/history remain inconsistent with real account types and exemption verification; reconciliation balances omit operational movements; and labor retries/schema startup can still produce duplicate or unmatched records. **F-01 and F-03 through F-08 remain open and should be covered by integration tests before the system is treated as an authoritative consolidated ledger.**
