import { defineEventHandler } from 'h3';
import mongoose from 'mongoose';
import { requireAuthSession } from '../../utils/auth';
import Stock from '../../models/Stock';
import { connectDB } from '../../plugins/mongodb';

export default defineEventHandler(async (event) => {
  await connectDB();
  const user = await requireAuthSession(event);
  const firmIdStr = String(user.firm_id);
  const firmIdObj = mongoose.Types.ObjectId.isValid(firmIdStr) ? new mongoose.Types.ObjectId(firmIdStr) : null;

  const query: any = {
    $or: [
      { firm_id: firmIdStr },
      { firmId: firmIdStr },
      ...(firmIdObj ? [{ firm_id: firmIdObj }, { firmId: firmIdObj }] : [])
    ]
  };

  const stocks = await Stock.find(query).sort({ item: 1 }).lean();

  const flattened = stocks.map((s: any) => {
    const defaultBatch = s.batches?.[0] || {};
    return {
      ...s,
      id: s._id?.toString() || s.id,
      _id: s._id?.toString() || s._id,
      item: s.item || s.name || 'Unnamed Item',
      hsn: s.hsn || '',
      pno: s.pno || '',
      oem: s.oem || '',
      qty: s.qty ?? 0,
      uom: s.uom || defaultBatch.uom || 'PCS',
      rate: s.rate ?? defaultBatch.rate ?? 0,
      grate: s.grate ?? defaultBatch.grate ?? 18,
      total: s.total ?? ((s.qty || 0) * (s.rate || 0)),
      mrp: s.mrp || defaultBatch.mrp || s.rate || 0,
      expiry: defaultBatch.expiry || s.expiry,
      batches: s.batches || []
    };
  });

  return { success: true, data: flattened };
});
