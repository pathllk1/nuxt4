import mongoose from 'mongoose';
import { previewNextBillNumber } from '../../../utils/accounting/bill-utils';
import { requireAuthSession } from '../../../utils/auth';

export default defineEventHandler(async (event) => {
  const user = await requireAuthSession(event);
  const query = getQuery(event);
  const type = (query.type as string) || 'SALES';
  const billDate = query.billDate ? String(query.billDate) : undefined;

  const nextBno = await previewNextBillNumber(new mongoose.Types.ObjectId(user.firm_id as string), type, billDate);

  return {
    success: true,
    data: { bno: nextBno }
  };
});
