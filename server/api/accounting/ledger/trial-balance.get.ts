import mongoose from 'mongoose';
import { LedgerService } from '../../../utils/accounting/ledger.service';
import { requireAuthSession } from '../../../utils/auth';

export default defineEventHandler(async (event) => {
  const user = await requireAuthSession(event);
  const query = getQuery(event);
  const { fromDate, toDate } = query;

  const firmIdObj = new mongoose.Types.ObjectId(user.firm_id as string);
  const data = await LedgerService.getTrialBalance(firmIdObj, fromDate as string, toDate as string);

  const totals = data.reduce((acc, item) => {
    if (item.balanceType === 'DR') acc.totalDebit += item.balance;
    else acc.totalCredit += item.balance;
    return acc;
  }, { totalDebit: 0, totalCredit: 0 });

  return {
    success: true,
    data,
    summary: {
      totalDebit: totals.totalDebit,
      totalCredit: totals.totalCredit,
      isBalanced: Math.abs(totals.totalDebit - totals.totalCredit) < 0.01
    }
  };
});
