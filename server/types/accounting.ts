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

export interface IStatutoryMetadata {
  tdsSection?: '194C' | '194J' | '194I' | '194H' | '194A' | '194Q' | '192' | '195' | string;
  tdsRate?: number;
  isGrossUp?: boolean;
  deducteePan?: string;
  deducteeType?: '01' | '02'; // 01 = Company, 02 = Non-Company
  gstin?: string;
  hsnSac?: string;
  gstRate?: number;
}

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

  /** Structured Statutory Tax Metadata (TDS / GST) for Form 26Q & GSTR */
  statutory?: IStatutoryMetadata;
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

  /**
   * Internal flag used by multi-leg transaction wrappers to prevent nested barrier acquisition (F-01).
   */
  _bypassBarrier?: boolean;
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

  /** True if this result was returned idempotently from an existing committed voucher */
  isIdempotentReplay?: boolean;
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
  'GENERAL',
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
  'DEBTOR',
  'CREDITOR',
]);

// ─────────────────────────────────────────────────────────────────────────
// INTEGER-PAISE ARITHMETIC UTILITIES (ELIMINATING IEEE-754 FLOATING POINT DRIFT)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Normalizes any monetary value in Rupees to exact integer Paise (cents).
 * Formula: Math.round((Number(rupees) + Number.EPSILON) * 100)
 */
export const toPaise = (rupees: number | string | null | undefined): number => {
  if (rupees === null || rupees === undefined) return 0;
  const num = typeof rupees === 'string' ? parseFloat(rupees) : Number(rupees);
  if (isNaN(num)) return 0;
  return Math.round((num + Number.EPSILON) * 100);
};

/**
 * Converts integer Paise back to decimal Rupees.
 */
export const fromPaise = (paise: number): number => {
  return Number((paise / 100).toFixed(2));
};

// ─────────────────────────────────────────────────────────────────────────
// CANONICAL 4-DIGIT STATUTORY ACCOUNT CODES (1000–5999)
// ─────────────────────────────────────────────────────────────────────────

export const ACCOUNT_CODE_MAP: Record<string, string> = {
  CASH: '1100',
  BANK: '1200',
  BANK_ACCOUNT: '1200',
  SUNDRY_DEBTORS: '1300',
  DEBTOR: '1300',
  RECEIVABLE: '1300',
  LOANS_ADVANCES: '1400',
  EMPLOYEE_ADVANCE: '1410',
  LABOR_ADVANCE: '1420',
  SITE_IMPREST: '1430',
  FIXED_ASSETS: '1500',
  ASSET: '1500',
  SUNDRY_CREDITORS: '2100',
  CREDITOR: '2100',
  PAYABLE: '2100',
  TRANSPORTER: '2150',
  SUBCONTRACTOR_PAYABLE: '2150',
  RETENTION_PAYABLE: '2160',
  LABOR_LEADER: '2210',
  LABOR_PAYABLE: '2210',
  DUTIES_AND_TAXES: '2300',
  LIABILITY: '2300',
  STAFF: '2410',
  SALARIES_PAYABLE: '2410',
  LOANS_BORROWINGS: '2500',
  CAPITAL: '3100',
  RESERVES_SURPLUS: '3200',
  INCOME: '4100',
  DIRECT_INCOME: '4200',
  INDIRECT_INCOME: '4300',
  ROUND_OFF_GAIN: '4990',
  DIRECT_EXPENSE: '5100',
  EXPENSE: '5200',
  INDIRECT_EXPENSE: '5200',
  CASUAL_LABOR: '5210',
  COGS: '5190',
  ROUND_OFF_LOSS: '5990',
};

// ─────────────────────────────────────────────────────────────────────────
// DOUBLE-ENTRY TOLERANCE
// Maximum allowed absolute difference between sum(DR) and sum(CR)
// before the engine rejects the voucher. Set to 1 paisa (0.01).
// ─────────────────────────────────────────────────────────────────────────

export const DOUBLE_ENTRY_TOLERANCE = 0.01;
