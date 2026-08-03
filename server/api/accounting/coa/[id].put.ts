import mongoose from 'mongoose';
import ChartOfAccounts from '../../../models/ChartOfAccounts';
import OpeningBalance from '../../../models/OpeningBalance';
import { getCurrentFinancialYear } from '../../../utils/accounting/bill-utils';
import { requireAuthSession } from '../../../utils/auth';

export default defineEventHandler(async (event) => {
  const user = await requireAuthSession(event);
  const accountId = event.context.params?.id;

  if (!accountId || !mongoose.Types.ObjectId.isValid(accountId)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid account ID' });
  }

  const body = await readBody(event) || {};
  const firmIdObj = new mongoose.Types.ObjectId(String(user.firm_id));
  const update: any = { updated_by: new mongoose.Types.ObjectId(String(user._id)) };

  if (body.account_name) update.account_name = String(body.account_name).trim();
  if (body.account_type) update.account_type = String(body.account_type).toUpperCase();
  if (body.is_active !== undefined) update.is_active = body.is_active !== false;

  const account = await (ChartOfAccounts as any).findOneAndUpdate(
    { _id: new mongoose.Types.ObjectId(accountId), firm_id: firmIdObj },
    { $set: update },
    { new: true, runValidators: true }
  );

  if (!account) {
    throw createError({ statusCode: 404, statusMessage: 'Account head not found' });
  }

  const openingRaw = body.opening_balance ?? body.openingBalance;
  if (openingRaw !== undefined) {
    const openingBalance = parseFloat(openingRaw) || 0;
    const balanceType = String(body.balance_type || body.balanceType || 'DR').toUpperCase();
    await (OpeningBalance as any).findOneAndUpdate(
      { firmId: firmIdObj, accountHead: account.account_name, financialYear: getCurrentFinancialYear() },
      {
        accountType: account.account_type,
        debitAmount: balanceType === 'DR' ? openingBalance : 0,
        creditAmount: balanceType === 'CR' ? openingBalance : 0,
        createdBy: String(user._id)
      },
      { upsert: true, new: true }
    );
  }

  return { success: true, message: 'Account head updated successfully', data: account };
});