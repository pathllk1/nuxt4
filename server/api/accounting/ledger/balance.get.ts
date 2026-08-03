import mongoose from 'mongoose';
import { LedgerService } from '../../../utils/accounting/ledger.service';
import { requireAuthSession } from '../../../utils/auth';

export default defineEventHandler(async (event) => {
  const user = await requireAuthSession(event);
  const query = getQuery(event);
  const accountHead = query.accountHead ? String(query.accountHead) : '';

  if (!accountHead) {
    throw createError({ statusCode: 400, statusMessage: 'accountHead is required' });
  }

  const data = await LedgerService.getAccountBalance(
    new mongoose.Types.ObjectId(String(user.firm_id)),
    accountHead,
    query.toDate as string | undefined
  );

  return { success: true, data };
});