# Unified Double-Entry Accounting System Architecture
## Universal General Ledger Engine, Sub-Ledger Virtualization, and Complete 12-Module Integration Specification

**Document Version:** 2.0.0  
**Effective Date:** 2026-11-08  
**Scope:** Universal General Ledger Engine, Dual-Database Model (MongoDB Atlas + PostgreSQL), Chart of Accounts Governance, Virtual Sub-Ledgers, Future-Proof Bug Defenses, Cross-Module Integration  
**Target:** Nuxt 4 Enterprise ERP Engine  

---

## 1. Executive Vision: The Universal Journal Pattern

In standard commercial ERP software, different business modules (Commercial Billing, Banking, Staff Payroll, Labor Workforce, Subcontractors, Inventory) frequently drift out of sync when each module maintains its own private balance sheet or payment tables. 

This document defines the **Truly Unified Double-Entry Accounting Architecture** for this enterprise ERP, modeled after the tier-1 **Universal Journal Standard** (analogous to SAP S/4HANA `ACDOCA` and NetSuite OneWorld).

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                               OPERATIONAL MODULES (BUSINESS EVENT PRODUCERS)                     │
│                                                                                                  │
│   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐   │
│   │  Commercial  │   │   Banking    │   │ Labor System │   │   Payroll    │   │  Inventory   │   │
│   │   Billing    │   │  & Treasury  │   │ (PostgreSQL) │   │   & Wages    │   │  & Material  │   │
│   └──────┬───────┘   └──────┬───────┘   └──────┬───────┘   └──────┬───────┘   └──────┬───────┘   │
└──────────┼──────────────────┼──────────────────┼──────────────────┼──────────────────┼───────────┘
           │                  │                  │                  │                  │            
           ▼                  ▼                  ▼                  ▼                  ▼            
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                         CENTRAL ACCOUNTING EVENT ROUTER (`postEvent`)                            │
│                                                                                                  │
│   • Period Lock Guard: Validates that the transaction date is not within a closed/frozen period. │
│   • Integer-Paise Parity Guard: Asserts Σ(Debits) === Σ(Credits) to the exact paisa (±₹0.00).    │
│   • Control Account Resolver: Maps events to canonical 4-digit Chart of Accounts control codes.  │
│   • Gapless Voucher Numbering: Generates sequential series per firm, FY, and voucher type.       │
│   • Snapshot Immutability: Captures immutable entity names and statutory tax details at posting. │
└──────────────────────────────────────────────────┬───────────────────────────────────────────────┘
                                                   │
                                          Atomic Append-Only Write
                                                   │
                                                   ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                             THE UNIVERSAL JOURNAL (`Ledger` Collection)                          │
│                                (THE SINGLE SOURCE OF FINANCIAL TRUTH)                            │
│                                                                                                  │
│   Financial Core:     firmId | transactionDate | voucherNo | voucherGroupId | accountCode        │
│   Amounts:            debitAmount (₹) | creditAmount (₹)                                         │
│   Sub-Ledger Tags:    partyId (Customer/Vendor/Leader) | bankAccountId | masterRollId | stockId  │
│   Statutory Tags:     tdsSection | tdsRate | isGrossUp | gstRate | hsnSac | gstin                │
│   Audit Lineage:      refType | refId | createdBy | isReversed | replacesVoucherGroupId          │
└──────────────────────────────────────────────────┬───────────────────────────────────────────────┘
                                                   │
                      ┌────────────────────────────┴────────────────────────────┐
                      ▼                                                         ▼
        REAL-TIME VIRTUAL SUB-LEDGERS                            STATUTORY & EXECUTIVE REPORTS
        (Aggregated directly from GL on the fly)                 (Zero reconciliation drift)
        • Customer Statements & AR Aging                         • Balance Sheet & Trial Balance
        • Vendor Payables & AP Aging                             • Profit & Loss Statement
        • Employee Advance Running Ledgers                       • Form 26Q TDS Deductee Register
        • Labor Leader Settlement Ledgers                        • GSTR-1 & GSTR-3B Tax Summaries
        • Bank Book & Cash Book                                  • Stock Valuation Ledger
```

### The 3 Golden Invariants of the Unified Architecture:
1. **GL Primacy**: The MongoDB `Ledger` collection is the **only table that holds financial balances**. No operational model (`Party`, `Advance`, `Wage`, or PostgreSQL `labor_advances`) is permitted to store a standalone running balance field.
2. **Sub-Ledgers are Real-Time Projections**: Customer balance, vendor payable balance, employee advance balance, and labor leader balance are **dynamically computed projections** of the General Ledger filtered by dimensional tags (`partyId`, `bankAccountId`, `masterRollId`).
3. **Zero Reconciliation Drift**: Because there is only one source of financial truth, reconciliation variance between General Ledger and Sub-Ledgers is **mathematically zero ($\Delta \equiv 0$) at all times**.

---

## 2. Distributed Dual-Database Division of Labor

The ERP operates across two distinct databases: **MongoDB Atlas** and **PostgreSQL (Neon/Supabase)**. To eliminate cross-database split-brain errors, a strict boundary of responsibility is enforced:

```
┌───────────────────────────────────────────────────┐     ┌───────────────────────────────────────────────────┐
│              POSTGRESQL (OPERATIONAL)             │     │                MONGODB ATLAS (GL)                 │
├───────────────────────────────────────────────────┤     ├───────────────────────────────────────────────────┤
│ • Labor Leaders Master (Phone, Aadhaar, PAN)      │     │ • Canonical General Ledger (`Ledger`)             │
│ • Labor Work Periods (Start Date, End Date)       │     │ • Master Chart of Accounts (`ChartOfAccounts`)    │
│ • Labor Workers (Rosters per batch)               │     │ • Universal Commercial Bills (`Bill`)             │
│ • Daily Attendance Matrix (0, 0.5, 1.0, 1.5 days) │     │ • Bank Accounts Master (`BankAccount`)            │
│ • Daily Wage Rates & Overtime Units               │     │ • Party Master (`Party` - Debtors & Creditors)    │
│ • Work Batch Status ('Open', 'Settled')           │     │ • Staff Master Roll (`MasterRoll`)                │
│ • Document Repository metadata (`documents`)      │     │ • Fiscal Period Locks & Gapless Sequences         │
└─────────────────────────┬─────────────────────────┘     └─────────────────────────▲─────────────────────────┘
                          │                                                         │
                          │   On Payout / Disbursal Settlement                      │
                          └─────────────────────────────────────────────────────────┘
                              Emits `LABOR_ADVANCE` or `LABOR_SETTLEMENT` Event
```

### The Boundary Rules:
1. **PostgreSQL stores operational metrics**: Days worked, attendance punch logs, worker rosters, labor leader KYC details, and document attachments.
2. **PostgreSQL NEVER stores independent financial balances**: When a labor advance or settlement is paid, the monetary disbursal is committed to MongoDB `Ledger`. PostgreSQL stores only the operational reference pointer (`ledger_voucher_group_id VARCHAR(100)`).
3. **Two-Phase Compensating Saga**: If a financial operation fails in either database, the preceding write is automatically reversed with an atomic compensation rollback.
4. **Continuous Cross-Database Auditor**: `SLGLReconcilerService` checks cross-DB parity continuously to alert administrators of any attempted direct SQL tampering.

---

## 3. Universal Chart of Accounts (COA) Control Architecture

To prevent Chart of Accounts fragmentation where thousands of personal names pollute the ledger, the COA uses a **4-Digit Statutory Numeric Code System (1000–5999)**:

### 3.1 Control Account Code Ranges

| Code Range | Major Category | Nature | Balance Sheet / P&L Classification | Control Account Examples |
| :--- | :--- | :--- | :--- | :--- |
| **1000–1999** | **ASSETS** | Debit | **BALANCE_SHEET** (Permanent) | 1100 Cash in Hand, 1200 Bank Accounts, 1300 Sundry Debtors (AR), 1410 Employee Advances, 1420 Labor Advances, 1430 Site Imprest Float, 1510 CGST Input, 1520 SGST Input, 1530 IGST Input, 1540 TDS Receivable u/s 194Q, 1600 Raw Materials & Inventory |
| **2000–2999** | **LIABILITIES** | Credit | **BALANCE_SHEET** (Permanent) | 2100 Sundry Creditors (AP), 2150 Subcontractor Payables, 2160 Retention Money Payable, 2210 Labor Wages Payable, 2310 CGST Output, 2320 SGST Output, 2330 IGST Output, 2341 TDS Payable u/s 194C, 2342 TDS u/s 194J, 2343 TDS u/s 194I, 2410 Salaries Payable, 2420 EPF Payable, 2430 ESIC Payable, 2440 Professional Tax |
| **3000–3999** | **EQUITY & CAPITAL**| Credit | **BALANCE_SHEET** (Permanent) | 3100 Partner / Share Capital, 3200 Reserves & Surplus (Retained Earnings), 3300 Difference in Opening Balances |
| **4000–4999** | **REVENUE / INCOME**| Credit | **PNL** (Temporary - Zeroed at Year-End) | 4100 Commercial Sales Revenue, 4200 Service Revenue, 4300 Scrap Sales & Discounts Received, 4400 Inventory Valuation Gain, 4500 Bank Interest Income, 4990 Round-off Credit (Gain) |
| **5000–5999** | **EXPENSES** | Debit | **PNL** (Temporary - Zeroed at Year-End) | 5100 Direct Material Purchases, 5190 Inventory Scrap & COGS, 5200 Staff Salaries & Wages, 5210 Labor Wages Expense, 5220 Labor Site Expenses, 5230 Employer EPF Contribution, 5240 Employer ESIC Contribution, 5300 Subcontracting Expenses, 5400 TDS Borne by Company (195A), 5500 Site Imprest Expenses, 5600 Bank Charges, 5990 Round-off Debit (Loss) |

### 3.2 Dimensional Tagging Rule
- **Rule**: An individual customer, vendor, labor leader, or employee is **never** created as an independent Account Head in `ChartOfAccounts`.
- **Implementation**: The transaction leg posts to a canonical Control Account (e.g. `1300 Sundry Debtors`), and attaches a **Sub-Ledger Dimension Tag**:
  - `partyId`: ObjectId referencing `Party` or UUID referencing `labor_leaders`.
  - `masterRollId`: ObjectId referencing `MasterRoll`.
  - `bankAccountId`: ObjectId referencing `BankAccount`.
  - `stockId`: ObjectId referencing `Stock`.

---

## 4. Integer-Paise Precision Standard (Eliminating IEEE-754 Drift)

Standard JavaScript floating-point numbers (`0.1 + 0.2 === 0.30000000000000004`) introduce micro-penny discrepancies when calculating tax lines, bulk payroll, or unit rates. Over thousands of rows, these fractional errors violate double-entry balance.

### 4.1 Precision Specification
1. **Paise Normalization**: All monetary amounts are internally converted to integer paise ($\text{amount} \times 100$) during balance validation and aggregation:
   ```ts
   export const toPaise = (rupees: number | string): number => {
     const num = typeof rupees === 'string' ? parseFloat(rupees) : rupees;
     return Math.round((Number(num || 0) + Number.EPSILON) * 100);
   };

   export const fromPaise = (paise: number): number => {
     return paise / 100;
   };
   ```
2. **Zero-Tolerance Double-Entry Parity**:
   ```ts
   const totalDebitPaise = legs.reduce((sum, leg) => sum + toPaise(leg.debitAmount), 0);
   const totalCreditPaise = legs.reduce((sum, leg) => sum + toPaise(leg.creditAmount), 0);

   if (totalDebitPaise !== totalCreditPaise) {
     throw new Error(`Double-entry parity violation: Debit ₹${fromPaise(totalDebitPaise)} !== Credit ₹${fromPaise(totalCreditPaise)}`);
   }
   ```
3. **Fractional Round-off Allocation**:
   When calculating GST or bulk percentages, any fractional paise difference is automatically posted to:
   - Account `4990 - Round-off Credit (Gain)` if Credits < Debits
   - Account `5990 - Round-off Debit (Loss)` if Debits < Credits

---

## 5. Live Data Coexistence & Dual-Read Compatibility Facade

The production database contains **5,316 existing ledger entries** (including 1,766 legacy entries with `voucherType: null`) and **283 Chart of Accounts entries** (including 103 individual vendor accounts and 24 individual debtor accounts).

A sudden rigid enforcement of 4-digit numeric codes would break historical queries, reports, and UI screens. The system implements a **Dual-Read Compatibility Facade**:

```ts
/**
 * Dual-Read Sub-Ledger Aggregation Facade
 * Guarantees 100% backward compatibility for historical and modern ledger records.
 */
export function buildDualReadPartyMatch(firmId: mongoose.Types.ObjectId, party: { _id: any; name: string }) {
  const escapedName = party.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return {
    $or: [{ firmId }, { firm_id: firmId }],
    isReversed: { $ne: true },
    $and: [
      {
        $or: [
          // Modern dimensional posting (Code 1300/2100 + partyId)
          { partyId: party._id },
          // Historical legacy posting (Party name stored directly in accountHead)
          { 
            accountHead: { $regex: `^${escapedName}$`, $options: 'i' },
            accountType: { $in: ['SUNDRY_CREDITORS', 'SUNDRY_DEBTORS', 'PARTY', 'VENDOR', 'CUSTOMER'] }
          }
        ]
      }
    ]
  };
}
```

### 5.1 Dynamic Voucher Type Resolution for Legacy Records
When querying historical vouchers where `voucherType == null`, aggregation pipelines dynamically project `voucherType` using refType heuristics:
- `refType: 'BILL'` $\rightarrow$ `SALES` (or `PURCHASE` based on credit/debit leg)
- `refType: 'WAGE'` / `'WAGE_PAYOUT'` $\rightarrow$ `JOURNAL` / `PAYMENT`
- `refType: 'STOCK_MOVEMENT'` $\rightarrow$ `STOCK_ADJUSTMENT`
- `refType: 'BILL_CANCELLATION'` $\rightarrow$ `SALES` / `PURCHASE`
- Default $\rightarrow$ `JOURNAL`

---

## 6. Complete 12-Module Double-Entry Integration Specification

Every operational module in the ERP creates standardized double-entry vouchers through `UnifiedPostingService`:

```
┌───────────────────────────────────────────────────────────────────────────────────────────────┐
│                               MODULE INTEGRATION MATRIX OVERVIEW                              │
├─────┬───────────────────────────┬──────────────┬──────────────┬───────────────────────────────┤
│ Ref │ Module Name               │ Voucher Type │ Prefix Map   │ Primary Control Accounts      │
├─────┼───────────────────────────┼──────────────┼──────────────┼───────────────────────────────┤
│ 6.1 │ Commercial Sales          │ SALES        │ SI           │ 1300 Debtor, 4100 Sales, 2310 │
│ 6.2 │ Commercial Purchases      │ PURCHASE     │ PI           │ 5100 Direct Exp, 2100 Vendor  │
│ 6.3 │ Customer Receipts         │ RECEIPT      │ RV           │ 1200 Bank, 1300 Debtor, 1540  │
│ 6.4 │ Vendor Payments           │ PAYMENT      │ PV           │ 2100 Vendor, 1200 Bank, 2341  │
│ 6.5 │ Banking & Treasury        │ CONTRA       │ CV           │ 1100 Cash, 1200 Bank (Cross)  │
│ 6.6 │ Labor Workforce Mgmt      │ PAYMENT/JOUR │ PV / JV      │ 1420 Adv, 5210 Wages, 1200 Bnk│
│ 6.7 │ Staff & Factory Payroll   │ JOURNAL/PAYM │ JV / PV      │ 5200 Wages, 2410 Sal, 2420 EPF│
│ 6.8 │ Employee Advances         │ PAYMENT/JOUR │ PV / JV      │ 1410 Emp Adv, 1200 Bank       │
│ 6.9 │ Subcontractor Claims      │ JOURNAL/PAYM │ JV / PV      │ 5300 Subcontract, 2150 Wallet │
│ 6.10│ Inventory & Material      │ STOCK_ADJUST │ SA           │ 1600 Inventory, 5190 COGS     │
│ 6.11│ Site Imprest & Claims     │ PAYMENT/JOUR │ PV / JV      │ 1430 Imprest, 5500 Site Exp   │
│ 6.12│ Statutory Taxes & Close   │ PAYMENT/CLOS │ PV / CL      │ 2300 Taxes, 3200 Reserves     │
└─────┴───────────────────────────┴──────────────┴──────────────┴───────────────────────────────┘
```

---

### 6.1 Module 1: Commercial Sales & Accounts Receivable (AR)
- **Trigger**: Issuing a GST Tax Invoice, Sales Bill, or Customer Debit Note.
- **Upstream Model**: `server/models/Bill.ts` (`billType: 'SALE'`).
- **Accounting Voucher**: `SALES` (Prefix `SI/YYYY-YY/XXXX`).

#### Standard Double-Entry Ledger Posting:
```
Debit:  1300 - Sundry Debtors           [partyId: Customer._id]  ₹ Total Invoice Value
Credit: 4100 - Commercial Sales Revenue                          ₹ Taxable Bill Value
Credit: 2310 - CGST Output Liability    (if Intra-state)         ₹ CGST Amount
Credit: 2320 - SGST Output Liability    (if Intra-state)         ₹ SGST Amount
Credit: 2330 - IGST Output Liability    (if Inter-state)         ₹ IGST Amount
Credit: 4990 - Round-off Credit (Gain)  (if fraction < 0)        ₹ Paisa Adjustment
Debit:  5990 - Round-off Debit (Loss)   (if fraction > 0)        ₹ Paisa Adjustment
```
- **Edit/Cancel Lifecycle**: When a bill is updated or cancelled, **never** execute physical `deleteMany()`. System atomically posts a contra-reversal voucher (`refType: 'BILL_CANCELLATION'`), marking original records `isReversed: true`, followed by the new updated voucher with `replacesVoucherGroupId`.

---

### 6.2 Module 2: Commercial Purchases & Accounts Payable (AP)
- **Trigger**: Inward supplier bill, raw material procurement, or capital asset invoice.
- **Upstream Model**: `server/models/Bill.ts` (`billType: 'PURCHASE'`).
- **Accounting Voucher**: `PURCHASE` (Prefix `PI/YYYY-YY/XXXX`).

#### Standard Double-Entry Ledger Posting:
```
Debit:  5100 - Direct Material Purchases / 1600 Inventory        ₹ Taxable Bill Value
Debit:  1510 - CGST Input Tax Credit     (if Intra-state)        ₹ CGST Amount
Debit:  1520 - SGST Input Tax Credit     (if Intra-state)        ₹ SGST Amount
Debit:  1530 - IGST Input Tax Credit     (if Inter-state)        ₹ IGST Amount
Credit: 2100 - Sundry Creditors          [partyId: Vendor._id]   ₹ Total Payable Value
Credit: 4990 - Round-off Credit (Gain)   (if fraction < 0)       ₹ Paisa Adjustment
Debit:  5990 - Round-off Debit (Loss)    (if fraction > 0)       ₹ Paisa Adjustment
```
- **Edit/Cancel Lifecycle**: Reverses stock movement via `StockService.reverseMovement()` + posts a contra-reversal voucher.

---

### 6.3 Module 3: Customer Receipts & Inward TDS
- **Trigger**: Customer pays outstanding bill via Bank or Cash; customer withholds TDS u/s 194Q.
- **Accounting Voucher**: `RECEIPT` (Prefix `RV/YYYY-YY/XXXX`).

#### Standard Double-Entry Ledger Posting:
```
Debit:  1200 - Bank Account / 1100 Cash  [bankAccountId: Bank._id] ₹ Net Cash Received
Debit:  1540 - TDS Receivable u/s 194Q   [statutory: { sec: '194Q'}]₹ Customer Withheld TDS
Credit: 1300 - Sundry Debtors           [partyId: Customer._id]   ₹ Total Settled Amount
```

---

### 6.4 Module 4: Vendor Payments & Withholding Tax (TDS)
- **Trigger**: Disbursing payment to a vendor, contractor, or landlord; withholding TDS u/s 194C/J/I.
- **Accounting Voucher**: `PAYMENT` (Prefix `PV/YYYY-YY/XXXX`).

#### Standard Double-Entry Ledger Posting:
```
Debit:  2100 - Sundry Creditors          [partyId: Vendor._id]     ₹ Gross Bill Value Settled
Credit: 1200 - Bank Account              [bankAccountId: Bank._id] ₹ Net Cash Paid Out
Credit: 2341 - TDS Payable u/s 194C/J/I  [statutory: { sec, rate}] ₹ TDS Withheld Amount
Credit: 4300 - Discounts Received        (if early payment)        ₹ Cash Discount Gain
```

---

### 6.5 Module 5: Banking & Treasury Operations (Contra Vouchers)
- **Trigger**: Internal funds movement: Bank-to-Bank transfer, Cash deposited to Bank, Cash withdrawn for office use.
- **Accounting Voucher**: `CONTRA` (Prefix `CV/YYYY-YY/XXXX`).

#### Standard Double-Entry Ledger Posting (Inter-Bank Transfer):
```
Debit:  1200 - Destination Bank Account  [bankAccountId: Dest._id]   ₹ Transferred Amount
Credit: 1200 - Source Bank Account       [bankAccountId: Source._id] ₹ Transferred Amount
```
#### Standard Double-Entry Ledger Posting (Cash Withdrawal for Office):
```
Debit:  1100 - Cash in Hand              [accountHead: 'Cash in Hand'] ₹ Cash Withdrawn
Credit: 1200 - Source Bank Account       [bankAccountId: Source._id]   ₹ Cash Withdrawn
```

---

### 6.6 Module 6: Labor Workforce Management (PostgreSQL $\leftrightarrow$ MongoDB)
- **Operational Origin**: PostgreSQL `labor_periods`, `labor_attendance`, `labor_advances`, `labor_settlements`.
- **Financial Destination**: MongoDB Universal `Ledger`.

#### Flow 6A: Labor Interim Advance Payment
```
Scenario 1: Net Advance with TDS Grossed-Up u/s 195A (Firm bears tax):
Debit:  1420 - Labor Leader Advances     [partyId: Leader.UUID]    ₹ Net Advance Paid
Debit:  5400 - TDS Borne by Company (Tax)[statutory: 195A]         ₹ TDS Amount (e.g. 1%)
Credit: 2341 - TDS Payable u/s 194C      [statutory: 194C]         ₹ TDS Amount (e.g. 1%)
Credit: 1200 - Bank / 1100 Cash          [bankAccountId: Bank._id] ₹ Net Cash Disbursed

Scenario 2: Standard TDS Deduction (Leader bears tax):
Debit:  1420 - Labor Leader Advances     [partyId: Leader.UUID]    ₹ Gross Advance Amount
Credit: 2341 - TDS Payable u/s 194C      [statutory: 194C]         ₹ TDS Withheld (1%)
Credit: 1200 - Bank / 1100 Cash          [bankAccountId: Bank._id] ₹ Net Cash Disbursed
```

#### Flow 6B: Labor Batch Final Settlement & Wage Expense Recognition
```
Debit:  5210 - Labor Wages Expense                                 ₹ Total Computed Wages
Debit:  5220 - Labor Site Expenses                                 ₹ Food/Travel Expenses
Credit: 1420 - Labor Leader Advances     [partyId: Leader.UUID]    ₹ Interim Advances Recovered
Credit: 1200 - Bank Account              [bankAccountId: Bank._id] ₹ Net Disbursed Payout
Credit: 4990 - Round-off / Variance Adjustment (if any)            ₹ Fractional Adjustment
```

---

### 6.7 Module 7: Staff & Factory Payroll (Salaries & Statutory Funds)
- **Trigger**: Monthly salary finalization from Master Roll attendance logs.
- **Accounting Voucher**: `JOURNAL` (Accrual) + `PAYMENT` (Settlement).

#### Flow 7A: Monthly Payroll Accrual (End of Month):
```
Debit:  5200 - Salaries & Wages Expense                            ₹ Gross Wages / Salaries
Debit:  5230 - Employer EPF Contribution (Statutory Benefit)       ₹ Employer EPF Share (12%)
Debit:  5240 - Employer ESIC Contribution (Statutory Benefit)      ₹ Employer ESIC Share (3.25%)
Credit: 2410 - Salaries & Wages Payable                            ₹ Net Payable to Employees
Credit: 2420 - EPF Payable (Employee 12% + Employer 12%)           ₹ Total EPF Liability (24%)
Credit: 2430 - ESIC Payable (Employee 0.75% + Employer 3.25%)     ₹ Total ESIC Liability (4%)
Credit: 1410 - Employee Advances Recovered [masterRollId: Emp._id] ₹ Monthly Loan Deduction
Credit: 2440 - Professional Tax / Other Deductions Payable         ₹ PT Deducted
```

#### Flow 7B: Salary Bank Disbursal (7th of Next Month):
```
Debit:  2410 - Salaries & Wages Payable                            ₹ Net Disbursed Salaries
Credit: 1200 - Bank Account              [bankAccountId: Bank._id] ₹ Net Outflow
```

---

### 6.8 Module 8: Employee Advances & Personal Loans
- **Trigger**: Disbursing mid-month advance to an employee outside normal payroll.
- **Accounting Voucher**: `PAYMENT` (Disbursal) and `JOURNAL` (Recovery).

#### Standard Double-Entry Ledger Posting:
```
Debit:  1410 - Advance to Employees      [masterRollId: Emp._id]   ₹ Advance Amount
Credit: 1200 - Bank / 1100 Cash          [bankAccountId: Bank._id] ₹ Disbursed Cash/Bank
```
- **Virtual Balance Identity**: Outstanding loan balance is queried dynamically:
  $$\text{Current Loan} = \sum (\text{Debit}) - \sum (\text{Credit}) \quad \text{on Account } 1410 \text{ for } \mathtt{masterRollId}$$

---

### 6.9 Module 9: Subcontractor Wallets & Progress Billing
- **Trigger**: Approving subcontractor progress bill or milestone claim.
- **Accounting Voucher**: `JOURNAL` / `PAYMENT`.

#### Standard Double-Entry Ledger Posting:
```
Debit:  5300 - Subcontracting Expenses                             ₹ Bill Claim Value
Credit: 2150 - Subcontractor Payables    [partyId: Subcontract._id]₹ Net Approved Claim
Credit: 2160 - Retention Money Payable   (e.g. 5% contract hold)   ₹ Retention Held
Credit: 2341 - TDS Payable u/s 194C      [statutory: 194C]         ₹ TDS Withheld
```
- **Disbursal**: Payout from wallet to bank posts: Debit `2150 Subcontractor Payables`, Credit `1200 Bank`.
- **Retention Release**: Upon final handover: Debit `2160 Retention Money Payable`, Credit `1200 Bank`.

---

### 6.10 Module 10: Inventory & Material Stock Valuation
- **Trigger**: Physical stock count discrepancy, material damage scrap, site wastage, or direct consumption.
- **Accounting Voucher**: `STOCK_ADJUSTMENT` (Prefix `SA/YYYY-YY/XXXX`).

#### Standard Double-Entry Ledger Posting (Damage / Scrap):
```
Debit:  5190 - Inventory Scrap & Wastage / COGS                    ₹ Loss Valuation Amount
Credit: 1600 - Raw Materials & Stock     [stockId: Stock._id]      ₹ Asset Reduction
```
#### Standard Double-Entry Ledger Posting (Found Stock Surplus):
```
Debit:  1600 - Raw Materials & Stock     [stockId: Stock._id]      ₹ Asset Addition
Credit: 4400 - Inventory Adjustment Gain                           ₹ Gain Valuation Amount
```

---

### 6.11 Module 11: Site Imprest & Field Expense Claims
- **Trigger**: Imprest float handed to site supervisor for petty site purchases.
- **Accounting Voucher**: `PAYMENT` (Float Disbursal) and `JOURNAL` (Expense Claim).

#### Flow 11A: Imprest Float Disbursal:
```
Debit:  1430 - Site Imprest Float        [partyId: Supervisor._id] ₹ Float Given (e.g. ₹50,000)
Credit: 1200 - Bank Account              [bankAccountId: Bank._id] ₹ Bank Outflow
```
#### Flow 11B: Supervisor Submits Vouchers & Bills:
```
Debit:  5510 - Site Diesel & Fuel Expense                          ₹ Fuel Value
Debit:  5520 - Site Repairs & Hardware                             ₹ Hardware Value
Debit:  5530 - Site Food & Tea Refreshments                        ₹ Tea Value
Credit: 1430 - Site Imprest Float        [partyId: Supervisor._id] ₹ Vouchers Settled
```

---

### 6.12 Module 12: Statutory Tax Engine & Fiscal Year Closing
- **Trigger**: Remitting monthly GST/TDS challans to Government or executing Fiscal Year Close.

#### Flow 12A: TDS Remittance via ITNS-281 Challan:
```
Debit:  2341 - TDS Payable u/s 194C                                ₹ Challan Tax Amount
Credit: 1200 - Bank Account              [bankAccountId: Bank._id] ₹ Net Tax Paid Out
```
#### Flow 12B: Fiscal Year-End Close (31st March):
```
1. Debit all Revenue Accounts (4000-4999) to Zero them out:
   Debit:  4100 - Commercial Sales Revenue                         ₹ Total Annual Sales
2. Credit all Expense Accounts (5000-5999) to Zero them out:
   Credit: 5100 - Purchases / Wages / Expenses                    ₹ Total Annual Expenses
3. Transfer the Net Profit / Loss to Balance Sheet Equity:
   Credit: 3200 - Reserves & Surplus (Retained Earnings)           ₹ Net Annual Profit
```

---

## 7. Declarative Accounting Event Bus Specification

All operational modules communicate with the accounting core exclusively by emitting strongly-typed declarative events:

```ts
export interface IAccountingEvent {
  eventType: 
    | 'COMMERCIAL_SALE'
    | 'COMMERCIAL_PURCHASE'
    | 'CUSTOMER_RECEIPT'
    | 'VENDOR_PAYMENT'
    | 'LABOR_ADVANCE'
    | 'LABOR_SETTLEMENT'
    | 'PAYROLL_ACCRUAL'
    | 'PAYROLL_DISBURSAL'
    | 'EMPLOYEE_ADVANCE'
    | 'SUBCONTRACT_CLAIM'
    | 'STOCK_ADJUSTMENT'
    | 'INTER_BANK_CONTRA'
    | 'CASH_CONTRA'
    | 'STATUTORY_CHALLAN'
    | 'YEAR_END_CLOSE';

  firmId: string | mongoose.Types.ObjectId;
  transactionDate: string; // YYYY-MM-DD
  referenceNo?: string;
  narration: string;
  createdBy: string;

  // Primary Monetary Values (Rupees)
  amounts: {
    baseAmount: number;
    taxAmount?: number;
    tdsAmount?: number;
    roundOff?: number;
    totalAmount: number;
  };

  // Dimensional Master Entities
  dimensions: {
    partyId?: string | mongoose.Types.ObjectId;
    bankAccountId?: string | mongoose.Types.ObjectId;
    masterRollId?: string | mongoose.Types.ObjectId;
    stockId?: string | mongoose.Types.ObjectId;
    stockRegId?: string | mongoose.Types.ObjectId;
    costCenterId?: string;
  };

  // Statutory Tax Metadata
  statutory?: {
    tdsSection?: string;
    tdsRate?: number;
    isGrossUp?: boolean;
    gstRate?: number;
    hsnSac?: string;
    gstin?: string;
  };

  // Upstream Document Traceability
  audit: {
    refType: string;
    refId?: string | mongoose.Types.ObjectId;
    externalVoucherNo?: string;
  };
}
```

---

## 8. Real-Time Virtual Sub-Ledger Query Engine

With all financial balances consolidated into `Ledger`, Sub-Ledgers become lightweight, real-time aggregation queries:

### 8.1 Employee Advance Sub-Ledger Query
```ts
export async function getEmployeeAdvanceBalance(firmId: string, masterRollId: string, toDate?: string) {
  const match: any = {
    $or: [{ firmId: new mongoose.Types.ObjectId(firmId) }, { firm_id: new mongoose.Types.ObjectId(firmId) }],
    accountHead: 'Advance to Employees',
    masterRollId: new mongoose.Types.ObjectId(masterRollId),
    isReversed: { $ne: true }
  };
  if (toDate) match.transactionDate = { $lte: toDate };

  const [res] = await Ledger.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$masterRollId',
        totalDisbursed: { $sum: '$debitAmount' },
        totalRecovered: { $sum: '$creditAmount' }
      }
    },
    {
      $project: {
        currentBalance: { $subtract: ['$totalDisbursed', '$totalRecovered'] }
      }
    }
  ]);

  return res?.currentBalance || 0;
}
```

### 8.2 Customer Accounts Receivable (AR) Dual-Read Query
```ts
export async function getCustomerOutstanding(firmId: string, party: { _id: any; name: string }, toDate?: string) {
  const firmIdObj = new mongoose.Types.ObjectId(firmId);
  const match = buildDualReadPartyMatch(firmIdObj, party);
  if (toDate) (match as any).transactionDate = { $lte: toDate };

  const [res] = await Ledger.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$partyId',
        totalBilled: { $sum: '$debitAmount' },
        totalCollected: { $sum: '$creditAmount' }
      }
    },
    {
      $project: {
        outstandingBalance: { $subtract: ['$totalBilled', '$totalCollected'] }
      }
    }
  ]);

  return res?.outstandingBalance || 0;
}
```

---

## 9. Future-Proofing & Concurrency Lockdown Architecture

To guarantee the system never suffers from concurrency collisions, data corruption, or audit trail destruction:

1. **Gapless Sequence Concurrency Lock**:
   - Sequential voucher numbers (`PV/2026-27/0001`) are generated via MongoDB's atomic `findOneAndUpdate` with `$inc: { lastNo: 1 }`.
   - Backed by unique compound index: `{ firmId: 1, voucherNo: 1, fiscalYear: 1 }`.
2. **Snapshot Immutability Invariant**:
   - Point-in-time captions (`accountHead`, `gstin`, `pan`) are stored permanently inside each `Ledger` line document.
   - If a party later renames their legal business name, historical GSTR-1, Form 26Q, and Balance Sheet reports for prior years remain mathematically and legally authentic.
3. **Idempotent Reversal Locks**:
   - Before executing a reversal, the engine atomically acquires a lock:
     ```ts
     const locked = await Ledger.updateMany(
       { voucherGroupId, isReversed: { $ne: true } },
       { $set: { isReversed: true, reversedAt: new Date() } },
       { session }
     );
     if (locked.modifiedCount === 0) {
       throw new Error('Voucher is already reversed or does not exist');
     }
     ```
   - This completely eliminates duplicate reversal postings from network retries or double-clicks.
4. **Cryptographic Period Lock Guard**:
   - Fiscal periods are sealed via `PeriodLock`.
   - Modifications inside closed periods require an internal cryptographic `SYSTEM_CLOSING_TOKEN`, preventing any unauthorized HTTP injection from altering audited accounts.

---

## 10. Migration & Implementation Phasing Plan

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                               ZERO-DOWNTIME ROLLOUT TIMELINE                                     │
├───────────────────┬─────────────────────────────────────────────────┬────────────────────────────┤
│ Phase             │ Scope & Actions                                 │ Backward Compatibility     │
├───────────────────┼─────────────────────────────────────────────────┼────────────────────────────┤
│ **Phase 1**       │ • Run `migrate_canonical_firm_id.mjs` (Done)    │ 100% (Mirrors firmId/_id)  │
│                   │ • Backfill `voucherType` on 1,766 legacy entries│ Zero amount modification   │
│                   │ • Enforce case-insensitive COA collation        │ Unique index preserved     │
├───────────────────┼─────────────────────────────────────────────────┼────────────────────────────┤
│ **Phase 2**       │ • Replace `deleteMany` in bill updates with JV  │ Audit trail preserved      │
│                   │ • Activate Integer-Paise Parity Guard           │ Eliminates float drift     │
│                   │ • Implement Dual-Read Query Facade in AR/AP/Adv │ Reads both old & new       │
├───────────────────┼─────────────────────────────────────────────────┼────────────────────────────┤
│ **Phase 3**       │ • Route all 12 modules through Event Router     │ Unified vouchers generated │
│                   │ • Continuous cross-DB reconciler active         │ Real-time parity monitor   │
└───────────────────┴─────────────────────────────────────────────────┴────────────────────────────┘
```

---

*This document is the authoritative architectural benchmark for double-entry financial integrity across the entire Nuxt 4 enterprise ERP.*
