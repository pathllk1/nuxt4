# Accounting System Fix Plan and Task List

**Document Version:** 1.0.0  
**Audit Source Reference:** `docs/ACCOUNTING_SYSTEM_DEEP_CODE_AUDIT.md`  
**Verification Date:** 2026-11-20  
**Status:** Planning & Verification Complete (No application code modified)  
**Scope Note:** In accordance with user instructions, authentication system components (login, session lifecycles, JWT generation, cookie handling, device fingerprinting, and refresh token rotations) have been excluded from this remediation plan. Administrative role enforcement on accounting mutations (e.g. Year-End Close and Period Locks) is treated strictly as an accounting governance control.

---

## 1. Executive Summary & Codebase Verification

A comprehensive, read-only code verification was performed against the Nuxt 4 ERP repository to confirm the findings detailed in `docs/ACCOUNTING_SYSTEM_DEEP_CODE_AUDIT.md`. Every reported non-auth issue was inspected directly in the current source code using MCP tools.

### Verification Matrix

| Finding ID | Severity | Category | File Location | Code Status | Codebase Verification Summary |
|---|---|---|---|---|---|
| **ACCT-003** | **HIGH** | Accounting / Reversals | `server/api/accounting/bills/[id]/cancel.post.ts:48-88` | **CONFIRMED** | `Ledger.find({ refType: 'BILL', refId: bill._id })` fetches all entries, including already superseded `isReversed: true` entries from prior bill edits. Creating reversal legs for superseded entries introduces un-offset counter entries, corrupting ledger balances. |
| **ACCT-004** | **HIGH** | Accounting / Audit Trail | `server/api/accounting/vouchers/[voucherGroupId].delete.ts:85-106` | **CONFIRMED** | Voucher deletion performs an in-place `isReversed: true` flag update on ledger documents. It does not generate or post an explicit reversal counter-voucher (`REV-...`), violating statutory audit trail immutability standards. |
| **ACCT-005** | **HIGH** | Statutory / Tax | `server/api/accounting/gst/gstr1/report.get.ts:93-120` | **CONFIRMED** | Tables 4B (RCM), 5 (B2CL), 6 (Exports), 8 (Nil-rated), 9 (Amendments), and 12 (HSN summary) are hardcoded empty arrays `[]`. Report hardcodes `isValid: true` without performing actual GL reconciliation. |
| **ACCT-006** | **HIGH** | Statutory / Tax | `server/api/accounting/gst/gstr3b/report.get.ts:33-70` | **CONFIRMED** | All purchase taxes are aggregated as 100% eligible ITC without segregation of Ineligible ITC (Sec 17(5)) or Inward Reverse Charge (Table 3.1(d)). Tax liability uses naive subtraction (`sales - purchase`) instead of statutory CGST/SGST/IGST cross-utilization rules. |
| **ACCT-007** | **MEDIUM** | Numbering / Sequence | `server/utils/accounting/bill-utils.ts:7-14, 53-61`<br>`server/api/accounting/sales.post.ts:40-41`<br>`server/api/accounting/purchases.post.ts:48-49` | **CONFIRMED** | `getNextBillNumber` computes financial year using clock date `new Date()` rather than `meta.billDate`. Additionally, `BillSequence` does not partition sequence numbers by financial year, causing sequence drift for backdated entries. |
| **ACCT-008** | **HIGH** | Validation / Integrity | `server/api/accounting/accounting-sales.post.ts:11-20`<br>`server/api/accounting/accounting-purchases.post.ts:11-20`<br>`server/api/accounting/sales.post.ts:14-25` | **CONFIRMED** | Mutation routes perform only basic truthiness checks (`!cart?.length`). No Zod schema validation is applied; negative rates, malformed party IDs, invalid dates, and invalid tax rates can be written directly to the database. |
| **ACCT-009** | **MEDIUM** | Statutory / Export | `app/composables/useTdsManager.ts:135-155` | **CONFIRMED** | Excel export triggers direct `window.fetch()` with a manual `Authorization: Bearer <localStorage>` header, bypassing the central `useApi().download` helper and omitting session cookies and `x-firm-id` routing headers. |
| **ACCT-011** | **HIGH** | Distributed Transactions | `server/api/accounting/vouchers.post.ts:168-261`<br>`server/api/accounting/vouchers/[voucherGroupId].delete.ts:128-142` | **CONFIRMED** | Dual-database synchronization between MongoDB GL and PostgreSQL labor advances is non-atomic. MongoDB commits inside a Postgres transaction block; if the Postgres write or commit fails, MongoDB remains committed with no automated rollback mechanism. |
| **ACCT-012** | **MEDIUM** | Statutory / TDS | `server/utils/accounting/tds-manager.service.ts:241-252` | **CONFIRMED** | `getTdsRegister` explicitly filters out ledger records where `voucherGroupId` is missing, omitting legacy or migrated TDS ledger records that only possess `refId` or `voucherNo`. |
| **ACCT-013** | **HIGH** | Quality / Regression | `package.json:5-21` | **CONFIRMED** | No test runner (Vitest/Jest) or automated test specifications exist in the repository. Zero automated regression guards are in place for double-entry parity, idempotency, or ledger reporting. |
| **TX-FALLBACK** | **HIGH** | Database / ACID | `server/api/accounting/sales.post.ts:206-241`<br>`server/api/accounting/purchases.post.ts:210-244` | **CONFIRMED** | Routes catch MongoDB transaction session failures and re-execute non-transactionally. If a crash or error occurs mid-execution, partial writes (stock deducted without bill/ledger created) leave database corrupted. |
| **CODE-DUP** | **MEDIUM** | Maintainability | `app/composables/useBillingState.ts:116-345`<br>`app/composables/useAccountingInvoiceState.ts:82-290`<br>`server/utils/accounting/bill-utils.ts:120-175` | **CONFIRMED** | Bill total, tax split, and rounding algorithms are duplicated across frontend composables and backend services, creating divergence risks when rounding logic changes. |

---

## 2. In-Depth Root Cause & Verification Details

### 2.1 ACCT-003: Bill Cancellation Double-Reversal on Superseded Rows
- **Mechanism:** When a sales or purchase bill is edited (`sales/[id].put.ts:211-226`), the existing ledger entries are marked with `isReversed: true, replacesVoucherGroupId: ...` and new ledger entries are created.
- **Flaw in `cancel.post.ts`:**
  ```typescript
  const ledgerFindQuery = Ledger.find({
    $or: [{ firmId: firmIdObj }, { firm_id: firmIdObj }],
    refType: 'BILL',
    refId: bill._id
  });
  const originalEntries = await ledgerFindQuery.lean();
  ```
  `cancel.post.ts` retrieves **all** ledger rows matching `refId: bill._id`, including those already marked `isReversed: true`.
- **Consequence:** Reversal legs are generated and posted for **both** the active entries and the superseded entries. Because superseded entries were already excluded from effective balance calculations, generating active counter-entries for them introduces un-offset debits/credits into the General Ledger.

### 2.2 ACCT-004: Voucher Deletion Soft Flag vs. Accounting Counter-Entry
- **Mechanism:** In `vouchers/[voucherGroupId].delete.ts:85-106`, cancelling/deleting a voucher simply executes:
  ```typescript
  await Ledger.updateMany(
    { voucherGroupId: canonicalVoucherGroupId, isReversed: { $ne: true } },
    { $set: { isReversed: true, reversedAt: new Date(), reversedBy: ... } }
  );
  ```
- **Consequence:** In double-entry bookkeeping and statutory audit standards (Companies Act, MCA audit trail mandates), entries in posted journals must never disappear or be toggled off. A proper reversal requires posting a counter-voucher with inverted debits and credits referencing the original voucher group.

### 2.3 ACCT-007: Backdated Bill Numbering & Sequence Misalignment
- **Mechanism:** `bill-utils.ts:53-61` generates bill numbers using:
  ```typescript
  const fy = getCurrentFinancialYear(); // Derived strictly from new Date()
  const seq = await BillSequence.findOneAndUpdate(
    { firmId, btype: type.toUpperCase() },
    { $inc: { lastNo: 1 } },
    { returnDocument: 'after', upsert: true }
  );
  ```
- **Consequence:**
  1. If a user posts an invoice on April 2nd with `meta.billDate = "2025-03-25"` (FY 2024-25), the bill is assigned the new financial year prefix `SI/2025-26/0001`.
  2. The sequence is not partitioned by financial year (`btype` only, without `fy`), causing invoice numbers to run across fiscal year boundaries instead of resetting annually.

### 2.4 ACCT-011: MongoDB & PostgreSQL Non-Atomic Dual-Database Writes
- **Mechanism:** In `vouchers.post.ts:194-254`, labor advance posting attempts to wrap both databases:
  ```typescript
  await laborSql.begin(async (tx) => {
    // ... validation ...
    postResult = await postMongoVoucher(); // Mongo starts & COMMITS transaction
    // ... executes Postgres INSERT INTO labor_advances ...
  });
  ```
- **Consequence:** If the Postgres transaction aborts (due to constraint violations, network drop, or server restart) *after* `postMongoVoucher()` has committed, the MongoDB General Ledger contains the committed advance, but PostgreSQL has zero record of it. The system logs an error asking the user to manually retry with an idempotency key, creating a state of uncommitted distributed state divergence.

---

## 3. Remediation Strategy & Core Principles

1. **Strict Accounting Immutability:** Financial entries are never mutated or silently excluded. All cancellations and edits must post explicit, balanced counter-vouchers (`CANCEL-...` or `REV-...`).
2. **Fail-Closed Transaction Safety:** Eliminate non-transactional fallback retries in commercial and ledger mutations. When running on MongoDB, replica sets or unified transactions must be strictly enforced.
3. **Canonical Calculation Authority:** Financial arithmetic (item subtotals, GST state splits, discount chains, cess, and paise round-offs) must exist in exactly one authoritative server module (`server/utils/accounting/bill-utils.ts`).
4. **Statutory GSTR & TDS Alignment:** GST reports must dynamically segregate RCM, B2B, B2CL, and B2CS, and reconcile with General Ledger tax heads (`CGST Payable`, `SGST Payable`, `IGST Payable`, `ITC Eligible`).
5. **Two-Phase / Outbox Labor Reconciliation:** Labor advances must utilize a reliable reconciliation status or compensating rollback mechanism so that GL vouchers and labor advance rows cannot permanently diverge.

---

## 4. Phased Implementation Roadmap

```mermaid
flowchart TD
  subgraph Phase 1: Core Financial Integrity
    T1[Task 1.1: Fix Bill Cancellation Reversal]
    T2[Task 1.2: Implement Double-Entry Voucher Reversal]
    T3[Task 1.3: Eliminate Non-Transactional Fallbacks]
  end

  subgraph Phase 2: Statutory Compliance & Validation
    T4[Task 2.1: Fix Bill Numbering & FY Partitioning]
    T5[Task 2.2: Add Zod Schemas for Accounting Mutations]
    T6[Task 2.3: Rebuild GSTR-1 & Document Summaries]
    T7[Task 2.4: Fix GSTR-3B ITC & RCM Calculation]
    T8[Task 2.5: TDS Legacy Fallback & Secure Export]
  end

  subgraph Phase 3: Dual-Database Reliability
    T9[Task 3.1: Labor & GL Compensating Transaction Guard]
    T10[Task 3.2: Automated Cross-Database Reconciliation Script]
  end

  subgraph Phase 4: Code Consolidation
    T11[Task 4.1: Consolidate Shared Invoice & Tax Logic]
    T12[Task 4.2: Unify Frontend Composables]
    T13[Task 4.3: Dependency Cleanup PDF & Excel]
  end

  subgraph Phase 5: Automated Testing
    T14[Task 5.1: Vitest Accounting Test Suite]
    T15[Task 5.2: Invariant & Regression Tests]
  end

  Phase 1 --> Phase 2
  Phase 2 --> Phase 3
  Phase 3 --> Phase 4
  Phase 1 --> Phase 5
  Phase 2 --> Phase 5
```

---

## 5. Detailed Task List & Technical Specifications

### Phase 1: Critical Financial Integrity & Ledger Safety (P0)

#### [ ] TASK-ACT-01: Correct Bill Cancellation Ledger Reversal
- **Priority:** P0 (Highest)
- **Target File:** `server/api/accounting/bills/[id]/cancel.post.ts`
- **Issue Reference:** ACCT-003
- **Technical Specification:**
  1. Modify `Ledger.find` query to retrieve **only active, effective ledger entries**:
     ```typescript
     const originalEntries = await Ledger.find({
       $or: [{ firmId: firmIdObj }, { firm_id: firmIdObj }],
       refType: 'BILL',
       refId: bill._id,
       isReversed: { $ne: true }
     }).session(session).lean();
     ```
  2. Generate compensating counter-legs by swapping `debitAmount` and `creditAmount`.
  3. Post reversal voucher via `UnifiedPostingService.postVoucher` with `refType: 'BILL_CANCELLATION'`.
  4. After successful posting, update active original entries with `reversalVoucherGroupId`, `reversedAt: new Date()`, `reversedBy: user._id`.
  5. Ensure stock reversal logic remains atomic within the same Mongo session.
- **Acceptance Criteria:**
  - Cancelling an edited bill (which has historical superseded rows) reverses only the active legs.
  - Trial balance net change after cancellation equals exactly zero.
  - Superseded rows remain flagged as replaced, without duplicate counter-legs.

#### [ ] TASK-ACT-02: Implement Voucher Reversal Counter-Entry Architecture
- **Priority:** P0
- **Target File:** `server/api/accounting/vouchers/[voucherGroupId].delete.ts`
- **Issue Reference:** ACCT-004
- **Technical Specification:**
  1. Replace `executeDelete` (which currently only sets `isReversed: true`) with an explicit reversal voucher workflow.
  2. Query active legs: `isReversed: { $ne: true }`.
  3. Construct counter-legs with inverted debits/credits and updated narration (`REVERSAL OF VOUCHER ${canonicalVoucherGroupId}`).
  4. Post counter-legs through `UnifiedPostingService.postVoucher` with `voucherType: 'JOURNAL'`, `refType: 'VOUCHER_REVERSAL'`, and `externalVoucherGroupId: REV-${canonicalVoucherGroupId}`.
  5. Mark original entries with `isReversed: true, reversalVoucherGroupId: ...` only upon successful commit of the counter-voucher.
- **Acceptance Criteria:**
  - Cancelling/deleting a voucher produces an auditable counter-entry in the General Ledger.
  - GL audit views show both original and compensating reversal vouchers.
  - Trial balance remains balanced to the exact paise.

#### [ ] TASK-ACT-03: Eliminate Dangerous Non-Transactional Fallback Retries
- **Priority:** P0
- **Target Files:**
  - `server/api/accounting/sales.post.ts:223-240`
  - `server/api/accounting/purchases.post.ts:227-244`
  - `server/api/accounting/accounting-sales.post.ts:167-184`
  - `server/api/accounting/accounting-purchases.post.ts:173-190`
- **Issue Reference:** TX-FALLBACK
- **Technical Specification:**
  1. Remove fallback code blocks that retry `executeSave(undefined)` without a transaction when replica set / session errors occur.
  2. Implement fail-closed policy: If MongoDB transactions are unavailable or abort, throw a structured 500 error indicating replica set transactions are mandatory for multi-document accounting writes.
  3. Add clear diagnostic configuration error instructing administrators to enable replica sets (`--replSet rs0` or MongoDB Atlas).
- **Acceptance Criteria:**
  - Zero non-transactional partial writes can occur.
  - A failure during item stock deduction prevents bill creation and ledger entry creation completely.

---

### Phase 2: Statutory Compliance & Validation Integrity (P1)

#### [ ] TASK-ACT-04: Fix Bill Numbering FY Partitioning & Backdated Date Alignment
- **Priority:** P1
- **Target Files:**
  - `server/utils/accounting/bill-utils.ts`
  - `server/models/BillSequence.ts`
  - `server/api/accounting/sales.post.ts`
  - `server/api/accounting/purchases.post.ts`
  - `server/api/accounting/accounting-sales.post.ts`
  - `server/api/accounting/accounting-purchases.post.ts`
- **Issue Reference:** ACCT-007
- **Technical Specification:**
  1. Refactor `getCurrentFinancialYear(dateInput?: string | Date)` in `bill-utils.ts` to accept the actual bill date and compute the FY (`YYYY-YY`) based on that date.
  2. Update `getNextBillNumber(firmId, type, billDate)` to accept `billDate`.
  3. Update `BillSequence` model and queries to compound index `{ firmId: 1, btype: 1, financialYear: 1 }`.
  4. Ensure bill numbering resets annually per financial year and matches the transaction's fiscal year.
- **Acceptance Criteria:**
  - A bill dated `2025-03-20` generated today receives FY `2024-25` prefix.
  - Sequence numbers are isolated per financial year.

#### [ ] TASK-ACT-05: Implement Comprehensive Zod Request Validation
- **Priority:** P1
- **Target Files:**
  - `server/api/accounting/accounting-sales.post.ts`
  - `server/api/accounting/accounting-purchases.post.ts`
  - `server/api/accounting/sales.post.ts`
  - `server/api/accounting/purchases.post.ts`
  - `server/api/accounting/vouchers.post.ts`
  - New validation schema file: `server/utils/accounting/schemas/accounting-mutation.schema.ts`
- **Issue Reference:** ACCT-008
- **Technical Specification:**
  1. Define strict Zod schemas for:
     - `InvoiceItemSchema`: validates positive rates, positive quantities, valid HSN/SAC, valid GST rates (`0, 5, 12, 18, 28`).
     - `InvoiceMetaSchema`: validates ISO 8601 date, supply type, reverseCharge boolean, open period bounds.
     - `VoucherEntrySchema`: validates debit/credit amounts, accountHead, valid ObjectId strings.
  2. Integrate schema validation at the top of each event handler using `readValidatedBody` or `schema.parse(await readBody(event))`.
- **Acceptance Criteria:**
  - Invalid, negative, or malformed payloads return HTTP 400 with detailed validation issue paths.
  - Zero unvalidated data reaches Mongoose models.

#### [ ] TASK-ACT-06: Complete Statutory Tables and GL Reconciliation in GSTR-1
- **Priority:** P1
- **Target File:** `server/api/accounting/gst/gstr1/report.get.ts`
- **Issue Reference:** ACCT-005
- **Technical Specification:**
  1. Implement population for:
     - `table_4b_b2b_reverse_charge`: Filter sales bills where `reverseCharge === true`.
     - `table_5_b2cl_supplies`: Inter-state unregistered supplies with invoice value > ₹2,50,000.
     - `table_7_b2cs_supplies`: Intra-state unregistered + inter-state <= ₹2,50,000.
     - `table_12_hsn_b2b` & `table_12_hsn_b2c`: Aggregate line items by HSN code, UOM, total quantity, taxable value, and tax splits.
     - `table_13_document_summary`: Dynamically calculate total issued, cancelled, and net count.
  2. Query General Ledger output tax accounts (`OUTPUT CGST`, `OUTPUT SGST`, `OUTPUT IGST`) and append a `gl_reconciliation` comparison object in the response.
  3. Set `validation.isValid` conditionally based on whether document totals match line-item tax aggregates.
- **Acceptance Criteria:**
  - Table 4B and HSN Table 12 populate from actual bill items.
  - GSTR-1 report includes GL reconciliation metrics.

#### [ ] TASK-ACT-07: Overhaul GSTR-3B ITC Eligibility & Statutory Tax Netting
- **Priority:** P1
- **Target File:** `server/api/accounting/gst/gstr3b/report.get.ts`
- **Issue Reference:** ACCT-006
- **Technical Specification:**
  1. Segregate purchase bills:
     - Inward supplies liable to reverse charge (Table 3.1(d)).
     - Eligible ITC (Table 4(A)(5) - All other ITC).
     - Ineligible ITC under section 17(5) (identified by party/item classification).
  2. Implement statutory GST offset priority rules for `tax_liability`:
     - IGST credit offset first against IGST liability, then CGST, then SGST.
     - CGST credit offset against CGST liability, then IGST (never SGST).
     - SGST credit offset against SGST liability, then IGST (never CGST).
  3. Include tax ledger balance reconciliation.
- **Acceptance Criteria:**
  - RCM liability is reported separately from regular outward supplies.
  - Tax payable reflects statutory cross-utilization rules rather than naive subtraction.

#### [ ] TASK-ACT-08: Secure TDS Export & Support Legacy Group-less Records
- **Priority:** P1
- **Target Files:**
  - `app/composables/useTdsManager.ts:135-155`
  - `server/utils/accounting/tds-manager.service.ts:241-255`
- **Issue References:** ACCT-009, ACCT-012
- **Technical Specification:**
  1. Refactor `exportExcel` in `useTdsManager.ts` to use `useApi().download` (or central authenticated download helper), ensuring HttpOnly cookies and `x-firm-id` are passed.
  2. In `tds-manager.service.ts`, enhance leg grouping:
     - If `voucherGroupId` is present, group by `voucherGroupId`.
     - If `voucherGroupId` is null/empty, fall back to grouping by `refId` or `voucherNo` + `transactionDate`.
- **Acceptance Criteria:**
  - TDS Excel export succeeds across different selected firms without direct fetch/localStorage token.
  - Legacy ledger entries without `voucherGroupId` appear accurately in the TDS Register.

---

### Phase 3: Distributed Cross-Database Atomicity (P1)

#### [ ] TASK-ACT-09: Robust Compensation Guard for Labor Advances & GL Vouchers
- **Priority:** P1
- **Target Files:**
  - `server/api/accounting/vouchers.post.ts:192-262`
  - `server/api/accounting/vouchers/[voucherGroupId].delete.ts:125-145`
- **Issue Reference:** ACCT-011
- **Technical Specification:**
  1. Wrap dual-database write in a strict compensating transaction pattern:
     - Execute PostgreSQL validation and lock labor period.
     - Post MongoDB General Ledger voucher.
     - Attempt PostgreSQL `labor_advances` insert.
     - **Compensating Rollback:** If PostgreSQL insert fails, execute immediate compensating reversal of the committed MongoDB voucher within the catch block before propagating error.
  2. In voucher delete/reversal, ensure PostgreSQL labor advance deletion is verified; if PostgreSQL cleanup fails, abort voucher reversal to maintain cross-database symmetry.
- **Acceptance Criteria:**
  - A failure in PostgreSQL labor advance insert leaves zero unreversed entries in MongoDB GL.
  - Cross-database state consistency is guaranteed on voucher posting and reversal.

---

### Phase 4: Code Consolidation & Simplification (P2)

#### [ ] TASK-ACT-10: Consolidate Shared Invoice Total & Tax Calculations
- **Priority:** P2
- **Target Files:**
  - `server/utils/accounting/bill-utils.ts`
  - `app/composables/useBillingState.ts`
  - `app/composables/useAccountingInvoiceState.ts`
  - `server/api/accounting/sales.post.ts`
  - `server/api/accounting/purchases.post.ts`
- **Issue Reference:** OE-01, CODE-DUP
- **Technical Specification:**
  1. Make `calcBillTotals` in `bill-utils.ts` the single source of truth for both frontend and backend calculations.
  2. Export a shared isomorphic calculation utility (`shared/utils/tax-calc.ts` or imported via Nitro auto-imports) used by both Vue billing composables and Nitro bill handlers.
  3. Ensure exact paise rounding (`cgst + sgst === totalTax` to the cent) is enforced uniformly.
- **Acceptance Criteria:**
  - Frontend displayed invoice totals and backend saved invoice totals match 100% on every bill type.
  - Code duplication across `useBillingState` and `useAccountingInvoiceState` reduced by >250 lines.

#### [ ] TASK-ACT-11: Consolidate PDF & Excel Export Dependencies
- **Priority:** P2
- **Target Files:**
  - `package.json`
  - Export service routes
- **Issue Reference:** OE-04
- **Technical Specification:**
  1. Standardize spreadsheet generation on `exceljs` (remove `xlsx` unless legacy binary format support is required).
  2. Standardize PDF generation on `pdfmake` or `pdfkit` (standardize on one primary PDF rendering engine).
  3. Reduce bundle size and eliminate conflicting types in `package.json`.
- **Acceptance Criteria:**
  - All Excel exports work seamlessly via single standardized library.
  - Reduced dependencies in `package.json`.

---

### Phase 5: Automated Accounting Test Suite & Regression Guards (P0/P1)

#### [ ] TASK-ACT-12: Establish Vitest Accounting Test Framework
- **Priority:** P0
- **Target Files:**
  - `package.json`
  - `vitest.config.ts`
  - `tests/accounting/`
- **Issue Reference:** ACCT-013
- **Technical Specification:**
  1. Install `vitest`, `@nuxt/test-utils`, and MongoDB in-memory runner or test database harness.
  2. Add test scripts: `"test:accounting": "vitest run tests/accounting"`.
  3. Create test fixtures for firms, parties, chart of accounts, and bills.
- **Acceptance Criteria:**
  - `pnpm test:accounting` executes cleanly in CI/CD and local environments.

#### [ ] TASK-ACT-13: Implement Core Invariant Accounting Test Suites
- **Priority:** P0
- **Target Files:**
  - `tests/accounting/unified-posting.test.ts`
  - `tests/accounting/bill-cancellation.test.ts`
  - `tests/accounting/voucher-reversal.test.ts`
  - `tests/accounting/gst-calculation.test.ts`
  - `tests/accounting/backdated-numbering.test.ts`
- **Technical Specification:**
  1. **Trial Balance Balance Invariant:** Ensure total Debits === total Credits across all posted vouchers.
  2. **Cancellation Invariant:** Post bill -> Edit bill -> Cancel bill -> Assert ledger balance returns to baseline (0 net change).
  3. **Voucher Reversal Invariant:** Post journal voucher -> Reverse voucher -> Assert both entries exist and sum to 0.
  4. **Idempotency Invariant:** Replay identical voucher key -> Assert zero duplicate ledger entries.
- **Acceptance Criteria:**
  - All invariant tests pass with 100% assertion success on financial balance integrity.

---

## 6. Implementation Schedule & Safety Constraints

### Safety Constraints for Implementation
1. **Zero Code Edits During Planning:** Confirmed and observed. No code files were modified during the audit or plan generation.
2. **Read-Only Verification:** All code references and line numbers verified against repository source files.
3. **Database Migration Safety:** Any schema changes (e.g. `BillSequence` compound indexes) must be accompanied by non-destructive migration scripts.
4. **Auth Separation:** Keep authentication system changes strictly isolated from accounting functional fixes.

---

*This document serves as the official tracking plan for addressing the findings identified in `ACCOUNTING_SYSTEM_DEEP_CODE_AUDIT.md`.*
