import mongoose from 'mongoose';
import type { LedgerEntryParams } from './ledger.service';

export interface VoucherLineInput {
  accountHead: string;
  amount?: number;
  debitAmount?: number;
  creditAmount?: number;
  accountType?: string;
  type?: string;
  laborPeriodId?: string;
}

export class SmartVoucherConverter {
  static convertToLedgerEntries(
    firmId: mongoose.Types.ObjectId,
    voucherId: number,
    voucherNo: string,
    vtype: string,
    vdate: string,
    mainAccount: string,
    entries: VoucherLineInput[],
    narration: string,
    createdBy: string
  ): LedgerEntryParams[] {
    const docs: LedgerEntryParams[] = [];
    const base = {
      firmId,
      transactionDate: vdate,
      voucherGroupId: voucherId.toString(),
      voucherNo,
      voucherType: vtype,
      createdBy,
      narration
    };

    if (vtype === 'PAYMENT') {
      return this.handlePayment(docs, base, mainAccount, entries);
    } else if (vtype === 'RECEIPT') {
      return this.handleReceipt(docs, base, mainAccount, entries);
    } else if (vtype === 'JOURNAL') {
      return this.handleJournal(docs, base, entries);
    }

    return docs;
  }

  /**
   * Tally Single-Entry Payment Voucher
   * - Positive line amount: Debit party/expense (e.g. ₹5,050 Dr)
   * - Negative line amount: Credit deduction/TDS/discount (e.g. ₹50 Cr)
   * - Net Bank/Cash Outflow: Credit Bank/Cash account (e.g. ₹5,000 Cr)
   * Mathematical proof: Total Debits (5050) = Total Credits (5000 + 50)
   */
  private static handlePayment(
    docs: LedgerEntryParams[],
    base: any,
    mainAccount: string,
    entries: VoucherLineInput[]
  ): LedgerEntryParams[] {
    let totalDebit = 0;
    let totalDeductions = 0;

    for (const entry of entries) {
      const amt = Number(entry.amount) || 0;
      if (amt === 0) continue;

      if (amt > 0) {
        // Normal payment/expense/party line -> DEBIT
        totalDebit += amt;
        docs.push({
          ...base,
          accountHead: entry.accountHead,
          accountType: entry.accountType || 'EXPENSE',
          debitAmount: amt,
          creditAmount: 0
        });
      } else {
        // Negative amount (Deduction/TDS/Discount/Recovery) -> CREDIT
        const positiveDeduction = Math.abs(amt);
        totalDeductions += positiveDeduction;
        docs.push({
          ...base,
          accountHead: entry.accountHead,
          accountType: entry.accountType || 'LIABILITY',
          debitAmount: 0,
          creditAmount: positiveDeduction
        });
      }
    }

    const netBankPayout = totalDebit - totalDeductions;
    if (netBankPayout < 0) {
      throw new Error(`Invalid Payment Voucher: Total deductions (₹${totalDeductions.toFixed(2)}) exceed gross payout (₹${totalDebit.toFixed(2)}). Net amount cannot be negative.`);
    }

    // Credit Bank / Cash with actual net outflow
    docs.push({
      ...base,
      accountHead: mainAccount,
      accountType: 'BANK',
      debitAmount: 0,
      creditAmount: netBankPayout
    });

    return docs;
  }

  /**
   * Tally Single-Entry Receipt Voucher
   * - Positive line amount: Credit customer/income (e.g. ₹10,000 Cr)
   * - Negative line amount: Debit deduction/gateway charge/TDS receivable (e.g. ₹200 Dr)
   * - Net Bank/Cash Inflow: Debit Bank/Cash account (e.g. ₹9,800 Dr)
   * Mathematical proof: Total Debits (9800 + 200) = Total Credits (10000)
   */
  private static handleReceipt(
    docs: LedgerEntryParams[],
    base: any,
    mainAccount: string,
    entries: VoucherLineInput[]
  ): LedgerEntryParams[] {
    let totalCredit = 0;
    let totalDeductions = 0;

    for (const entry of entries) {
      const amt = Number(entry.amount) || 0;
      if (amt === 0) continue;

      if (amt > 0) {
        // Normal receipt from customer/income -> CREDIT
        totalCredit += amt;
        docs.push({
          ...base,
          accountHead: entry.accountHead,
          accountType: entry.accountType || 'PARTY',
          debitAmount: 0,
          creditAmount: amt
        });
      } else {
        // Negative amount (Deduction/Gateway charge/Customer TDS) -> DEBIT
        const positiveDeduction = Math.abs(amt);
        totalDeductions += positiveDeduction;
        docs.push({
          ...base,
          accountHead: entry.accountHead,
          accountType: entry.accountType || 'EXPENSE',
          debitAmount: positiveDeduction,
          creditAmount: 0
        });
      }
    }

    const netBankInflow = totalCredit - totalDeductions;
    if (netBankInflow < 0) {
      throw new Error(`Invalid Receipt Voucher: Total deductions (₹${totalDeductions.toFixed(2)}) exceed gross receipt (₹${totalCredit.toFixed(2)}). Net amount cannot be negative.`);
    }

    // Debit Bank / Cash with actual net inflow
    docs.push({
      ...base,
      accountHead: mainAccount,
      accountType: 'BANK',
      debitAmount: netBankInflow,
      creditAmount: 0
    });

    return docs;
  }

  /**
   * Pure Double-Entry Journal Voucher
   */
  private static handleJournal(
    docs: LedgerEntryParams[],
    base: any,
    entries: VoucherLineInput[]
  ): LedgerEntryParams[] {
    for (const entry of entries) {
      const dr = Number(entry.debitAmount) || 0;
      const cr = Number(entry.creditAmount) || 0;

      if (dr === 0 && cr === 0) continue;

      docs.push({
        ...base,
        accountHead: entry.accountHead,
        accountType: entry.accountType || 'GENERAL',
        debitAmount: dr,
        creditAmount: cr
      });
    }

    return docs;
  }
}
