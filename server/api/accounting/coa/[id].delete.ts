import mongoose from 'mongoose';
import ChartOfAccounts from '../../../models/ChartOfAccounts';
import Ledger from '../../../models/Ledger';
import { requireAuthSession } from '../../../utils/auth';

export default defineEventHandler(async (event) => {
  const user = await requireAuthSession(event);
  const accountId = event.context.params?.id;

  if (!accountId || !mongoose.Types.ObjectId.isValid(accountId)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid account ID' });
  }

  const firmIdObj = new mongoose.Types.ObjectId(String(user.firm_id));
  const account = await (ChartOfAccounts as any).findOne({ _id: new mongoose.Types.ObjectId(accountId), firm_id: firmIdObj });
  if (!account) {
    throw createError({ statusCode: 404, statusMessage: 'Account head not found' });
  }
  if (account.is_system) {
    throw createError({ statusCode: 400, statusMessage: 'System accounts cannot be deleted' });
  }

  const used = await (Ledger as any).exists({ firmId: firmIdObj, accountHead: account.account_name });
  if (used) {
    throw createError({ statusCode: 400, statusMessage: 'Cannot delete account head as it has ledger entries' });
  }

  await (ChartOfAccounts as any).deleteOne({ _id: account._id, firm_id: firmIdObj });
  return { success: true, message: 'Account head deleted successfully' };
});