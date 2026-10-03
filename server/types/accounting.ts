import mongoose from 'mongoose';

// ─────────────────────────────────────────────────────────────────────────
// VOUCHER TYPE ENUMERATION
// Covers all existing posting paths + new closing/opening types
// ─────────────────────────────────────────────────────────────────────────

export const VOUCHER_TYPES = [
  'SALES',
  'PURCHASE',
  'PAYMENT',
  'RECEIPT',
  'CONTRA',
  'JOURNAL',
  'CREDIT_NOTE',
  'DEBIT_NOTE',
  'STOCK_ADJUSTMENT',
  'OPENING_BALANCE',
  'CLOSING_ENTRY',
] as const;

export type VoucherType = typeof VOUCHER_TYPES[number];

// ─────────────────────────────────────────────────────────────────────────
// VOUCHER PREFIX MAP
// Used for gapless sequential voucher numbering: {PREFIX}/{FY}/{SEQ}
// ─────────────────────────────────────────────────────────────────────────

export const VOUCHER_PREFIX_MAP: Record<VoucherType, string> = {
  SALES: 'SI',
  PURCHASE: 'PI',
  PAYMENT: 'PV',
  RECEIPT: 'RV',
  CONTRA: 'CV',
  JOURNAL: 'JV',
  CREDIT_NOTE: 'CN',
  DEBIT_NOTE: 'DN',
  STOCK_ADJUSTMENT: 'SA',
  OPENING_BALANCE: 'OB',
  CLOSING_ENTRY: 'CL',
};

// ─────────────────────────────────────────────────────────────────────────
// VOUCHER LEG — One line within a double-entry voucher
// ─────────────────────────────────────────────────────────────────────────

export interface IVoucherLeg {
  /** Ledger account head name (must match ChartOfAccounts.account_name) */
  accountHead: string;

  /** Account classification (ASSET, LIABILITY, INCOME, EXPENSE, etc.) */
  accountType?: string;

  /** Amount debited on this leg. Must be >= 0. */
  debitAmount: number;

  /** Amount credited on this leg. Must be >= 0. */
  creditAmount: number;

  /** Party reference — REQUIRED for SUNDRY_DEBTORS, SUNDRY_CREDITORS, LABOR_LEADER */
  partyId?: mongoose.Types.ObjectId | string | null;

  /** Bank account reference — for bank-related legs */
  bankAccountId?: mongoose.Types.ObjectId | string | null;

  /** Stock item reference — for inventory legs */
  stockId?: mongoose.Types.ObjectId | string | null;

  /** Stock register reference — for inventory movement legs */
  stockRegId?: mongoose.Types.ObjectId | string | null;

  /** Per-leg narration (overrides voucher-level narration) */
  narration?: string;

  /** Payment mode on this specific leg (CASH, NEFT, RTGS, UPI, etc.) */
  paymentMode?: string | null;
}

// ─────────────────────────────────────────────────────────────────────────
// VOUCHER PAYLOAD — The single input contract for all posting operations
// ─────────────────────────────────────────────────────────────────────────

export interface IVoucherPayload {
  /** Firm isolation key */
  firmId: mongoose.Types.ObjectId | string;

  /** Type of voucher — determines prefix for voucher numbering */
  voucherType: VoucherType;

  /** Date of the transaction — YYYY-MM-DD format. Subject to period lock check. */
  transactionDate: string;

  /** External reference (Bill No, Cheque No, UTR, etc.) */
  referenceNo?: string;

  /** Primary narration for the entire voucher */
  narration: string;

  /** Double-entry legs. Sum(DR) must === Sum(CR) within tolerance. */
  legs: IVoucherLeg[];

  /** Username of the creator */
  createdBy: string;

  /**
   * Cross-module metadata tags. Not stored in the Ledger directly,
   * but can be used for linking to upstream records:
   *   { laborPeriodId, bulkPaymentId, billId, masterRollId, wageId, advanceId }
   */
  tags?: Record<string, any>;

  /**
   * Reference type for the voucher (BILL, VOUCHER, ADVANCE, WAGE, STOCK_MOVEMENT, etc.)
   * Used for traceability back to upstream documents.
   */
  refType?: string;

  /**
   * Reference document ID (Bill._id, Advance._id, etc.)
   */
  refId?: mongoose.Types.ObjectId | string;

  /**
   * If provided, the engine will use this externally-provided voucherGroupId
   * instead of generating a new one. Used for backward-compat with legacy
   * callers that already have a batch ID (e.g. bulk payments).
   */
  externalVoucherGroupId?: string;

  /**
   * If true, the engine will skip generating a new sequential voucherNo
   * and use the provided externalVoucherNo instead.
   */
  externalVoucherNo?: string;

  /**
   * If true, skip the period lock check. Used ONLY by the Year-End Closing
   * service which must write into the locked period as part of the close.
   * This flag is stripped at the API boundary and CANNOT be set by end-users.
   */
  _bypassPeriodLock?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────
// POSTING RESULT — Returned by UnifiedPostingService.postVoucher()
// ─────────────────────────────────────────────────────────────────────────

export interface IPostingResult {
  /** Whether the posting succeeded */
  success: boolean;

  /** The assigned or reused voucher group ID */
  voucherGroupId: string;

  /** The formal sequential voucher number (e.g. PV/2026-27/0012) */
  voucherNo: string;

  /** Number of ledger entries created */
  entryCount: number;

  /** Sum of debits (should equal sum of credits) */
  totalDebit: number;

  /** Sum of credits */
  totalCredit: number;
}

// ─────────────────────────────────────────────────────────────────────────
// BALANCE SHEET CLASSIFICATION
// ─────────────────────────────────────────────────────────────────────────
// UNIVERSAL MASTER ACCOUNT TYPES
// Canonical 16 Universal Master Account Types defined in ERP Chart of Accounts
// ─────────────────────────────────────────────────────────────────────────

export const UNIVERSAL_MASTER_ACCOUNT_TYPES = [
  // 👥 Trade Parties
  'SUNDRY_DEBTORS',
  'SUNDRY_CREDITORS',
  'TRANSPORTER',
  // 👷 People & Labor
  'CASUAL_LABOR',
  'LABOR_LEADER',
  'STAFF',
  // 💼 Capital & Loans
  'LOANS_BORROWINGS',
  'LOANS_ADVANCES',
  'CAPITAL',
  // 📊 Expenses & Income
  'DIRECT_EXPENSE',
  'EXPENSE',
  'INCOME',
  // 🏦 Treasury & Assets
  'BANK',
  'CASH',
  'DUTIES_AND_TAXES',
  'FIXED_ASSETS',
] as const;

export type UniversalMasterAccountType = typeof UNIVERSAL_MASTER_ACCOUNT_TYPES[number];

// ─────────────────────────────────────────────────────────────────────────
// BALANCE SHEET & PROFIT AND LOSS CLASSIFICATION
// Determines whether an account type is P&L (temporary) or BS (permanent).
// This is critical for year-end closing: P&L accounts get zeroed, BS carry forward.
// ─────────────────────────────────────────────────────────────────────────

/** Account types that are P&L (temporary) — zeroed at year-end */
export const PNL_ACCOUNT_TYPES = new Set([
  'INCOME',
  'EXPENSE',
  'INDIRECT_INCOME',
  'INDIRECT_EXPENSE',
  'DIRECT_EXPENSE',
  'DIRECT_INCOME',
  'COGS',
  'CASUAL_LABOR',
]);

/** Account types that are Balance Sheet (permanent) — carry forward */
export const BALANCE_SHEET_ACCOUNT_TYPES = new Set([
  'ASSET',
  'LIABILITY',
  'CAPITAL',
  'PAYABLE',
  'CASH',
  'BANK',
  'BANK_ACCOUNT',
  'SUNDRY_DEBTORS',
  'SUNDRY_CREDITORS',
  'DEBTOR',
  'CREDITOR',
  'RECEIVABLE',
  'LABOR_LEADER',
  'TRANSPORTER',
  'STAFF',
  'LOANS_BORROWINGS',
  'LOANS_ADVANCES',
  'DUTIES_AND_TAXES',
  'FIXED_ASSETS',
  'GENERAL',
]);

/**
 * Strictly classifies an account type as 'PNL' or 'BALANCE_SHEET'.
 * Throws an explicit error if an unrecognized account type is encountered (no silent fallbacks).
 */
export function classifyAccountType(accountType: string): 'PNL' | 'BALANCE_SHEET' {
  const normalized = (accountType || '').toUpperCase().trim();
  if (PNL_ACCOUNT_TYPES.has(normalized)) return 'PNL';
  if (BALANCE_SHEET_ACCOUNT_TYPES.has(normalized)) return 'BALANCE_SHEET';
  throw new Error(`[ERP Accounting Invariant] Unrecognized account type '${accountType}'. Every ledger account must belong to a registered Chart of Accounts category.`);
}

// ─────────────────────────────────────────────────────────────────────────
// ACCOUNT TYPES THAT REQUIRE PARTY ID
// If a voucher leg posts to one of these types, partyId is mandatory.
// ─────────────────────────────────────────────────────────────────────────

export const PARTY_REQUIRED_ACCOUNT_TYPES = new Set([
  'SUNDRY_DEBTORS',
  'SUNDRY_CREDITORS',
]);

// ─────────────────────────────────────────────────────────────────────────
// DOUBLE-ENTRY TOLERANCE
// Maximum allowed absolute difference between sum(DR) and sum(CR)
// before the engine rejects the voucher. Set to 1 paisa.
// ─────────────────────────────────────────────────────────────────────────

export const DOUBLE_ENTRY_TOLERANCE = 0.01;
