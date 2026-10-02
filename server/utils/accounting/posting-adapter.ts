import mongoose from 'mongoose';
import { UnifiedPostingService } from './unified-posting.service';
import { type IVoucherPayload, type IVoucherLeg, type VoucherType, type IPostingResult } from '../../types/accounting';

// ─────────────────────────────────────────────────────────────────────────
// POSTING ADAPTER
//
// Translates legacy caller signatures (e.g. LedgerService.postSalesLedger)
// into the unified IVoucherPayload contract and delegates to
// UnifiedPostingService.postVoucher().
//
// This adapter exists so that legacy callers can be migrated incrementally:
//   1. Replace the internal implementation with the adapter
//   2. Keep the existing function signature unchanged
//   3. Callers don't need to change at all
//
// Once ALL callers are migrated, individual adapter methods can be removed
// and callers can be pointed directly at UnifiedPostingService.
//
// CAUTION: Each adapter method must exactly replicate the leg construction
// logic of the legacy function it replaces. Differences = regressions.
// ─────────────────────────────────────────────────────────────────────────

/**
 * Adapts a legacy LedgerService.postVoucherToLedger() call to the
 * unified posting engine.
 *
 * Legacy signature: postVoucherToLedger({ firmId, voucherId, voucherType,
 *   voucherNo, transactionDate, narration, entries, session }, createdBy)
 *
  * This is the most generic adapter — it can handle any voucher type
 * that already has pre-constructed ledger entries.
 */
export async function adaptLegacyVoucherPost(params: {
  firmId: mongoose.Types.ObjectId | string;
  voucherId: number | string;
  voucherType: string;
  voucherNo: string;
  transactionDate?: string;
  narration?: string;
  entries: any[];
  createdBy: string;
  refType?: string;
  refId?: any;
  session?: mongoose.ClientSession;
}): Promise<IPostingResult> {
  const {
    firmId, voucherId, voucherType, voucherNo,
    transactionDate, narration = '', entries, createdBy,
    refType = 'VOUCHER', refId, session,
  } = params;

  // Map legacy entries to IVoucherLeg format
  const legs: IVoucherLeg[] = entries.map((e: any) => ({
    accountHead: e.accountHead,
    accountType: e.accountType || 'GENERAL',
    debitAmount: Number(e.debitAmount) || 0,
    creditAmount: Number(e.creditAmount) || 0,
    partyId: e.partyId || null,
    bankAccountId: e.bankAccountId || null,
    stockId: e.stockId || null,
    stockRegId: e.stockRegId || null,
    narration: e.narration || narration,
    paymentMode: e.paymentMode || null,
  }));

  // Map the legacy voucherType string to our VoucherType enum
  const mappedType = mapLegacyVoucherType(voucherType);

  const payload: IVoucherPayload = {
    firmId,
    voucherType: mappedType,
    transactionDate: transactionDate || (new Date().toISOString().split('T')[0] as string),
    narration,
    legs,
    createdBy,
    refType,
    refId,
    // Preserve legacy IDs for backward compatibility
    externalVoucherGroupId: String(voucherId),
    externalVoucherNo: voucherNo,
  };

  return UnifiedPostingService.postVoucher(payload, session);
}

/**
 * Converts single-entry or double-entry voucher inputs from UI / API
 * into balanced IVoucherLeg[] ready for UnifiedPostingService.
 * Replaces SmartVoucherConverter.
 */
export function convertVoucherInputToLegs(params: {
  vtype: string;
  entries: any[];
  mainAccount?: string;
  bankAccountId?: mongoose.Types.ObjectId | string | null;
  narration?: string;
}): IVoucherLeg[] {
  const { vtype, entries, mainAccount, bankAccountId, narration = '' } = params;

  if (!entries || !Array.isArray(entries) || entries.length === 0) {
    throw new Error('Voucher must contain at least one entry');
  }

  // If mainAccount is provided, process Tally single-entry format
  if (mainAccount) {
    const legs: IVoucherLeg[] = [];
    const normalizedType = vtype.toUpperCase();

    if (normalizedType === 'PAYMENT') {
      let totalDebit = 0;
      let totalDeductions = 0;

      for (const entry of entries) {
        const amt = Number(entry.amount) || Number(entry.debitAmount) || 0;
        if (amt === 0) continue;

        if (amt > 0) {
          // Normal payment/expense/party line -> DEBIT
          totalDebit += amt;
          legs.push({
            accountHead: entry.accountHead,
            accountType: entry.accountType || 'EXPENSE',
            debitAmount: amt,
            creditAmount: 0,
            partyId: entry.partyId || null,
            narration: entry.narration || narration,
          });
        } else {
          // Negative amount (Deduction/TDS/Discount) -> CREDIT
          const positiveDeduction = Math.abs(amt);
          totalDeductions += positiveDeduction;
          legs.push({
            accountHead: entry.accountHead,
            accountType: entry.accountType || 'LIABILITY',
            debitAmount: 0,
            creditAmount: positiveDeduction,
            partyId: entry.partyId || null,
            narration: entry.narration || narration,
          });
        }
      }

      const netBankPayout = totalDebit - totalDeductions;
      if (netBankPayout < 0) {
        throw new Error(
          `Invalid Payment Voucher: Total deductions (₹${totalDeductions.toFixed(2)}) exceed gross payout (₹${totalDebit.toFixed(2)}).`
        );
      }

      legs.push({
        accountHead: mainAccount,
        accountType: 'BANK',
        debitAmount: 0,
        creditAmount: netBankPayout,
        bankAccountId: bankAccountId || null,
        narration,
      });

      return legs;
    } else if (normalizedType === 'RECEIPT') {
      let totalCredit = 0;
      let totalDeductions = 0;

      for (const entry of entries) {
        const amt = Number(entry.amount) || Number(entry.creditAmount) || 0;
        if (amt === 0) continue;

        if (amt > 0) {
          // Normal receipt from customer/income -> CREDIT
          totalCredit += amt;
          legs.push({
            accountHead: entry.accountHead,
            accountType: entry.accountType || 'SUNDRY_DEBTORS',
            debitAmount: 0,
            creditAmount: amt,
            partyId: entry.partyId || null,
            narration: entry.narration || narration,
          });
        } else {
          // Negative amount (Deduction/Gateway charge) -> DEBIT
          const positiveDeduction = Math.abs(amt);
          totalDeductions += positiveDeduction;
          legs.push({
            accountHead: entry.accountHead,
            accountType: entry.accountType || 'EXPENSE',
            debitAmount: positiveDeduction,
            creditAmount: 0,
            partyId: entry.partyId || null,
            narration: entry.narration || narration,
          });
        }
      }

      const netBankInflow = totalCredit - totalDeductions;
      if (netBankInflow < 0) {
        throw new Error(
          `Invalid Receipt Voucher: Total deductions (₹${totalDeductions.toFixed(2)}) exceed gross receipt (₹${totalCredit.toFixed(2)}).`
        );
      }

      legs.push({
        accountHead: mainAccount,
        accountType: 'BANK',
        debitAmount: netBankInflow,
        creditAmount: 0,
        bankAccountId: bankAccountId || null,
        narration,
      });

      return legs;
    } else if (normalizedType === 'CONTRA') {
      let totalTransfer = 0;
      for (const entry of entries) {
        const amt = Number(entry.amount) || Number(entry.debitAmount) || 0;
        if (amt === 0) continue;

        totalTransfer += amt;
        legs.push({
          accountHead: entry.accountHead,
          accountType: entry.accountType || 'BANK',
          debitAmount: amt > 0 ? amt : 0,
          creditAmount: amt < 0 ? Math.abs(amt) : 0,
          partyId: entry.partyId || null,
          narration: entry.narration || narration,
        });
      }

      if (totalTransfer !== 0) {
        legs.push({
          accountHead: mainAccount,
          accountType: 'BANK',
          debitAmount: totalTransfer < 0 ? Math.abs(totalTransfer) : 0,
          creditAmount: totalTransfer > 0 ? totalTransfer : 0,
          bankAccountId: bankAccountId || null,
          narration,
        });
      }

      return legs;
    }
  }

  // Standard double-entry format (e.g. JOURNAL or manual line entries)
  return entries.map((e: any) => ({
    accountHead: e.accountHead,
    accountType: e.accountType || 'GENERAL',
    debitAmount: Number(e.debitAmount) || 0,
    creditAmount: Number(e.creditAmount) || 0,
    partyId: e.partyId || null,
    bankAccountId: e.bankAccountId || null,
    stockId: e.stockId || null,
    stockRegId: e.stockRegId || null,
    narration: e.narration || narration,
    paymentMode: e.paymentMode || null,
  }));
}

/**
 * Adapts a legacy labor advance posting to the unified engine.
 *
 * Legacy: laborLedgerHelper.postLaborAdvance(params)
 * This adapter constructs the proper 2-leg payment voucher.
 */
export async function adaptLaborAdvancePost(params: {
  firmId: mongoose.Types.ObjectId | string;
  amount: number;
  paymentDate: string;
  leaderAccountHead: string;
  leaderAccountType: string;
  paymentAccountHead: string;
  paymentAccountType: string;
  bankAccountId?: string | null;
  paymentMode: string;
  leaderName: string;
  createdBy: string;
  session: mongoose.ClientSession;
}): Promise<IPostingResult> {
  const legs: IVoucherLeg[] = [
    {
      // Debit: Labor Leader Account (asset: advance given)
      accountHead: params.leaderAccountHead,
      accountType: params.leaderAccountType,
      debitAmount: params.amount,
      creditAmount: 0,
      narration: `Labor Advance to ${params.leaderName} (${params.paymentMode})`,
    },
    {
      // Credit: Cash / Bank Account (funds leaving firm)
      accountHead: params.paymentAccountHead,
      accountType: params.paymentAccountType,
      debitAmount: 0,
      creditAmount: params.amount,
      bankAccountId: params.bankAccountId || null,
      paymentMode: params.paymentMode,
      narration: `Labor Advance to ${params.leaderName} (${params.paymentMode})`,
    },
  ];

  const payload: IVoucherPayload = {
    firmId: params.firmId,
    voucherType: 'PAYMENT',
    transactionDate: params.paymentDate,
    narration: `Labor Advance to ${params.leaderName} (${params.paymentMode})`,
    legs,
    createdBy: params.createdBy,
    refType: 'ADVANCE',
    tags: { laborLeaderName: params.leaderName },
  };

  return UnifiedPostingService.postVoucher(payload, params.session);
}

/**
 * Adapts a legacy labor settlement posting to the unified engine.
 *
 * Legacy: laborLedgerHelper.postLaborSettlement(params)
 * This constructs the multi-leg journal + payment voucher.
 */
export async function adaptLaborSettlementPost(params: {
  firmId: mongoose.Types.ObjectId | string;
  totalGrossLiability: number;
  paidAmount: number;
  adjustmentAmount: number;
  adjustmentReason?: string;
  paymentDate: string;
  leaderAccountHead: string;
  leaderAccountType: string;
  expenseAccountHead: string;
  expenseAccountType: string;
  paymentAccountHead: string;
  paymentAccountType: string;
  adjustmentAccountHead?: string;
  adjustmentAccountType?: string;
  bankAccountId?: string | null;
  paymentMode: string;
  leaderName: string;
  createdBy: string;
  session: mongoose.ClientSession;
}): Promise<IPostingResult> {
  const legs: IVoucherLeg[] = [
    // 1. Debit: Labor Wages & Expenses (cost to firm)
    {
      accountHead: params.expenseAccountHead,
      accountType: params.expenseAccountType,
      debitAmount: params.totalGrossLiability,
      creditAmount: 0,
      narration: `Final settlement for ${params.leaderName}`,
    },
    // 2. Credit: Labor Leader Account (gross liability)
    {
      accountHead: params.leaderAccountHead,
      accountType: params.leaderAccountType,
      debitAmount: 0,
      creditAmount: params.totalGrossLiability,
      narration: `Settlement liability - ${params.leaderName}`,
    },
    // 3. Credit: Cash / Bank (funds leaving firm)
    {
      accountHead: params.paymentAccountHead,
      accountType: params.paymentAccountType,
      debitAmount: 0,
      creditAmount: params.paidAmount,
      bankAccountId: params.bankAccountId || null,
      paymentMode: params.paymentMode,
      narration: `Final payout for ${params.leaderName} (${params.paymentMode})`,
    },
    // 4. Debit: Labor Leader Account (clear liability against payout)
    {
      accountHead: params.leaderAccountHead,
      accountType: params.leaderAccountType,
      debitAmount: params.paidAmount,
      creditAmount: 0,
      narration: `Final payout for ${params.leaderName}`,
    },
  ];

  // 5. Handle Adjustment / Discount
  if (Math.abs(params.adjustmentAmount) > 0.01 && params.adjustmentAccountHead) {
    legs.push({
      accountHead: params.adjustmentAccountHead,
      accountType: params.adjustmentAccountType || 'INCOME',
      debitAmount: params.adjustmentAmount < 0 ? Math.abs(params.adjustmentAmount) : 0,
      creditAmount: params.adjustmentAmount > 0 ? params.adjustmentAmount : 0,
      narration: `Settlement adjustment: ${params.adjustmentReason || 'Dispute/Rounding'}`,
    });

    legs.push({
      accountHead: params.leaderAccountHead,
      accountType: params.leaderAccountType,
      debitAmount: params.adjustmentAmount > 0 ? params.adjustmentAmount : 0,
      creditAmount: params.adjustmentAmount < 0 ? Math.abs(params.adjustmentAmount) : 0,
      narration: `Settlement adjustment clearing - ${params.leaderName}`,
    });
  }

  const payload: IVoucherPayload = {
    firmId: params.firmId,
    voucherType: 'JOURNAL',
    transactionDate: params.paymentDate,
    narration: `Final settlement for ${params.leaderName}`,
    legs,
    createdBy: params.createdBy,
    refType: 'WAGE',
    tags: { laborLeaderName: params.leaderName },
  };

  return UnifiedPostingService.postVoucher(payload, params.session);
}

// ─────────────────────────────────────────────────────────────────────────
// VOUCHER TYPE MAPPING
// Maps legacy voucher type strings to the canonical VoucherType enum.
// ─────────────────────────────────────────────────────────────────────────

const LEGACY_VOUCHER_TYPE_MAP: Record<string, VoucherType> = {
  'SALES': 'SALES',
  'PURCHASE': 'PURCHASE',
  'PAYMENT': 'PAYMENT',
  'RECEIPT': 'RECEIPT',
  'CONTRA': 'CONTRA',
  'JOURNAL': 'JOURNAL',
  'CREDIT_NOTE': 'CREDIT_NOTE',
  'DEBIT_NOTE': 'DEBIT_NOTE',
  'STOCK_ADJUSTMENT': 'STOCK_ADJUSTMENT',
  'OPENING_BALANCE': 'OPENING_BALANCE',
  'CLOSING_ENTRY': 'CLOSING_ENTRY',
  // Legacy aliases
  'ACCOUNTING_SALES': 'SALES',
  'ACCOUNTING_PURCHASE': 'PURCHASE',
};

export function mapLegacyVoucherType(vtype: string): VoucherType {
  const mapped = LEGACY_VOUCHER_TYPE_MAP[vtype?.toUpperCase()];
  if (!mapped) {
    console.warn(`[PostingAdapter] Unknown voucher type "${vtype}", defaulting to JOURNAL`);
    return 'JOURNAL';
  }
  return mapped;
}
