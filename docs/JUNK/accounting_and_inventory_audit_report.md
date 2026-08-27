# Comprehensive Audit Report: Accounting & Inventory Systems (Nuxt 4)

## Executive Summary

A deep technical audit was conducted on the **Accounting** and **Inventory** subsystems in `nuxt4` across frontend composables, Vue pages, API routes, database models, and backend calculation services.

Multiple high-severity logical bugs, API call parameter mismatches, race conditions, floating-point drift issues, and financial statement imbalance flaws were identified.

---

## Part 1: Accounting System Audit & Bug Findings

### 1.1 Balance Sheet Financial Imbalance & Hardcoded Zero Calculations
* **File**: `server/utils/accounting/ledger.service.ts` (`getBalanceSheetModel`)
* **Severity**: High
* **Issue**:
  - In `getBalanceSheetModel`, the following core balance sheet line items are hardcoded to `0`:
    ```ts
    const totalStock = 0;
    const totalCred = 0;
    const totalDebtors = 0;
    const totalCashBank = 0;
    const totalDebtorCreditBalances = 0;
    const totalCashBankCreditBalances = 0;
    ```
  - `totalLiabSide` is calculated as `capital + plModel.netProfit`, while `totalAssets` is aggregated from raw asset ledger debit amounts.
  - **Impact**: The generated Balance Sheet totals fail to balance for real business data. Sundry Debtors, Sundry Creditors, Cash/Bank balances, and Closing Stock are omitted from financial position reports.

### 1.2 Floating-Point Ledger Imbalance Threshold Error
* **File**: `server/utils/accounting/ledger.service.ts` (`assertBalanced`)
* **Severity**: Medium
* **Issue**:
  - `assertBalanced` checks `const diff = Math.abs(totals.debit - totals.credit); if (diff >= 0.01) throw new Error(...)`.
  - Floating-point additions (e.g. `0.1 + 0.2 = 0.30000000000000004`) can produce fractional differences around `0.010000000000000009` during multi-item tax rounding.
  - **Impact**: Valid, mathematically balanced vouchers occasionally get rejected with `Unbalanced SALES/PURCHASE ledger` errors.

### 1.3 Missing COGS Posting on Non-Stock Service Items
* **File**: `server/api/accounting/sales.post.ts`
* **Severity**: Low / Edge Case
* **Issue**:
  - When cart items are marked as services (`isServiceItem(item)`), they bypass stock updates (correct behavior). However, if an item is missing `stockId` but is not classified as a service, it skips COGS line generation without logging a warning.

---

## Part 2: Inventory System Audit & Bug Findings

### 2.1 API Query Parameter Misconfiguration in `useInventory.ts`
* **File**: `app/composables/useInventory.ts` (`fetchMovements`, `fetchSalesAnalysis`)
* **Severity**: High
* **Issue**:
  - `fetchMovements` calls `api.get('/inventory/movements', params)`.
  - In `app/utils/api.ts`, `api.get(url, options)` expects search parameters wrapped inside `{ params }` (e.g. `api.get(url, { params })`).
  - Passing `params` directly as the second argument sets `options.params` to `undefined`.
  - **Impact**: Search filters (`type`, `stockId`, `page`, `limit`) and date ranges (`startDate`, `endDate`) are completely dropped from HTTP request URLs. Stock movement and sales analysis reports always load unfiltered datasets.

### 2.2 Race Condition in Duplicate Item Creation
* **File**: `server/utils/inventory/stock.service.ts` (`updateStockInward`)
* **Severity**: High
* **Issue**:
  - `updateStockInward` performs a non-atomic `StockModel.findOne({ item })` followed by `StockModel.create()`.
  - If two purchase bills or stock entry forms containing a new item name are submitted concurrently, both requests see `findOne` return `null` and create separate `Stock` documents for the same item name.
  - **Impact**: Duplicate inventory records are created in MongoDB for the same item name within the same firm.

### 2.3 Non-Batched Item Update Failures via Null Array Filters
* **File**: `server/utils/inventory/stock.service.ts` (`updateStockOutward`, `updateStockInward`)
* **Severity**: High
* **Issue**:
  - `updateStockOutward` passes `arrayFilters: [{ 'elem.batch': itemData.batch || null }]`.
  - For inventory items that do not use batch tracking, batch properties in MongoDB array subdocuments are `undefined` or omitted.
  - MongoDB `findOneAndUpdate` fails to match `{ 'elem.batch': null }` against subdocuments where `batch` is missing.
  - **Impact**: Executing a sales invoice or stock outward for non-batched items throws an error: `Failed to update stock for item ... Batch not found.`

### 2.4 Floating-Point Residual Drift in Total Stock Valuation
* **File**: `server/utils/inventory/stock.service.ts` (`updateStockOutward`)
* **Severity**: Medium
* **Issue**:
  - `updateStockOutward` decrements stock value by `cogsValue = itemData.qty * wacCostRate`.
  - Because `wacCostRate` is rounded to 6 decimal places, when item `qty` reaches `0`, `stock.total` retains non-zero residual numbers (e.g. `0.000004` or `-0.002`).
  - **Impact**: When new stock arrives later, `blendedRate` (`newTotal / newQty`) incorporates the residual floating-point number, introducing slight valuation distortions.

---

## Part 3: Recommended Action & Fix Plan

1. **Fix `useInventory.ts` API Calls**:
   - Wrap parameter objects in `{ params }` for `fetchMovements` and `fetchSalesAnalysis`.
2. **Fix `stock.service.ts` Batch Array Filters**:
   - Handle null/undefined batch matching gracefully in MongoDB array filters.
3. **Fix `stock.service.ts` Floating-Point Valuation**:
   - When stock `qty` reaches `0`, force `stock.total = 0` and `stock.rate = 0`.
4. **Fix `ledger.service.ts` Balance Sheet Calculation**:
   - Dynamically aggregate closing stock, sundry debtors, sundry creditors, and cash/bank sub-ledger totals into `getBalanceSheetModel`.
