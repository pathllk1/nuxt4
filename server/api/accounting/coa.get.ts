import mongoose from 'mongoose';
import ChartOfAccounts from '../../models/ChartOfAccounts';
import { LedgerService } from '../../utils/accounting/ledger.service';
import { requireAuthSession } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  const user = await requireAuthSession(event);
  const firmIdObj = new mongoose.Types.ObjectId(user.firm_id as string);

  // Initialize System Accounts if not initialized
  await LedgerService.initializeChartOfAccounts(firmIdObj, new mongoose.Types.ObjectId(user._id as string));

  const accounts = await ChartOfAccounts.find({ firm_id: firmIdObj, is_active: true })
    .sort({ account_type: 1, account_name: 1 })
    .lean();

  return {
    success: true,
    count: accounts.length,
    data: accounts
  };
});
