# Unified Accounting System — Deep Audit Follow-up

**Audit date:** 2026-11-13
**Audit type:** Read-only static code review
**Review baseline:** `e29e909` (`refactor: add core accounting services, ledger reconciliation, TDS engine, and offline architecture docs`)
**Overall assessment:** **High financial-integrity risk. Recent changes improve several controls, but the system is not yet a consistently authoritative, independently reconciled accounting boundary.**

> This is a source-code review, not an accounting opinion, statutory compliance certification, or confirmation of live balances. No production database, credentials, or financial data were accessed. Validate tax/accounting behavior with a qualified finance owner and representative test data before relying on reports or posting changes.

## 1. Executive conclusion

The latest changes address several specific issues from the prior [deep audit](./UNIFIED_ACCOUNTING_SYSTEM_DEEP_AUDIT.md): common ledger reads now exclude reversed rows, more endpoints read both firm identity fields, opening-balance replacement marks prior rows reversed instead of deleting them, labor compensation mutations are firm-scoped, and voucher legs now reject negative and dual-sided amounts.

Those changes do not yet establish consistent accounting semantics end to end. In particular:

1. `reverseVoucher()` creates a counter-voucher and then marks the original voucher reversed. The common effective-ledger reports exclude the original but include the counter-voucher, so account balances move by the counter-voucher amount instead of netting to zero.
2. Year-end opening-balance generation uses a separate aggregation that includes reversed rows and filters only by `firmId`; it can therefore disagree with the filtered trial balance used earlier in the same close.
3. New TDS reporting and threshold logic can include non-TDS tax liabilities, use future-in-FY ledger activity for a past payment, and lose payout rate/gross-up metadata.
4. The reconciliation service still derives party, labor, and bank “sub-ledger” totals from GL totals. Its new bill check detects missing voucher IDs, not amount or outstanding-balance differences.
5. Cross-database labor compensation remains a best-effort saga: the writes are not atomic, compensation can fail, and the response can claim reversal even when the update failed.

The system has valuable controls (double-entry parity in the posting service, firm-scoped account resolution, period locks, and improved amount validation), but consolidated balances, TDS reports, reconciliation status, and year-end carry-forward should not be treated as independently verified until the findings below are resolved.

## 2. Scope and method

Reviewed the latest commit's 18-file change set and the adjacent posting, reporting, reconciliation, TDS, year-end, labor-compensation, and ledger-model code paths. The review was read-only. No application build, test suite, database query, migration, or financial-data repair was run.

Severity describes potential financial-integrity impact, not exploitability. Findings identify observable code behavior; deployment configuration and representative operating data may affect impact.

## 3. Findings

### F-01 — Reversal postings are removed from the effective ledger together with their originals
**Severity: Critical**

`reverseVoucher()` posts a new voucher with the original debit/credit amounts flipped, then marks every original leg `isReversed: true` ([reversal implementation](../server/utils/accounting/unified-posting.service.ts#L195-L288)). Core account-balance and trial-balance reads now use `isReversed: { $ne: true }` ([effective-ledger reports](../server/utils/accounting/ledger.service.ts#L612-L667)).

Consequently, a debit of 100 and credit of 100 on the original are omitted, while the new credit of 100 and debit of 100 remain. The voucher group as a whole is not neutralized in account balances; it changes each affected account by the inverse of the original. Trial-balance debit/credit equality alone will not detect this because the counter-voucher is itself balanced.

**Required:** Choose and enforce one model: either keep both original and counter-voucher effective, or mark the original ineffective without posting a second counter-entry. Define separate state for “cancelled/voided” versus “reversed by a posted voucher,” then test account balances, trial balance, daybook, and account statements for reverse, cancel, edit, and re-post flows.

### F-02 — Year-end opening balances use a different ledger population and classification rule
**Severity: High**

The close preview and closing-entry construction use `LedgerService.getTrialBalance()`, which now filters reversed rows and resolves `bsClassification` from the COA ([trial-balance query](../server/utils/accounting/ledger.service.ts#L644-L684)). The subsequent opening-balance roll-forward instead aggregates `Ledger` directly using only `{ firmId, transactionDate: { $lte: fyEndDate } }`; it does not exclude reversed rows or include legacy `firm_id`-only rows. It then classifies each account with `classifyAccountType(accountType)` rather than the COA classification used earlier ([roll-forward](../server/utils/accounting/fiscal-year-closing.service.ts#L291-L314)).

This can carry a different balance into the next FY than the close used to calculate, and can include stale/replaced amounts or omit legacy-identity entries. It also leaves two competing account-classification authorities in the same close workflow.

**Required:** Build the carry-forward from the same canonical effective-ledger query and classification source as the close trial balance. Include a regression fixture with reversed rows, legacy firm identity, and a COA classification that differs from the account-type fallback.

### F-03 — Reconciliation still reports self-derived totals as sub-ledger totals
**Severity: High**

For registered parties, the service adds the GL net balance to `slGrandTotal`; it does not derive an AR/AP balance from an independent party sub-ledger ([party reconciliation](../server/utils/accounting/sl-gl-reconciler.service.ts#L289-L352)). Labor reconciliation similarly adds known leader GL balances to its purported sub-ledger total ([labor reconciliation](../server/utils/accounting/sl-gl-reconciler.service.ts#L140-L209)); bank reconciliation validates registered bank IDs but also adds the GL balance to both totals ([bank reconciliation](../server/utils/accounting/sl-gl-reconciler.service.ts#L433-L500)).

The latest bill check adds a useful missing-voucher signal, but only checks whether an active bill's `voucherId` appears among active ledger groups; it does not compare billed amounts, receipts/payments, credit/debit notes, or outstanding balances ([bill verification](../server/utils/accounting/sl-gl-reconciler.service.ts#L370-L418)). The reported AR/AP `slTotal` therefore remains GL-derived, and a present voucher ID is not proof of correct posting.

Additional edge cases in the new checks: the PostgreSQL labor-advance lookup has no `toDate` cutoff, and its missing-voucher variances are not included in the labor summary variance calculation ([labor advance check](../server/utils/accounting/sl-gl-reconciler.service.ts#L229-L272)).

**Required:** Reconcile to independent operational totals at the same cutoff, including opening balances and payment/application history. Compare amounts and dimensions, surface unavailable-source errors as an incomplete/failed reconciliation rather than a green result, and ensure every critical variance contributes consistently to its summary.

### F-04 — TDS register treats every credit to `DUTIES_AND_TAXES` as TDS
**Severity: High**

`isTdsLiabilityLeg()` returns true for any credit leg whose account type is `DUTIES_AND_TAXES` ([TDS leg classifier](../server/utils/accounting/tds-manager.service.ts#L73-L97)). The register query deliberately includes every such account type before applying that classifier ([candidate selection](../server/utils/accounting/tds-manager.service.ts#L187-L204)). GST, cess, or other tax-liability credits using the same account type can therefore be included as TDS amounts and appear in TDS totals even when the account name and voucher do not describe TDS.

**Required:** Identify TDS liabilities through explicit statutory metadata or a governed TDS control-account/section mapping. Do not treat the broad tax account type alone as proof that a credit is TDS. Add negative test cases for GST and other non-TDS tax liabilities.

### F-05 — TDS threshold check can use future activity and overstate previously taxed amounts
**Severity: High**

The threshold endpoint queries from FY start through FY end but does not cap `transactionDate` at the requested `paymentDate`; a threshold check for an earlier payment can therefore include later activity in that same FY. It also sums only positive debit legs, which is not a reliable general measure of amounts credited/paid to a deductee across purchase accruals and settlements ([threshold query and YTD total](../server/api/accounting/tds/threshold-check.get.ts#L27-L52)).

The new “already taxed” calculation marks an entire prior voucher's debit amount as taxed if that voucher contains any positive `DUTIES_AND_TAXES` credit. It does not match the TDS leg to the same deductee, section, or taxable base, and the broad account type can include non-TDS tax credits ([prior-tax calculation](../server/api/accounting/tds/threshold-check.get.ts#L54-L70)). This can suppress or distort catch-up calculations.

**Required:** Use an explicitly defined statutory trigger (credit/payment date), cap history at the evaluated date, key prior amounts and tax withheld by firm + deductee + section + source transaction, and validate the calculation against finance-approved 194C examples. Reject malformed payment dates and invalid numeric inputs instead of silently coercing them.

### F-06 — Subcontractor payout TDS metadata is not carried into the register contract
**Severity: High**

The payout endpoint stores `tdsRate`, `tdsMode`, and related values in `tags` ([payout payload](../server/api/accounting/subcontractor-payout.post.ts#L179-L195)), but `postVoucher()` persists selected tag fields such as wage metadata and `statutory`; it does not persist the generic tags object ([ledger construction](../server/utils/accounting/unified-posting.service.ts#L128-L151)). The TDS register reads the rate and gross-up status from `statutory` and falls back to the PAN-derived default rate when no statutory rate exists ([register calculation](../server/utils/accounting/tds-manager.service.ts#L299-L350), [rate fallback](../server/utils/accounting/tds-manager.service.ts#L405-L430)).

The payout narration says `Gross-Up`, while the fallback detector looks for `grossed-up`, `195a`, or `tds borne by company`; absent explicit metadata, a gross-up payout may be reported as a standard deduction. A caller-supplied rate may also be reported as the PAN default instead of the rate actually posted.

**Required:** Persist a typed statutory TDS snapshot on the relevant ledger legs (section, rate, gross-up flag, taxable base, deducted amount, deductee identity) and make the register consume that canonical data. Test custom rates, missing PAN, gross-up, and standard deduction end to end.

### F-07 — Cross-database compensation remains non-atomic and can report success-shaped recovery
**Severity: High**

Labor endpoints commit MongoDB ledger postings before writing PostgreSQL operational rows, then compensate by setting `isReversed` on the Mongo rows if PostgreSQL fails ([advance compensation](../server/api/labor/payments/advance.post.ts#L73-L115), [settlement compensation](../server/api/labor/payments/settle.post.ts#L78-L120)). The generic voucher path similarly runs a PostgreSQL synchronization after posting and marks the voucher reversed on failure ([voucher synchronization](../server/api/accounting/vouchers.post.ts#L153-L184)).

These are not distributed transactions or durable sagas. A process failure or ambiguous database response can leave the stores disagreeing. The generic voucher handler logs and suppresses compensation-update failure, then returns an error message claiming the voucher “was safely reversed”; the settlement handler also suppresses compensation errors. The service has no durable pending/synced/failed state or automated retry/reconciliation contract for these writes.

**Required:** Use a durable outbox/saga with idempotent source keys, explicit workflow state, retry, and reconciliation. Do not claim compensation succeeded unless it is confirmed; surface an incomplete state that can be repaired and audited.

### F-08 — External voucher duplicate guard is check-then-insert, not an idempotency constraint
**Severity: High**

For caller-supplied external voucher IDs, the posting service checks for an existing row and then inserts legs ([external ID guard](../server/utils/accounting/unified-posting.service.ts#L102-L126)). Two concurrent requests can both observe no row and both insert. The ledger model has non-unique indexes for voucher-group identifiers and no firm-scoped unique source/idempotency constraint ([ledger indexes](../server/models/Ledger.ts#L151-L159)). The session parameter to `postVoucher()` also remains optional ([posting API](../server/utils/accounting/unified-posting.service.ts#L55-L75)), so this guard does not make multi-leg writes atomic when a caller omits a transaction.

**Required:** Persist a unique `(firm, source system, source document, posting purpose)` idempotency key and make reservation plus all legs part of a required transaction. Ambiguous retries should return the already committed result, not insert again.

## 4. Prior-audit disposition

| Prior finding | Current status |
|---|---|
| A-01 Reversed rows in reporting | **Partially addressed, not resolved.** Key `LedgerService` reports now filter reversed rows, but `reverseVoucher()` marks the original reversed while posting its counter-entry (F-01), and year-end roll-forward still includes reversed rows (F-02). |
| A-02 Unscoped labor hard-delete | **Improved.** The inspected labor compensation updates now include firm scope and no longer hard-delete ledger rows. The cross-database recovery gap remains (F-07). |
| A-03 Optional transactions/retries | **Still open.** `postVoucher()` accepts no session; atomicity is not enforced at the service boundary (F-08). |
| A-04 Cross-database labor consistency | **Still open.** Compensation is best-effort rather than a durable saga (F-07). |
| A-05 Reversal dimension preservation | **Partially addressed.** Reversal legs now preserve more dimensions, including `masterRollId`, statutory data, and `refId`; reversal state/report semantics remain incorrect (F-01). |
| A-06 Basic leg amount invariants | **Improved.** Negative, non-finite, and dual-sided amounts are now rejected in the central leg resolver. |
| A-07 Sub-ledger reconciliation | **Partially addressed.** Missing bill-voucher checks and a labor advance presence check were added, but headline totals remain GL-derived and the new checks have cutoff/summary gaps (F-03). |
| A-09 COA classification authority | **Partially addressed.** Trial balance now exposes COA classification, but opening-balance roll-forward still classifies by account type (F-02). |
| A-11 External voucher IDs | **Partially addressed.** A duplicate check was added, but there is no atomic uniqueness/idempotency guarantee (F-08). |
| A-12 Opening-balance replacement deletion | **Improved.** The inspected replacement path marks previous opening entries reversed instead of physically deleting them. |

Other prior concerns around party/labor dimensions, code governance, and offline synchronization were not fully re-audited in this follow-up and should remain open unless separately verified.

## 5. Remediation order

1. **Correct reversal semantics** and add account-level tests that distinguish reversal from void/cancel.
2. **Make year-end carry-forward consistent** with the effective trial balance, firm identity policy, and authoritative COA classification.
3. **Correct TDS source identification, cutoff, deductee/section grouping, and metadata persistence** before treating the register or threshold endpoint as statutory output.
4. **Replace GL-to-GL reconciliation proxies** with independently calculated party, bank, labor, and bill balances; make incomplete data-source checks explicit.
5. **Replace best-effort dual-database compensation** with durable idempotent workflows and verified recovery status.
6. **Require transactional, idempotent posting** for production financial writes; add a unique firm-scoped source key and prevent duplicate group insertion under concurrency.

## 6. Minimum acceptance tests

- Post an original voucher, reverse it, and verify each account's net balance is unchanged while the original and reversal remain auditable.
- Edit, cancel, and re-post a voucher; assert all ledger views and summaries use the same effective population.
- Close a year containing reversed entries and legacy `firm_id`-only rows; verify next-year opening balances equal the approved closing balance by account and COA classification.
- Include GST/cess liabilities in a TDS register fixture and verify they do not count as TDS.
- Evaluate a TDS threshold on a date with later-dated entries already present in the FY; verify those entries are excluded. Test the same deductee across sections, partial TDS, and multiple vouchers.
- Post subcontractor payouts with an override rate and gross-up mode; verify the register reports the actual posted rate, section, tax amount, gross, net, and gross-up status.
- Simulate PostgreSQL failure, timeout-after-commit, process interruption, and compensation failure; verify durable state, retry behavior, and accurate user-visible recovery status.
- Submit concurrent requests with the same firm-scoped source key; verify exactly one voucher is committed and replay returns its result.
- Introduce independent party/bank/labor/bill variances and verify reconciliation detects amount differences, cutoff differences, orphan dimensions, and unavailable-source failures.

## 7. Final status

The latest changes improve the accounting foundation, but do not yet support an assurance that operational reports, TDS outputs, reversals, or year-end carry-forward are consistently correct. **F-01 through F-08 should be resolved and covered by integration tests before the system is treated as an authoritative consolidated ledger.**
