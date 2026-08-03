import mongoose from 'mongoose';
import { requireAuthSession } from '../../../utils/auth';
import { LedgerService } from '../../../utils/accounting/ledger.service';

export default defineEventHandler(async (event) => {
  const user = await requireAuthSession(event);
  const query = getQuery(event);
  const toDate = query.toDate as string | undefined;
  const firmId = new mongoose.Types.ObjectId(user.firm_id as string);
  const data = await LedgerService.getAccountTypeSummaries(firmId, toDate);
  return { success: true, data };
});
