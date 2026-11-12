# Unified Accounting System — Deep Logic & Integration Audit

**Audit date:** 2026-11-12  
**Audit type:** Static source-code review; no production database, credentials, or live financial data accessed  
**Overall assessment:** **High risk — central posting exists, but end-to-end accounting is not yet a reliably unified, auditable financial system.**

> This is a code-level audit, not an accounting opinion, statutory compliance certification, or confirmation of live-data balances. Findings describe observable implementation and should be validated against deployment configuration and representative test data before financial changes are made.

## 1. Executive conclusion

The repository has a genuine central MongoDB posting engine: `UnifiedPostingService.postVoucher()` resolves accounts, checks double-entry totals, allocates a voucher number, and inserts ledger legs. Commercial billing, manual vouchers, wages, employee advances, labor, site-imprest approvals, subcontractor payouts, inventory postings, opening balances, and year-end entries have paths that reach it.

However, the central engine is not an enforced system boundary. The service accepts optional sessions, some endpoints retry outside a transaction, and operational modules use compensating hard deletes. More importantly, ledger reports do not consistently exclude rows marked reversed; the labor compensation path deletes by voucher ID without firm scope; the reconciliation report mostly compares the GL to itself; and labor-leader/employee dimensions are not preserved uniformly. The offline application also contains a separate SQLite posting implementation.

**Practical consequence:** a voucher can be balanced at creation while balances, audit history, tenant isolation, operational records, and statutory reports still diverge. The “one source of truth / zero reconciliation drift / atomic write” design statements are not fully guaranteed by the current runtime code.

## 2. Scope and method

Reviewed the MongoDB posting engine, ledger and COA models, accounting types, ledger/reporting services, posting adapters, reversal/update paths, accounting APIs, employee wages and advances, PostgreSQL labor, inventory/billing flows, opening/year-end services, reconciliation code, and the offline accounting implementation. Paths below link to the inspected implementation rather than relying on architecture prose.

The review was read-only. No migration, financial repair, live query, build, or test run was performed. Prior audit/design documents under `docs/JUNK/` were treated as historical/specification material, not proof that the described controls exist in current runtime code.

## 3. Accounting concept and actual data flow

The intended model is a shared General Ledger with double-entry vouchers, Chart of Accounts heads, and dimensions such as party, bank, stock, employee, and labor leader. The core contract is defined in [accounting types](../server/types/accounting.ts#L1-L160), while ledger persistence is defined in [Ledger](../server/models/Ledger.ts#L1-L150) and COA persistence in [ChartOfAccounts](../server/models/ChartOfAccounts.ts#L1-L166).

The primary runtime flow is:

1. A business module calculates document amounts and builds legs.
2. A legacy adapter or module helper calls `UnifiedPostingService.postVoucher()`.
3. The service resolves the account head from the firm's COA, validates some dimensions, checks debit/credit totals in paise, and writes ledger documents.
4. Reporting, statements, statutory exports, and reconciliation read the ledger and/or operational stores.

The single-entry architecture is partial: adapters preserve legacy voucher IDs/numbers, data writes are not always in one transaction, and there are other ledger mutations/deletions and a second offline engine.

### Module integration map

| Business area | Observed integration | Audit notes |
|---|---|---|
| Sales, purchases, service invoices, returns, delivery/proforma conversion | `LedgerService` builds legs and delegates through the unified service; representative paths include [sales posting](../server/api/accounting/sales.post.ts#L1-L210), [purchase posting](../server/api/accounting/purchases.post.ts#L1-L220), and [ledger adapter](../server/utils/accounting/ledger.service.ts#L35-L82). | Bill, stock, and GL changes must share a transaction; update/cancel paths have distinct history semantics. |
| Daybook and manual vouchers | API converts UI entries into legs and calls unified posting in [voucher post](../server/api/accounting/vouchers.post.ts#L1-L115); daybook also routes sales through `LedgerService`. | Standalone retry and best-effort PostgreSQL side-sync weaken atomicity. |
| Inventory | Purchase/sales ledger legs include Inventory/COGS, while stock movements are updated by stock services; see [ledger posting logic](../server/utils/accounting/ledger.service.ts#L155-L283) and [stock service](../server/utils/inventory/stock.service.ts). | The operational stock movement and GL entry need a shared transaction and idempotent document reference. |
| Master-roll wages and employee advances | Accrual and payout paths call unified posting in [wage ledger helper](../server/utils/wages-ledger-helper.ts#L357-L506); employee advances use [advance ledger helper](../server/utils/advance-ledger-helper.ts#L1-L120). | Accrual and disbursement are separate, which is conceptually sound, but reversal dimension/report handling is incomplete. |
| Gang labor (PostgreSQL operational DB + MongoDB GL) | Advance and settlement APIs post MongoDB vouchers, then write PostgreSQL rows in [labor advance API](../server/api/labor/payments/advance.post.ts#L1-L110) and [labor settlement API](../server/api/labor/payments/settle.post.ts#L1-L130). | These are cross-database workflows, not a single atomic transaction. Compensation currently hard-deletes ledger rows. |
| Bulk payments, subcontractor payouts, imprest approvals | These call unified posting; see [bulk payment](../server/api/accounting/bulk-payments/index.post.ts#L1-L160), [subcontractor payout](../server/api/accounting/subcontractor-payout.post.ts#L1-L220), and [imprest approval](../server/api/accounting/imprest-approvals/approve.post.ts#L1-L150). | Session/fallback and idempotency behavior differs by endpoint. |
| Opening balances and year-end | Opening balances post through unified service, while replacement logic deletes earlier opening-balance ledger rows in [opening balance service](../server/utils/accounting/opening-balance.service.ts#L1-L160). Year-end posts closing/opening entries through the service in [fiscal close service](../server/utils/accounting/fiscal-year-closing.service.ts#L1-L220). | Review classification authority, close-lock lifecycle, and re-run semantics before relying on close output. |
| Work-tracker wallets and offline app | Work-tracker wallet transactions are read from Firebase-scoped collections in [wallet transactions API](../server/api/work-tracker/wallets/%5Bid%5D/transactions.get.ts#L1-L140); offline accounting has its own SQLite engine in [offline unified posting](../offline-app/js/service/accounting/unifiedPostingService.js#L1-L350). | These are not shown to be projections of the MongoDB GL. Treat them as separate accounting-like stores unless a verified sync/reconciliation process exists. |

## 4. Prioritized findings

Severity uses **Critical / High / Medium** to describe potential financial-integrity impact, not exploitability.

### A-01 — Reversed/replaced ledger rows remain in key financial reports
**Severity: Critical**

`reverseVoucher()` marks original legs as `isReversed: true`, and `updateVoucher()` marks the old legs reversed before inserting replacement legs. But key reporting queries do not filter `isReversed`: `getTrialBalance()` matches only `firmId` and date in [ledger service](../server/utils/accounting/ledger.service.ts#L627-L658); `getAccountBalance()` and `getLedger()` likewise omit the reversal predicate in [balance and statement logic](../server/utils/accounting/ledger.service.ts#L600-L626) and [ledger statement logic](../server/utils/accounting/ledger.service.ts#L680-L760). For an edited voucher, old and replacement legs are both included, so the prior posting can remain additive instead of being replaced. A complete reversal pair may net to zero in account balances, but it still inflates debit/credit turnover and can make voucher summaries disagree. Other report paths may produce different results depending on whether they happen to filter the marker.

**Required:** define one canonical “effective ledger” predicate and apply it to all statements, trial balance, P&L, balance sheet, daybook summaries, TDS/GST reports, and reconciliation. Test cancel, reverse, edit, and re-post flows against account balances and trial-balance parity.

### A-02 — Cross-firm hard-delete risk in labor compensation
**Severity: Critical**

When PostgreSQL insert fails, both the labor advance and settlement endpoints execute `Ledger.deleteMany({ voucherGroupId })` without a firm condition: [advance compensation](../server/api/labor/payments/advance.post.ts#L82-L101) and [settlement compensation](../server/api/labor/payments/settle.post.ts#L88-L109). The unified voucher group format is based on voucher type, financial year, and per-firm sequence, not firm identity, in [voucher ID generation](../server/utils/accounting/unified-posting.service.ts#L89-L110). Therefore, firms can legitimately generate the same group ID; a compensation delete can remove another firm's ledger rows. It also erases rather than reverses the failed workflow's audit trail.

**Required:** stop using unscoped deletion immediately. Scope every lookup/mutation by both firm and voucher group, and replace compensation with a durable, idempotent saga/outbox or a firm-scoped reversal workflow. Never use a group ID alone as a cross-store identity.

### A-03 — “Atomic posting” is optional; standalone retry can duplicate or partially write
**Severity: Critical**

The posting service documents caller-managed transactions, but `session` is optional and `insertMany()` explicitly omits transaction options when absent in [postVoucher](../server/utils/accounting/unified-posting.service.ts#L55-L145). The manual voucher endpoint retries without a session for transaction/replica-set errors in [voucher post](../server/api/accounting/vouchers.post.ts#L55-L91); subcontractor payout has the same pattern in [payout transaction handling](../server/api/accounting/subcontractor-payout.post.ts#L168-L207). The service has no request idempotency key or duplicate external-reference guard. A commit/network error with an ambiguous outcome can therefore be retried as a second voucher; without a transaction, a multi-leg write is not guaranteed atomic. Gapless numbering is also only gapless if sequence increment and ledger insert participate in the same transaction.

**Required:** require a valid session for financial posts in production, remove automatic non-transactional retry, and use an idempotency key persisted under a unique `(firm, source system, source document, posting purpose)` constraint. Fail closed if transactions are unavailable.

### A-04 — Cross-database labor flow has a failure window and unsafe compensation
**Severity: High**

Labor posting commits its MongoDB transaction inside `laborLedgerHelper`, then the API writes to PostgreSQL. If the SQL write fails, it attempts a MongoDB hard delete; process termination between the two commits leaves a dangling GL entry, while compensation has the cross-firm risk above. The generic voucher API separately writes labor advance rows after GL success and catches synchronization errors, still returning success in [post-voucher side sync](../server/api/accounting/vouchers.post.ts#L105-L157). Thus a “success” response does not imply both stores agree.

**Required:** implement a durable saga/outbox with pending/posted/failed state, retries, firm-scoped references, and a reconciliation job that compares source IDs and voucher group IDs. Do not silently downgrade synchronization failures to warnings for financial records.

### A-05 — Reversal is not dimensionally faithful and is not race-safe
**Severity: High**

`reverseVoucher()` copies account head/type, party, bank, stock, and payment mode but does not carry `masterRollId`, structured `statutory` metadata, or the original `refId` into the reversal payload in [reversal construction](../server/utils/accounting/unified-posting.service.ts#L164-L239). Employee payroll/advance entries use voucher-level `masterRollId`; reversals therefore lose the employee dimension and can distort employee-advance reconciliation and statutory drill-down. The duplicate-reversal check is a read followed by a later write, not a conditional atomic claim; concurrent requests can both pass it. The original lookup also needs a documented rule for already-reversed/mixed legacy groups.

**Required:** preserve all audit dimensions and source lineage on reversals; atomically claim reversal with a conditional update/unique reversal reference inside a mandatory transaction; use explicit reversal voucher types/links.

### A-06 — Voucher leg validation does not enforce basic amount invariants
**Severity: High**

`resolveAndValidateLegs()` converts amounts to numbers and skips zero/zero legs, but does not reject negative, non-finite, or dual-sided legs in [leg validation](../server/utils/accounting/unified-posting.service.ts#L407-L527). Negative values can reverse accounting polarity implicitly; a single leg can carry both debit and credit; `toPaise()` converts invalid strings to zero in [paise helpers](../server/types/accounting.ts#L250-L290). The ledger schema accepts numeric amounts without domain validators in [Ledger model](../server/models/Ledger.ts#L35-L75). Also, transaction dates are not strictly validated at the central boundary; malformed date strings can fall back to the current FY for numbering in [FY resolver](../server/utils/accounting/unified-posting.service.ts#L684-L715).

**Required:** reject non-finite and negative amounts, require exactly one positive side per non-zero leg, validate `YYYY-MM-DD` as a real calendar date, normalize to integer paise before persistence, and validate voucher type/leg-count/account rules centrally.

### A-07 — Sub-ledger reconciliation is partly a self-comparison
**Severity: High**

The AR/AP reconciliation aggregates GL by party ID, then constructs its “SL total” by adding those same GL balances for IDs found in Party Master; the labor reconciliation similarly adds GL balances when an account-head name exists in COA/PostgreSQL. The bank check verifies that bank IDs exist but does not compare the GL balance to an independently sourced bank balance. See [party reconciliation](../server/utils/accounting/sl-gl-reconciler.service.ts#L203-L296), [labor reconciliation](../server/utils/accounting/sl-gl-reconciler.service.ts#L126-L202), and [bank reconciliation](../server/utils/accounting/sl-gl-reconciler.service.ts#L321-L389). These summaries can report zero variance by construction while missing balance drift. Employee advances are a more meaningful comparison against the Advance collection, but reversal and legacy-dimension rules still need validation in [advance reconciliation](../server/utils/accounting/sl-gl-reconciler.service.ts#L391-L535).

**Required:** compare independent sub-ledger totals and opening balances to control accounts; reconcile by dimensions and account type; report untagged and orphaned legs separately; include reversed-row policy and exact cutoff behavior.

### A-08 — Party/labor dimensions are inconsistent with the stated sub-ledger model
**Severity: High**

The type contract says `partyId` is required for debtor, creditor, and labor-leader accounts, but the runtime `PARTY_REQUIRED_ACCOUNT_TYPES` set includes only debtors and creditors in [accounting types](../server/types/accounting.ts#L225-L250). Labor helpers post `accountHead: leader_name` with `accountType: LABOR_LEADER` and omit `partyId` in [labor ledger helper](../server/utils/labor-ledger-helper.ts#L39-L180). This creates leader-name accounts rather than a stable party dimension and makes name changes/duplicates/legacy spellings affect statements and reconciliation.

**Required:** establish stable labor-leader IDs across PostgreSQL and MongoDB, require and validate the dimension at posting, preserve it in reversals, and document migration/dual-read behavior for historical name-based entries.

### A-09 — COA codes and classification do not implement a unique governed account catalogue
**Severity: High**

`ACCOUNT_CODE_MAP` maps by broad `accountType`, not account identity: for example, multiple expense heads map to `5200` and generic asset heads to `1500`; see [account-code map](../server/types/accounting.ts#L290-L355). `resolveAccountInCOA()` auto-creates missing heads during posting and uses that broad type-derived code in [COA resolution](../server/utils/accounting/unified-posting.service.ts#L529-L619). No uniqueness constraint is defined for `(firm, account_code)` in the COA schema; only name uniqueness is enforced in [COA indexes](../server/models/ChartOfAccounts.ts#L130-L166). Consequently `account_code` is not a unique account key and uncontrolled head creation can fragment reporting.

The model also stores `bs_classification`, but year-end classification uses `classifyAccountType(accountType)` rather than the stored COA classification in [fiscal close preview](../server/utils/accounting/fiscal-year-closing.service.ts#L92-L143) and [classification function](../server/types/accounting.ts#L195-L250). The system therefore has two possible classification authorities.

**Required:** distinguish account code from control-account/group code, model parent/control accounts explicitly, enforce code uniqueness where intended, govern COA creation, and choose one authoritative P&L/BS classification source.

### A-10 — Legacy firm identity fields are read inconsistently
**Severity: High**

New ledger documents mirror both `firmId` and `firm_id` in [posting persistence](../server/utils/accounting/unified-posting.service.ts#L112-L145), and the schema permits both in [Ledger model](../server/models/Ledger.ts#L1-L35). But core report queries, including `getTrialBalance()` and `getLedger()`, filter only on `firmId`; the general ledger list API also filters only on `firmId` in [ledger API](../server/api/accounting/ledger.get.ts#L1-L53). Historical records stored only with `firm_id` can be omitted from balances/statements, while other services use `$or` across both. The resulting reports are not guaranteed to agree.

**Required:** migrate/normalize firm identity, then use one canonical field; until migration completes, use a shared tenant-scope query helper in every read and write path.

### A-11 — External voucher IDs bypass centralized numbering and duplicate protection
**Severity: Medium–High**

The posting service accepts caller-provided `externalVoucherGroupId` and `externalVoucherNo` when both are present, without checking whether that ID already exists for the firm or whether the existing voucher matches the same source document in [external number handling](../server/utils/accounting/unified-posting.service.ts#L89-L110). `LedgerService.executeUnifiedPost()` uses that path for legacy bill IDs/numbers in [legacy adapter](../server/utils/accounting/ledger.service.ts#L35-L82). This compatibility path means the sequence service is not the authoritative numbering source for every voucher, and retries can add another set of legs with reused IDs.

**Required:** separate source document number from GL voucher number, enforce firm-scoped uniqueness for voucher identity, and make posting idempotent on a source-document key. Retain the legacy path only behind explicit migration compatibility rules.

### A-12 — Opening-balance replacement physically deletes prior GL history
**Severity: High**

`syncOpeningBalance()` deletes existing OPENING_BALANCE ledger rows before posting the replacement in [opening-balance service](../server/utils/accounting/opening-balance.service.ts#L76-L151). The operation may be transactional when a caller supplies a session, but the public service permits no session and the prior entry is not retained as a reversal. Zeroing an opening balance updates the operational OpeningBalance record but does not create an auditable correcting voucher in the shown branch.

**Required:** make opening balances append-only corrections (reverse/repost), require a transaction, and ensure the zero-amount path also records the accounting correction.

### A-13 — Offline accounting is a parallel engine, not proven parity with the central GL
**Severity: Medium–High, deployment dependent**

The offline app has a separate SQLite Chart of Accounts, voucher sequences, and ledger posting implementation in [offline unified posting](../offline-app/js/service/accounting/unifiedPostingService.js#L1-L350). Its source uses floating-point totals with one-paisa tolerance, inserts legs individually despite describing storage as atomic, and does not implement the Mongo service's firm-scoped party/bank validation or Mongo transaction model. No evidence was established in this audit that all offline postings are synchronized to the MongoDB ledger exactly once.

**Required:** document offline authority and sync contract; add outbox/sync IDs and reconciliation if offline financial posting is supported. Otherwise label it explicitly as a separate/local ledger and prevent users from treating its balances as consolidated ERP balances.

## 5. Controls that are present and worth preserving

- Central posting service is used by many core write paths, and its normal path performs COA lookup, account-type resolution, paise-based debit/credit parity, and a MongoDB insert through `insertMany()` in [unified posting](../server/utils/accounting/unified-posting.service.ts#L55-L145).
- Voucher sequence has a unique firm/type/FY compound index in [VoucherSequence](../server/models/VoucherSequence.ts#L1-L35), and counter increments use atomic `$inc` in [sequence generation](../server/utils/accounting/unified-posting.service.ts#L650-L683). This is a useful concurrency primitive when the sequence increment and ledger write share a transaction.
- Wage accounting separates wage accrual from actual payout in [wage posting](../server/utils/wages-ledger-helper.ts#L357-L506), which is a sound accrual-accounting concept.
- Bill update logic generally retains old ledger documents and marks them reversed instead of deleting them; this is a better audit-trail direction, but reports must consistently honor the marker.
- Period lock checks are centralized in [period-lock service](../server/utils/accounting/period-lock.service.ts#L1-L68); public API date validation and privileged bypass rules still need to be enforced consistently.

## 6. Remediation order

### Immediate — contain high-impact integrity risks
1. Remove all `Ledger.deleteMany()` compensation paths that are not firm-scoped; prohibit physical GL deletion in runtime APIs.
2. Add the common effective-ledger filter to every balance/report query and confirm reversed/replaced/cancelled voucher semantics.
3. Disable non-transactional retries for financial posts; make a transaction/session mandatory or fail the request.
4. Add stable source IDs and idempotency constraints before retrying or replaying any posting.
5. Add regression tests for cross-firm voucher-ID collisions and ensure no operation can mutate another firm's ledger.

### Next — restore dimensional and reconciliation integrity
6. Preserve employee, labor-leader, party, bank, stock, and statutory metadata on reversal/update; validate ownership and required dimensions.
7. Rebuild SL-GL reconciliation from independent source totals, including opening balances and operational sub-ledgers.
8. Normalize `firmId`/`firm_id` reads and writes; verify historical migration counts and parity.
9. Replace opening-balance hard replacement with reversal and repost within a required transaction.

### Then — govern accounting concepts and parallel stores
10. Formalize COA control accounts, account codes, subledger dimensions, and the authoritative BS/P&L classification field.
11. Review all invoice/credit-note/debit-note, stock movement, payroll, labor, TDS, and GST calculation mappings against worked business cases with finance owners.
12. Define the offline SQLite and Firebase wallet relationship to the consolidated GL; add sync/reconciliation or explicitly keep them outside the accounting boundary.

## 7. Minimum acceptance test matrix

Before declaring the accounting system unified, automated integration tests should cover:

- Balanced multi-leg voucher, unbalanced voucher, negative/NaN/infinite amount, both-sided leg, zero-only legs, and malformed/nonexistent dates.
- Concurrent posts for the same firm and for different firms; unique sequence and unique voucher identity under retries.
- Transaction abort at each write stage; no partial ledger, COA, stock, bill, wage, or operational record remains.
- Idempotent replay of the same source document; no duplicate voucher or repeated SQL/Firebase side effect.
- Reverse, edit, cancel, and re-post: original stays auditable; all balance reports agree; net balances change exactly once.
- Cross-firm attempts and identical generated group IDs: no read, update, reverse, or delete crosses firm scope.
- Employee/labor leader/customer/vendor/bank/stock dimension survives reversal and appears in subledger reports.
- Reconciliation detects deliberate independent source-vs-GL variances, untagged entries, orphan records, and opening-balance differences.
- FY close/reopen/failure/retry, P&L-to-reserves close, BS opening roll-forward, and date-lock enforcement.
- Offline-to-online synchronization (if supported): exactly-once posting and parity for every voucher and dimension.

## 8. Final status

The unified accounting engine is a promising shared posting layer, not yet a fully enforced accounting boundary. **The highest-priority blockers are report semantics for reversed rows, unscoped labor hard deletes, optional/non-atomic posting, and non-independent reconciliation.** Resolve these before relying on consolidated balances, statutory exports, or year-end close as authoritative.
