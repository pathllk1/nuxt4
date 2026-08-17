import mongoose from 'mongoose';
import BulkPayment from '../../../models/BulkPayment';
import { requireAuthSession } from '../../../utils/auth';

export default defineEventHandler(async (event) => {
  const user = await requireAuthSession(event);
  const firmIdObj = new mongoose.Types.ObjectId(String(user.firm_id));
  const query = getQuery(event);

  const search = (query.search as string || '').trim();
  const status = (query.status as string || '').trim();
  const page = Math.max(1, parseInt(query.page as string) || 1);
  const limit = Math.max(1, Math.min(100, parseInt(query.limit as string) || 20));
  const skip = (page - 1) * limit;

  const filter: any = { firmId: firmIdObj };

  if (status && status !== 'ALL') {
    filter.status = status;
  }

  if (search) {
    filter.$or = [
      { batchNo: { $regex: search, $options: 'i' } },
      { chequeNo: { $regex: search, $options: 'i' } },
      { bankAccountName: { $regex: search, $options: 'i' } },
      { narration: { $regex: search, $options: 'i' } },
      { 'items.beneficiaryName': { $regex: search, $options: 'i' } },
      { 'items.beneficiaryAccountNo': { $regex: search, $options: 'i' } }
    ];
  }

  const [total, batches] = await Promise.all([
    BulkPayment.countDocuments(filter),
    BulkPayment.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()
  ]);

  return {
    success: true,
    data: {
      batches,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    }
  };
});
