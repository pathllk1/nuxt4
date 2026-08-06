import mongoose from 'mongoose';
import Ledger, { type ILedger } from '../../models/Ledger';
import ChartOfAccounts from '../../models/ChartOfAccounts';
import { resolveLedgerPostingAccount, normalizeLedgerAccountHead } from './ledger-account-resolver';

export interface LedgerEntryParams {
  firmId: mongoose.Types.ObjectId;
  transactionDate: string;
  accountHead: string;
  accountType: string;
  debitAmount: number;
  creditAmount: number;
  narration?: string;
  refType?: string;
  refId?: mongoose.Types.ObjectId;
  voucherGroupId?: string;
  voucherNo?: string;
  voucherType?: string;
  partyId?: mongoose.Types.ObjectId;
  stockId?: mongoose.Types.ObjectId;
  stockRegId?: mongoose.Types.ObjectId;
  bankAccountId?: mongoose.Types.ObjectId;
  paymentMode?: string;
  createdBy: string;
}

export class LedgerService {
  private static assertBalanced(entries: LedgerEntryParams[], voucherType: string, voucherNo: string) {
    const totals = entries.reduce((acc, entry) => {
      acc.debit += entry.debitAmount || 0;
      acc.credit += entry.creditAmount || 0;
      return acc;
    }, { debit: 0, credit: 0 });

    const diff = Math.abs(totals.debit - totals.credit);
    if (diff >= 0.01) {
      throw new Error(`Unbalanced ${voucherType} ledger for ${voucherNo}: DR ${totals.debit.toFixed(2)} vs CR ${totals.credit.toFixed(2)}`);
    }
  }

  static async initializeChartOfAccounts(
    firmId: mongoose.Types.ObjectId,
    userId: mongoose.Types.ObjectId | string,
    session?: mongoose.ClientSession
  ) {
    const DEFAULT_SYSTEM_ACCOUNTS = [
      { account_name: 'Salaries & Wages', account_type: 'EXPENSE', is_system: true },
      { account_name: 'EPF Payable', account_type: 'PAYABLE', is_system: true },
      { account_name: 'ESIC Payable', account_type: 'PAYABLE', is_system: true },
      { account_name: 'Other Deductions', account_type: 'PAYABLE', is_system: true },
      { account_name: 'Advance to Employees', account_type: 'ASSET', is_system: true },
      { account_name: 'Cash in Hand', account_type: 'CASH', is_system: true },
      { account_name: 'Sales', account_type: 'INCOME', is_system: true },
      { account_name: 'Inventory', account_type: 'ASSET', is_system: true },
      { account_name: 'COGS', account_type: 'EXPENSE', is_system: true },
      { account_name: 'Round Off', account_type: 'GENERAL', is_system: true },
      { account_name: 'Stock Adjustment', account_type: 'INCOME', is_system: true },
      { account_name: 'Opening Balance', account_type: 'CAPITAL', is_system: true },
      { account_name: 'CGST Input Credit', account_type: 'ASSET', is_system: true },
      { account_name: 'SGST Input Credit', account_type: 'ASSET', is_system: true },
      { account_name: 'IGST Input Credit', account_type: 'ASSET', is_system: true },
      { account_name: 'CGST Payable', account_type: 'LIABILITY', is_system: true },
      { account_name: 'SGST Payable', account_type: 'LIABILITY', is_system: true },
      { account_name: 'IGST Payable', account_type: 'LIABILITY', is_system: true },
    ];

    const createdBy = typeof userId === 'string' && mongoose.Types.ObjectId.isValid(userId)
      ? new mongoose.Types.ObjectId(userId)
      : userId instanceof mongoose.Types.ObjectId ? userId : null;

    for (const account of DEFAULT_SYSTEM_ACCOUNTS) {
      const existing = await ChartOfAccounts.findOne({
        firm_id: firmId,
        account_name: account.account_name
      }).session(session || null).lean();

      if (!existing) {
        await ChartOfAccounts.create([{
          firm_id: firmId,
          account_name: account.account_name,
          account_type: account.account_type,
          is_system: account.is_system,
          is_active: true,
          created_by: createdBy,
          updated_by: createdBy
        }], { session });
      }
    }
  }

  static async postPurchaseLedger(params: any) {
    const { firmId, billId, voucherId, billNo, billDate, party, netTotal, cgst, sgst, igst, roundOff, otherCharges, purchasedItems, createdBy, session } = params;
    const base = { firmId, transactionDate: billDate, voucherGroupId: voucherId, voucherType: 'PURCHASE', voucherNo: billNo, refType: 'BILL', refId: billId, createdBy };
    const docs: LedgerEntryParams[] = [];

    const partyL = await resolveLedgerPostingAccount({ firmId, accountHead: party.name || party.firm, fallbackType: 'SUNDRY_CREDITORS', partyId: party._id, session });
    docs.push({ ...base, accountHead: partyL.accountHead, accountType: partyL.accountType, partyId: party._id, debitAmount: 0, creditAmount: netTotal, narration: `Purchase Bill No: ${billNo}` });

    if (cgst > 0) docs.push({ ...base, accountHead: 'CGST Input Credit', accountType: 'ASSET', debitAmount: cgst, creditAmount: 0, narration: `CGST Input on Purchase: ${billNo}` });
    if (sgst > 0) docs.push({ ...base, accountHead: 'SGST Input Credit', accountType: 'ASSET', debitAmount: sgst, creditAmount: 0, narration: `SGST Input on Purchase: ${billNo}` });
    if (igst > 0) docs.push({ ...base, accountHead: 'IGST Input Credit', accountType: 'ASSET', debitAmount: igst, creditAmount: 0, narration: `IGST Input on Purchase: ${billNo}` });

    if (Math.abs(roundOff) > 0) {
      const rofL = await resolveLedgerPostingAccount({ firmId, accountHead: 'Round Off', fallbackType: 'INDIRECT_EXPENSE', session });
      docs.push({ ...base, accountHead: rofL.accountHead, accountType: rofL.accountType, debitAmount: roundOff > 0 ? roundOff : 0, creditAmount: roundOff < 0 ? Math.abs(roundOff) : 0, narration: `Round Off on Purchase: ${billNo}` });
    }

    for (const charge of (otherCharges || [])) {
      const amt = parseFloat(charge.amount) || 0;
      if (amt > 0) {
        const cL = await resolveLedgerPostingAccount({ firmId, accountHead: normalizeLedgerAccountHead(charge.name), fallbackType: 'INDIRECT_EXPENSE', session });
        docs.push({ ...base, accountHead: cL.accountHead, accountType: cL.accountType, debitAmount: amt, creditAmount: 0, narration: `${cL.accountHead} on Purchase: ${billNo}` });
      }
    }

    for (const pi of (purchasedItems || [])) {
      const lineVal = pi.lineValue ?? pi.total ?? 0;
      if (lineVal > 0) {
        docs.push({ ...base, accountHead: 'Inventory', accountType: 'ASSET', stockId: pi.stockId, stockRegId: pi.stockRegId, debitAmount: lineVal, creditAmount: 0, narration: `Purchase of ${pi.item} - Bill No: ${billNo}` });
      }
    }

    this.assertBalanced(docs, 'PURCHASE', billNo);
    await Ledger.insertMany(docs as any[], { session });
  }

  static async postSalesLedger(params: any) {
    const { firmId, billId, voucherId, billNo, billDate, party, netTotal, cgst, sgst, igst, roundOff, otherCharges, taxableItemsTotal, cogsLines, createdBy, session } = params;
    const base = { firmId, transactionDate: billDate, voucherGroupId: voucherId, voucherType: 'SALES', voucherNo: billNo, refType: 'BILL', refId: billId, createdBy };
    const docs: LedgerEntryParams[] = [];

    const partyL = await resolveLedgerPostingAccount({ firmId, accountHead: party.name || party.firm, fallbackType: 'SUNDRY_DEBTORS', partyId: party._id, session });
    docs.push({ ...base, accountHead: partyL.accountHead, accountType: partyL.accountType, partyId: party._id, debitAmount: netTotal, creditAmount: 0, narration: `Sales Bill No: ${billNo}` });

    if (cgst > 0) docs.push({ ...base, accountHead: 'CGST Payable', accountType: 'LIABILITY', debitAmount: 0, creditAmount: cgst, narration: `CGST on Sales: ${billNo}` });
    if (sgst > 0) docs.push({ ...base, accountHead: 'SGST Payable', accountType: 'LIABILITY', debitAmount: 0, creditAmount: sgst, narration: `SGST on Sales: ${billNo}` });
    if (igst > 0) docs.push({ ...base, accountHead: 'IGST Payable', accountType: 'LIABILITY', debitAmount: 0, creditAmount: igst, narration: `IGST on Sales: ${billNo}` });

    if (Math.abs(roundOff) > 0) {
      const rofL = await resolveLedgerPostingAccount({ firmId, accountHead: 'Round Off', fallbackType: 'INDIRECT_INCOME', session });
      docs.push({ ...base, accountHead: rofL.accountHead, accountType: rofL.accountType, debitAmount: roundOff < 0 ? Math.abs(roundOff) : 0, creditAmount: roundOff > 0 ? roundOff : 0, narration: `Round Off on Sales: ${billNo}` });
    }

    for (const charge of (otherCharges || [])) {
      const amt = parseFloat(charge.amount) || 0;
      if (amt > 0) {
        const cL = await resolveLedgerPostingAccount({ firmId, accountHead: normalizeLedgerAccountHead(charge.name), fallbackType: 'INDIRECT_INCOME', session });
        docs.push({ ...base, accountHead: cL.accountHead, accountType: cL.accountType, debitAmount: 0, creditAmount: amt, narration: `${cL.accountHead} on Sales: ${billNo}` });
      }
    }

    const salesL = await resolveLedgerPostingAccount({ firmId, accountHead: 'Sales', fallbackType: 'INCOME', session });
    docs.push({ ...base, accountHead: salesL.accountHead, accountType: salesL.accountType, debitAmount: 0, creditAmount: taxableItemsTotal, narration: `Sales of items - Bill No: ${billNo}` });

    for (const cl of (cogsLines || [])) {
      if (cl.cogsValue > 0) {
        docs.push({ ...base, accountHead: 'COGS', accountType: 'EXPENSE', stockId: cl.stockId, stockRegId: cl.stockRegId, debitAmount: cl.cogsValue, creditAmount: 0, narration: `COGS: ${cl.item} - Bill No: ${billNo}` });
        docs.push({ ...base, accountHead: 'Inventory', accountType: 'ASSET', stockId: cl.stockId, stockRegId: cl.stockRegId, debitAmount: 0, creditAmount: cl.cogsValue, narration: `Inventory out: ${cl.item} - Bill No: ${billNo}` });
      }
    }

    this.assertBalanced(docs, 'SALES', billNo);
    await Ledger.insertMany(docs as any[], { session });
  }

  static async postCreditNoteLedger(params: any) {
    const { firmId, billId, voucherId, billNo, billDate, party, netTotal, cgst, sgst, igst, roundOff, otherCharges, taxableItemsTotal, cogsLines, createdBy, session } = params;
    const base = { firmId, transactionDate: billDate, voucherGroupId: voucherId, voucherType: 'CREDIT_NOTE', voucherNo: billNo, refType: 'BILL', refId: billId, createdBy };
    const docs: LedgerEntryParams[] = [];

    const partyL = await resolveLedgerPostingAccount({ firmId, accountHead: party.name || party.firm, fallbackType: 'SUNDRY_DEBTORS', partyId: party._id, session });
    docs.push({ ...base, accountHead: partyL.accountHead, accountType: partyL.accountType, partyId: party._id, debitAmount: 0, creditAmount: netTotal, narration: `Credit Note No: ${billNo}` });

    if (cgst > 0) docs.push({ ...base, accountHead: 'CGST Payable', accountType: 'LIABILITY', debitAmount: cgst, creditAmount: 0, narration: `CGST Reversal on CN: ${billNo}` });
    if (sgst > 0) docs.push({ ...base, accountHead: 'SGST Payable', accountType: 'LIABILITY', debitAmount: sgst, creditAmount: 0, narration: `SGST Reversal on CN: ${billNo}` });
    if (igst > 0) docs.push({ ...base, accountHead: 'IGST Payable', accountType: 'LIABILITY', debitAmount: igst, creditAmount: 0, narration: `IGST Reversal on CN: ${billNo}` });

    if (Math.abs(roundOff) > 0) {
      const rofL = await resolveLedgerPostingAccount({ firmId, accountHead: 'Round Off', fallbackType: 'INDIRECT_INCOME', session });
      docs.push({ ...base, accountHead: rofL.accountHead, accountType: rofL.accountType, debitAmount: roundOff > 0 ? roundOff : 0, creditAmount: roundOff < 0 ? Math.abs(roundOff) : 0, narration: `Round Off reversal on CN: ${billNo}` });
    }

    const salesL = await resolveLedgerPostingAccount({ firmId, accountHead: 'Sales', fallbackType: 'INCOME', session });
    docs.push({ ...base, accountHead: salesL.accountHead, accountType: salesL.accountType, debitAmount: taxableItemsTotal, creditAmount: 0, narration: `Sales reversal on CN: ${billNo}` });

    for (const cl of (cogsLines || [])) {
      if (cl.cogsValue > 0) {
        docs.push({ ...base, accountHead: 'Inventory', accountType: 'ASSET', stockId: cl.stockId, stockRegId: cl.stockRegId, debitAmount: cl.cogsValue, creditAmount: 0, narration: `Goods returned to inventory: ${cl.item} - CN No: ${billNo}` });
        docs.push({ ...base, accountHead: 'COGS', accountType: 'EXPENSE', stockId: cl.stockId, stockRegId: cl.stockRegId, debitAmount: 0, creditAmount: cl.cogsValue, narration: `COGS reversal: ${cl.item} - CN No: ${billNo}` });
      }
    }

    this.assertBalanced(docs, 'CREDIT_NOTE', billNo);
    await Ledger.insertMany(docs as any[], { session });
  }

  static async postDebitNoteLedger(params: any) {
    const { firmId, billId, voucherId, billNo, billDate, party, netTotal, cgst, sgst, igst, roundOff, otherCharges, purchasedItems, createdBy, session } = params;
    const base = { firmId, transactionDate: billDate, voucherGroupId: voucherId, voucherType: 'DEBIT_NOTE', voucherNo: billNo, refType: 'BILL', refId: billId, createdBy };
    const docs: LedgerEntryParams[] = [];

    const partyL = await resolveLedgerPostingAccount({ firmId, accountHead: party.name || party.firm, fallbackType: 'SUNDRY_CREDITORS', partyId: party._id, session });
    docs.push({ ...base, accountHead: partyL.accountHead, accountType: partyL.accountType, partyId: party._id, debitAmount: netTotal, creditAmount: 0, narration: `Debit Note No: ${billNo}` });

    if (cgst > 0) docs.push({ ...base, accountHead: 'CGST Input Credit', accountType: 'ASSET', debitAmount: 0, creditAmount: cgst, narration: `CGST Input Reversal on DN: ${billNo}` });
    if (sgst > 0) docs.push({ ...base, accountHead: 'SGST Input Credit', accountType: 'ASSET', debitAmount: 0, creditAmount: sgst, narration: `SGST Input Reversal on DN: ${billNo}` });
    if (igst > 0) docs.push({ ...base, accountHead: 'IGST Input Credit', accountType: 'ASSET', debitAmount: 0, creditAmount: igst, narration: `IGST Input Reversal on DN: ${billNo}` });

    if (Math.abs(roundOff) > 0) {
      const rofL = await resolveLedgerPostingAccount({ firmId, accountHead: 'Round Off', fallbackType: 'INDIRECT_EXPENSE', session });
      docs.push({ ...base, accountHead: rofL.accountHead, accountType: rofL.accountType, debitAmount: roundOff < 0 ? Math.abs(roundOff) : 0, creditAmount: roundOff > 0 ? roundOff : 0, narration: `Round Off reversal on DN: ${billNo}` });
    }

    for (const pi of (purchasedItems || [])) {
      const lineVal = pi.lineValue ?? pi.total ?? 0;
      if (lineVal > 0) {
        docs.push({ ...base, accountHead: 'Inventory', accountType: 'ASSET', stockId: pi.stockId, stockRegId: pi.stockRegId, debitAmount: 0, creditAmount: lineVal, narration: `Goods returned to supplier: ${pi.item} - DN No: ${billNo}` });
      }
    }

    this.assertBalanced(docs, 'DEBIT_NOTE', billNo);
    await Ledger.insertMany(docs as any[], { session });
  }

  static async postStockAdjustmentLedger(params: any) {
    const { firmId, voucherId, type, item, qty, total, reference, createdBy, stockId, stockRegId, session } = params;
    const base = { firmId, transactionDate: new Date().toISOString().split('T')[0] || '', voucherGroupId: voucherId, voucherType: 'STOCK_ADJUSTMENT', voucherNo: reference || `SA-${voucherId}`, refType: 'STOCK_MOVEMENT', refId: stockRegId, createdBy, stockId, stockRegId };
    const docs: LedgerEntryParams[] = [];

    docs.push({ ...base, accountHead: 'Inventory', accountType: 'ASSET', debitAmount: total, creditAmount: 0, narration: `${type} of ${item}: ${qty} units - ${reference || 'Manual Adjustment'}` });

    const adjHead = (type === 'OPENING') ? 'Opening Balance' : 'Stock Adjustment';
    const adjType = (type === 'OPENING') ? 'CAPITAL' : 'INDIRECT_INCOME';
    const adjL = await resolveLedgerPostingAccount({ firmId, accountHead: adjHead, fallbackType: adjType, session });

    docs.push({ ...base, accountHead: adjL.accountHead, accountType: adjL.accountType, debitAmount: 0, creditAmount: total, narration: `${type} of ${item}: ${qty} units - ${reference || 'Manual Adjustment'}` });

    this.assertBalanced(docs, 'STOCK_ADJUSTMENT', base.voucherNo);
    await Ledger.insertMany(docs as any[], { session });
  }

  static async postVoucherToLedger(voucherData: any, createdBy: string): Promise<ILedger[]> {
    const { firmId, voucherId, voucherType, voucherNo, transactionDate, narration, entries: voucherEntries, session } = voucherData;
    const base = { firmId, voucherGroupId: voucherId.toString(), voucherType, voucherNo, transactionDate: transactionDate || new Date().toISOString().split('T')[0] || '', refType: 'VOUCHER', createdBy };
    const ledgerEntries: LedgerEntryParams[] = [];

    for (const entry of voucherEntries) {
      const l = await resolveLedgerPostingAccount({ firmId, accountHead: entry.accountHead, fallbackType: entry.accountType || 'ASSET', partyId: entry.partyId, session });
      ledgerEntries.push({ ...base, accountHead: l.accountHead, accountType: l.accountType, partyId: entry.partyId, bankAccountId: entry.bankAccountId, debitAmount: entry.debitAmount || 0, creditAmount: entry.creditAmount || 0, narration: entry.narration || narration, paymentMode: entry.paymentMode });
    }

    this.assertBalanced(ledgerEntries, voucherType, voucherNo);
    return await Ledger.insertMany(ledgerEntries as any[], { session }) as any;
  }

  static async getAccountBalance(firmId: mongoose.Types.ObjectId, accountHead: string, toDate?: string) {
    const query: any = { firmId, accountHead };
    if (toDate) query.transactionDate = { $lte: toDate };
    const result = await Ledger.aggregate([{ $match: query }, { $group: { _id: null, totalDebit: { $sum: '$debitAmount' }, totalCredit: { $sum: '$creditAmount' } } }]);
    if (result.length === 0) return { totalDebit: 0, totalCredit: 0, balance: 0, balanceType: 'DR' };
    const { totalDebit, totalCredit } = result[0];
    const balance = totalDebit - totalCredit;
    return { totalDebit, totalCredit, balance: Math.abs(balance), balanceType: balance >= 0 ? 'DR' : 'CR' };
  }

  static async getTrialBalance(firmId: mongoose.Types.ObjectId, fromDate?: string, toDate?: string) {
    const query: any = { firmId };
    if (fromDate || toDate) {
      query.transactionDate = {};
      if (fromDate) query.transactionDate.$gte = fromDate;
      if (toDate) query.transactionDate.$lte = toDate;
    }

    const balances = await Ledger.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$accountHead',
          accountType: { $first: '$accountType' },
          totalDebit: { $sum: '$debitAmount' },
          totalCredit: { $sum: '$creditAmount' },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return balances.map(b => {
      const balance = b.totalDebit - b.totalCredit;
      return {
        accountHead: b._id,
        accountType: b.accountType,
        totalDebit: b.totalDebit,
        totalCredit: b.totalCredit,
        balance: Math.abs(balance),
        balanceType: balance >= 0 ? 'DR' : 'CR',
      };
    });
  }

  static async getVouchersSummary(firmId: mongoose.Types.ObjectId) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const dateStr = thirtyDaysAgo.toISOString().split('T')[0];

    const receipts = await Ledger.aggregate([
      { $match: { firmId, voucherType: 'RECEIPT' } },
      { $group: { _id: null, total: { $sum: '$debitAmount' } } }
    ]);

    const payments = await Ledger.aggregate([
      { $match: { firmId, voucherType: 'PAYMENT' } },
      { $group: { _id: null, total: { $sum: '$creditAmount' } } }
    ]);

    const recentCount = await Ledger.distinct('voucherGroupId', {
      firmId,
      transactionDate: { $gte: dateStr }
    });

    const netPosition = (receipts[0]?.total || 0) - (payments[0]?.total || 0);

    return {
      total_receipts: receipts[0]?.total || 0,
      total_payments: payments[0]?.total || 0,
      recent_transactions_count: recentCount.length,
      net_position: netPosition
    };
  }

  static async getJournalSummary(firmId: mongoose.Types.ObjectId) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const dateStr = thirtyDaysAgo.toISOString().split('T')[0];

    const total = await Ledger.countDocuments({ firmId, voucherType: 'JOURNAL' });
    const recent = await Ledger.countDocuments({
      firmId,
      voucherType: 'JOURNAL',
      transactionDate: { $gte: dateStr }
    });

    return {
      total_journal_entries: total,
      recent_journal_entries_count: recent
    };
  }

  static async getAccountTypeSummaries(firmId: mongoose.Types.ObjectId, toDate?: string) {
    const query: any = { firmId };
    if (toDate) query.transactionDate = { $lte: toDate };

    const summaries = await Ledger.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$accountType',
          account_count: { $addToSet: '$accountHead' },
          total_debit: { $sum: '$debitAmount' },
          total_credit: { $sum: '$creditAmount' },
        }
      },
      {
        $project: {
          account_type: '$_id',
          account_count: { $size: '$account_count' },
          total_debit: 1,
          total_credit: 1,
          total_balance: { $subtract: ['$total_debit', '$total_credit'] }
        }
      },
      { $sort: { account_type: 1 } }
    ]);

    return summaries;
  }

  static async getLedger(firmId: mongoose.Types.ObjectId, accountHead: string, fromDate?: string, toDate?: string) {
    const startingBalQuery: any = { firmId, accountHead };
    if (fromDate) startingBalQuery.transactionDate = { $lt: fromDate };
    const startingRes = await Ledger.aggregate([
      { $match: startingBalQuery },
      { $group: { _id: null, totalDr: { $sum: '$debitAmount' }, totalCr: { $sum: '$creditAmount' } } }
    ]);
    const rawBal = (startingRes[0]?.totalDr || 0) - (startingRes[0]?.totalCr || 0);
    const startingBal = {
      rawBalance: rawBal,
      balance: Math.abs(rawBal),
      balanceType: rawBal >= 0 ? 'DR' : 'CR'
    };

    const query: any = { firmId, accountHead };
    if (fromDate || toDate) {
      query.transactionDate = {};
      if (fromDate) query.transactionDate.$gte = fromDate;
      if (toDate) query.transactionDate.$lte = toDate;
    }

    const entries = await Ledger.find(query).sort({ transactionDate: 1, createdAt: 1 }).lean();
    let runningBal = rawBal;
    const mappedEntries = entries.map((entry: any) => {
      runningBal += (entry.debitAmount || 0) - (entry.creditAmount || 0);
      return {
        ...entry,
        runningBalance: Math.abs(runningBal),
        runningBalanceType: runningBal >= 0 ? 'DR' : 'CR'
      };
    });

    const totalDebits = entries.reduce((s: number, e: any) => s + (e.debitAmount || 0), 0);
    const totalCredits = entries.reduce((s: number, e: any) => s + (e.creditAmount || 0), 0);
    const finalBalance = Math.abs(runningBal);
    const finalBalanceType = runningBal >= 0 ? 'DR' : 'CR';

    return {
      startingBal,
      entries: mappedEntries,
      totalDebits,
      totalCredits,
      finalBalance,
      finalBalanceType
    };
  }

  static async getProfitAndLossModel(firmId: mongoose.Types.ObjectId, fromDate?: string, toDate?: string) {
    const trialBalance = await this.getTrialBalance(firmId, fromDate, toDate);
    const isCOGS = (head: string, type: string) => {
      if (type === 'COGS') return true;
      const h = head.toLowerCase();
      return ['cogs', 'cost of goods', 'purchase', 'inventory'].some(k => h.includes(k)) && (type === 'EXPENSE' || type === 'COGS');
    };

    const plAccounts = trialBalance.filter(a =>
      ['INCOME', 'EXPENSE', 'COGS', 'GENERAL'].includes(a.accountType)
    ).map(a => {
      const netDr = a.totalDebit - a.totalCredit;
      const netCr = a.totalCredit - a.totalDebit;
      return { head: a.accountHead, type: a.accountType, netDr, netCr };
    });

    const income = plAccounts.filter(a => a.type === 'INCOME');
    const expense = plAccounts.filter(a => a.type === 'EXPENSE' || a.type === 'COGS');
    const general = plAccounts.filter(a => a.type === 'GENERAL');

    const drCOGS = expense.filter(a => isCOGS(a.head, a.type) && a.netDr > 0);
    const drOpex = expense.filter(a => !isCOGS(a.head, a.type) && a.netDr > 0);
    const crRevenue = income.filter(a => a.netCr > 0);
    const crGeneral = general.filter(a => a.netCr > 0);
    const drGeneral = general.filter(a => a.netDr > 0);

    const totalCOGS = drCOGS.reduce((s, a) => s + a.netDr, 0);
    const totalOpex = drOpex.reduce((s, a) => s + a.netDr, 0) + drGeneral.reduce((s, a) => s + a.netDr, 0);
    const totalRevenueCr = crRevenue.reduce((s, a) => s + a.netCr, 0);
    const totalIncomeCr = totalRevenueCr + crGeneral.reduce((s, a) => s + a.netCr, 0);
    const totalExpensesDr = totalCOGS + totalOpex;

    const netProfit = totalIncomeCr - totalExpensesDr;
    const drGrand = totalExpensesDr + (netProfit > 0 ? netProfit : 0);
    const crGrand = totalIncomeCr + (netProfit < 0 ? Math.abs(netProfit) : 0);

    return {
      drCOGS, drOpex, crRevenue, crGeneral, drGeneral,
      totalCOGS, totalOpex, totalRevenueCr, totalIncomeCr, totalExpensesDr,
      netProfit, drGrand, crGrand
    };
  }

  static async getBalanceSheetModel(firmId: mongoose.Types.ObjectId, asOfDate?: string) {
    const trialBalance = await this.getTrialBalance(firmId, undefined, asOfDate);
    const plModel = await this.getProfitAndLossModel(firmId, undefined, asOfDate);

    const assetAccounts = trialBalance.filter(a => ['ASSET', 'BANK', 'CASH'].includes(a.accountType));
    const liabAccounts = trialBalance.filter(a => ['LIABILITY', 'EQUITY', 'CAPITAL'].includes(a.accountType));

    const totalAssets = assetAccounts.reduce((s, a) => s + (a.totalDebit - a.totalCredit), 0);
    const totalLiab = liabAccounts.reduce((s, a) => s + (a.totalCredit - a.totalDebit), 0);

    const capital = totalLiab;
    const totalOtherA = totalAssets;
    const totalStock = 0;
    const totalCred = 0;
    const totalDebtors = 0;
    const totalCashBank = 0;
    const totalLiabSide = capital + plModel.netProfit;

    return {
      capital,
      totalLiab,
      totalAssets,
      totalOtherA,
      totalStock,
      totalCred,
      totalDebtors,
      totalCashBank,
      totalDebtorCreditBalances: 0,
      totalCashBankCreditBalances: 0,
      totalLiabSide,
      netProfit: plModel.netProfit
    };
  }
}
