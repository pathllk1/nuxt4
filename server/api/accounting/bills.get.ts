import mongoose from 'mongoose';
import Bill from '../../models/Bill';
import { requireAuthSession } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  const user = await requireAuthSession(event);
  const query = getQuery(event);
  const { btype, search, status, dateFrom, dateTo, limit, offset } = query;

  const filter: any = { firmId: new mongoose.Types.ObjectId(user.firm_id as string) };

  if (btype) {
    filter.btype = (btype as string).toUpperCase();
  }
  if (status) {
    filter.status = (status as string).toUpperCase();
  }
  if (dateFrom || dateTo) {
    filter.bdate = {};
    if (dateFrom) filter.bdate.$gte = dateFrom;
    if (dateTo) filter.bdate.$lte = dateTo;
  }
  if (search) {
    const s = String(search).trim();
    filter.$or = [
      { bno: { $regex: s, $options: 'i' } },
      { partyName: { $regex: s, $options: 'i' } },
      { supplierBillNo: { $regex: s, $options: 'i' } },
    ];
  }

  const limitNum = Math.min(parseInt(limit as string) || 100, 500);
  const offsetNum = parseInt(offset as string) || 0;

  const total = await Bill.countDocuments(filter);
  const bills = await Bill.find(filter)
    .sort({ bdate: -1, createdAt: -1 })
    .skip(offsetNum)
    .limit(limitNum)
    .populate('partyId', 'name gstin contact state')
    .lean();

  return {
    success: true,
    total,
    count: bills.length,
    data: bills
  };
});
