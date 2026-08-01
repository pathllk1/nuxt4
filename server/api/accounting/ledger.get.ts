import mongoose from 'mongoose';
import Ledger from '../../models/Ledger';
import { requireAuthSession } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  const user = await requireAuthSession(event);
  const query = getQuery(event);
  const { accountHead, partyId, voucherType, dateFrom, dateTo, limit, offset } = query;

  const filter: any = { firmId: new mongoose.Types.ObjectId(user.firm_id as string) };

  if (accountHead) filter.accountHead = accountHead;
  if (partyId && mongoose.Types.ObjectId.isValid(partyId as string)) {
    filter.partyId = new mongoose.Types.ObjectId(partyId as string);
  }
  if (voucherType) filter.voucherType = String(voucherType).toUpperCase();
  if (dateFrom || dateTo) {
    filter.transactionDate = {};
    if (dateFrom) filter.transactionDate.$gte = dateFrom;
    if (dateTo) filter.transactionDate.$lte = dateTo;
  }

  const limitNum = Math.min(parseInt(limit as string) || 200, 1000);
  const offsetNum = parseInt(offset as string) || 0;

  const total = await Ledger.countDocuments(filter);
  const entries = await Ledger.find(filter)
    .sort({ transactionDate: -1, createdAt: -1 })
    .skip(offsetNum)
    .limit(limitNum)
    .lean();

  return {
    success: true,
    total,
    count: entries.length,
    data: entries
  };
});
