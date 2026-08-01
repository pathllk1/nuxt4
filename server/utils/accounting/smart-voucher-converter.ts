import mongoose from 'mongoose';
import { LedgerEntryParams } from './ledger.service';

export class SmartVoucherConverter {
  static convertToLedgerEntries(
    firmId: mongoose.Types.ObjectId,
    voucherId: number,
    voucherNo: string,
    vtype: string,
    vdate: string,
    mainAccount: string,
    entries: Array<{ accountHead: string; amount: number; type: string }>,
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
      return this.handleJournal(docs, base, mainAccount, entries);
    }

    return docs;
  }

  private static handlePayment(
    docs: LedgerEntryParams[],
    base: any,
    mainAccount: string,
    entries: Array<{ accountHead: string; amount: number; type: string }>
  ): LedgerEntryParams[] {
    const mainAmount = entries
      .filter(e => e.type === 'MAIN')
      .reduce((sum, e) => sum + e.amount, 0);

    const deductionsTotal = entries
      .filter(e => e.type === 'DEDUCTION')
      .reduce((sum, e) => sum + e.amount, 0);

    const taxTotal = entries
      .filter(e => e.type === 'TAX')
      .reduce((sum, e) => sum + e.amount, 0);

    const otherTotal = entries
      .filter(e => e.type === 'OTHER')
      .reduce((sum, e) => sum + e.amount, 0);

    const netAmount = mainAmount - deductionsTotal + taxTotal + otherTotal;

    // Credit bank/cash account (money going out)
    docs.push({
      ...base,
      accountHead: mainAccount,
      accountType: 'BANK',
      debitAmount: 0,
      creditAmount: netAmount
    });

    const mainEntries = entries.filter(e => e.type === 'MAIN');
    for (const entry of mainEntries) {
      docs.push({
        ...base,
        accountHead: entry.accountHead,
        accountType: 'PARTY',
        debitAmount: entry.amount,
        creditAmount: 0
      });
    }

    const deductionEntries = entries.filter(e => e.type === 'DEDUCTION');
    for (const entry of deductionEntries) {
      docs.push({
        ...base,
        accountHead: entry.accountHead,
        accountType: 'EXPENSE',
        debitAmount: 0,
        creditAmount: entry.amount
      });
    }

    const taxEntries = entries.filter(e => e.type === 'TAX');
    for (const entry of taxEntries) {
      docs.push({
        ...base,
        accountHead: entry.accountHead,
        accountType: 'EXPENSE',
        debitAmount: 0,
        creditAmount: entry.amount
      });
    }

    const otherEntries = entries.filter(e => e.type === 'OTHER');
    for (const entry of otherEntries) {
      docs.push({
        ...base,
        accountHead: entry.accountHead,
        accountType: 'EXPENSE',
        debitAmount: entry.amount,
        creditAmount: 0
      });
    }

    return docs;
  }

  private static handleReceipt(
    docs: LedgerEntryParams[],
    base: any,
    mainAccount: string,
    entries: Array<{ accountHead: string; amount: number; type: string }>
  ): LedgerEntryParams[] {
    const mainAmount = entries
      .filter(e => e.type === 'MAIN')
      .reduce((sum, e) => sum + e.amount, 0);

    const deductionsTotal = entries
      .filter(e => e.type === 'DEDUCTION')
      .reduce((sum, e) => sum + e.amount, 0);

    const netAmount = mainAmount - deductionsTotal;

    docs.push({
      ...base,
      accountHead: mainAccount,
      accountType: 'BANK',
      debitAmount: netAmount,
      creditAmount: 0
    });

    const mainEntries = entries.filter(e => e.type === 'MAIN');
    for (const entry of mainEntries) {
      docs.push({
        ...base,
        accountHead: entry.accountHead,
        accountType: 'PARTY',
        debitAmount: 0,
        creditAmount: entry.amount
      });
    }

    const deductionEntries = entries.filter(e => e.type === 'DEDUCTION');
    for (const entry of deductionEntries) {
      docs.push({
        ...base,
        accountHead: entry.accountHead,
        accountType: 'EXPENSE',
        debitAmount: entry.amount,
        creditAmount: 0
      });
    }

    return docs;
  }

  private static handleJournal(
    docs: LedgerEntryParams[],
    base: any,
    mainAccount: string,
    entries: Array<{ accountHead: string; amount: number; type: string }>
  ): LedgerEntryParams[] {
    for (const entry of entries) {
      if (entry.type === 'MAIN' || entry.type === 'OTHER') {
        docs.push({
          ...base,
          accountHead: entry.accountHead,
          accountType: 'ASSET',
          debitAmount: entry.amount,
          creditAmount: 0
        });
      } else if (entry.type === 'DEDUCTION') {
        docs.push({
          ...base,
          accountHead: entry.accountHead,
          accountType: 'ASSET',
          debitAmount: 0,
          creditAmount: entry.amount
        });
      }
    }

    return docs;
  }
}
