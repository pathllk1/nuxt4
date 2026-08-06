import { defineEventHandler, getQuery } from 'h3';
import mongoose from 'mongoose';
import ChartOfAccounts from '../../models/ChartOfAccounts';
import OpeningBalance from '../../models/OpeningBalance';
import Ledger from '../../models/Ledger';
import { LedgerService } from '../../utils/accounting/ledger.service';
import { requireAuthSession } from '../../utils/auth';

function getCurrentFinancialYear(): string {
  const now = new Date();
  const month = now.getMonth() + 1; // 1-12
  const year = now.getFullYear();
  if (month >= 4) {
    return `${year}-${(year + 1).toString().slice(-2)}`;
  } else {
    return `${year - 1}-${year.toString().slice(-2)}`;
  }
}

export default defineEventHandler(async (event) => {
  const user = await requireAuthSession(event);
  const firmIdStr = String(user.firm_id);
  const firmIdObj = new mongoose.Types.ObjectId(firmIdStr);

  // Initialize System Accounts if not initialized
  await LedgerService.initializeChartOfAccounts(firmIdObj, new mongoose.Types.ObjectId(String(user._id)));

  const queryParams = getQuery(event);
  const search = queryParams.search ? String(queryParams.search) : '';
  const type = queryParams.type ? String(queryParams.type) : '';

  const filter: any = {
    $or: [
      { firm_id: firmIdObj },
      { firm_id: firmIdStr },
      { firmId: firmIdObj },
      { firmId: firmIdStr }
    ],
    is_active: true
  };

  if (search) {
    filter.account_name = { $regex: search, $options: 'i' };
  }
  if (type && type !== 'all') {
    filter.account_type = type;
  }

  const accounts = await ChartOfAccounts.find(filter)
    .sort({ account_type: 1, account_name: 1 })
    .lean();

  const financialYear = getCurrentFinancialYear();

  // Fetch Opening Balances
  const obs = await OpeningBalance.find({
    $or: [
      { firmId: firmIdObj },
      { firmId: firmIdStr }
    ],
    financialYear
  }).lean();

  const obMap = new Map<string, any>();
  obs.forEach((ob: any) => {
    obMap.set(ob.accountHead, ob);
  });

  // Aggregate Ledger balances per account head
  const ledgerBalances = await Ledger.aggregate([
    {
      $match: {
        $or: [
          { firmId: firmIdObj },
          { firmId: firmIdStr }
        ]
      }
    },
    {
      $group: {
        _id: '$accountHead',
        totalDebit: { $sum: '$debitAmount' },
        totalCredit: { $sum: '$creditAmount' }
      }
    }
  ]);

  const balanceMap = new Map<string, { totalDebit: number; totalCredit: number }>();
  ledgerBalances.forEach((b: any) => {
    balanceMap.set(b._id, { totalDebit: b.totalDebit || 0, totalCredit: b.totalCredit || 0 });
  });

  // Enrich accounts with Opening & Current Balances
  const enrichedAccounts = accounts.map((acc: any) => {
    const ob = obMap.get(acc.account_name);
    const ledger = balanceMap.get(acc.account_name);

    const ob_debit = ob ? (ob.debitAmount || 0) : 0;
    const ob_credit = ob ? (ob.creditAmount || 0) : 0;

    const ledger_debit = ledger ? (ledger.totalDebit || 0) : 0;
    const ledger_credit = ledger ? (ledger.totalCredit || 0) : 0;

    const totalDebit = ob_debit + ledger_debit;
    const totalCredit = ob_credit + ledger_credit;

    const netBalance = totalDebit - totalCredit;
    const openingVal = ob ? (ob.debitAmount || ob.creditAmount || 0) : 0;
    const openingType = ob ? (ob.debitAmount > 0 ? 'DR' : 'CR') : 'DR';

    return {
      ...acc,
      opening_balance: openingVal,
      balance_type: openingType,
      current_balance: Math.abs(netBalance),
      current_balance_type: netBalance >= 0 ? 'DR' : 'CR'
    };
  });

  return {
    success: true,
    count: enrichedAccounts.length,
    data: enrichedAccounts
  };
});
