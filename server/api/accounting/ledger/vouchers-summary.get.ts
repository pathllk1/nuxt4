import mongoose from 'mongoose';
import { requireAuthSession } from '../../../utils/auth';
import { LedgerService } from '../../../utils/accounting/ledger.service';

export default defineEventHandler(async (event) => {
  const user = await requireAuthSession(event);
  const firmId = new mongoose.Types.ObjectId(user.firm_id as string);
  const data = await LedgerService.getVouchersSummary(firmId);
  return { success: true, data };
});
