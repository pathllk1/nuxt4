# Offline Accounting Architecture & Synchronization Contract

**Document Version:** 1.0.0  
**Effective Date:** 2026-11-13  
**Status:** Canonical ERP Standard  
**Related Audit Finding:** [A-13 — Offline Accounting Parallel Engine](../../docs/UNIFIED_ACCOUNTING_SYSTEM_DEEP_AUDIT.md#a-13--offline-accounting-is-a-parallel-engine-not-proven-parity-with-the-central-gl)

---

## 1. System Boundary & Source of Truth

In accordance with statutory accounting standards (Companies Act, GST regulations, and GAAP/IFRS), an enterprise enterprise-resource-planning system must maintain exactly **one authoritative General Ledger**.

1. **Central MongoDB General Ledger (Online ERP)**:
   - **Status**: The **Single Source of Truth (SSOT)** for all financial, statutory, audit, tax, and reporting matters.
   - **Authority**: Only vouchers committed to the central MongoDB `Ledger` via `UnifiedPostingService.postVoucher()` with strict double-entry validation, gapless sequence generation, and firm isolation constitute official financial records.
   - **Reporting Scope**: Trial Balance, Profit & Loss, Balance Sheet, GST returns (GSTR-1, GSTR-3B), TDS returns (26Q), and Party Statements are calculated **exclusively** from the central General Ledger.

2. **Edge Client SQLite Store (`offline-app`)**:
   - **Status**: **Disconnected Edge Buffer & Local Draft Cache**.
   - **Scope**: Allows field operators to record preliminary vouchers, bill drafts, and transactions when internet connectivity is unavailable.
   - **Constraint**: Data stored inside the offline SQLite database is classified as **LOCAL_UNCONSOLIDATED_DRAFT**. It must never be treated as authoritative financial history until synchronized.

---

## 2. Invariant Rules for Offline Financial Postings

To prevent data corruption, ledger divergence, and sequence collisions:

1. **No Authoritative Sequence Numbers in SQLite**:
   - The offline client must **never** generate authoritative FY sequence numbers (e.g., `PV/2026-2027/0001`).
   - Sequence generation requires distributed atomic locks (`VoucherSequence`) available only on the central cluster.
   - The offline app must assign a temporary UUID `clientVoucherId` (e.g., `OFFLINE-UUID-94a2b1...`).

2. **Transactional Outbox Model**:
   - Offline transactions must be written to an `outbox_sync_queue` table in SQLite.
   - The queue records:
     - `clientVoucherId`: UUIDv4
     - `firmId`: Firm ObjectId
     - `payload`: JSON string matching `IPostVoucherParams`
     - `syncStatus`: `PENDING` | `IN_FLIGHT` | `SYNCED` | `REJECTED`
     - `syncedAt`: Timestamp
     - `centralVoucherGroupId`: String (populated upon successful server confirmation)

3. **Server-Side Idempotency Guard**:
   - When the client reconnects, vouchers are posted to the central endpoint `POST /api/accounting/vouchers`.
   - The central `UnifiedPostingService` validates `clientVoucherId`:
     - If the `clientVoucherId` already exists in `Ledger` for that firm, the server returns the existing voucher details without inserting duplicate legs.
     - Central sequential numbers (`voucherGroupId` and `voucherNo`) are assigned atomically.
   - Once the server returns HTTP 200, the offline client updates `syncStatus = 'SYNCED'`.

4. **UI Clear Labeling Requirement**:
   - The offline application UI must visibly label balances as:
     > *"Local Unsynced Device Balance — Official statutory statements must be viewed on the online portal."*

---

## 3. Discrepancy Reconciliation

If an offline transaction is rejected by the central engine (for instance, due to a period lock, negative amount invariant violation, or deleted party master):
1. The outbox item is marked `REJECTED` with the server error message.
2. The user is prompted to resolve the discrepancy in the offline reconciliation center.
3. No partial or unbalanced legs are ever written to the central General Ledger.

