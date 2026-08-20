import { defineEventHandler, getQuery } from 'h3';
import mongoose from 'mongoose';
import { requireAuthSession } from '../../utils/auth';
import StockReg from '../../models/StockReg';
import { connectDB } from '../../plugins/mongodb';

export default defineEventHandler(async (event) => {
  await connectDB();
  const user = await requireAuthSession(event);
  const firmIdStr = String(user.firm_id);
  const firmIdObj = mongoose.Types.ObjectId.isValid(firmIdStr) ? new mongoose.Types.ObjectId(firmIdStr) : null;

  const query = getQuery(event);
  const { type, stockId, page = 1, limit = 50 } = query;

  const filter: any = {
    $or: [
      { firm_id: firmIdStr },
      { firmId: firmIdStr },
      ...(firmIdObj ? [{ firm_id: firmIdObj }, { firmId: firmIdObj }] : [])
    ]
  };

  if (type) {
    filter.type = type;
  }

  if (stockId) {
    const stockIdStr = String(stockId);
    const stockIdObj = mongoose.Types.ObjectId.isValid(stockIdStr) ? new mongoose.Types.ObjectId(stockIdStr) : null;
    filter.$and = [
      {
        $or: [
          { stock_id: stockIdStr },
          { stockId: stockIdStr },
          ...(stockIdObj ? [{ stock_id: stockIdObj }, { stockId: stockIdObj }] : [])
        ]
      }
    ];
  }

  const movements = await StockReg.find(filter)
    .sort({ createdAt: -1 })
    .skip((Number(page) - 1) * Number(limit))
    .limit(Number(limit))
    .lean();

  const total = await StockReg.countDocuments(filter);

  const formatted = movements.map((m: any) => ({
    ...m,
    id: m._id?.toString() || m.id,
    _id: m._id?.toString() || m._id,
    type: m.type || 'MOVEMENT',
    bno: m.bno || '—',
    bdate: m.bdate || (m.createdAt ? new Date(m.createdAt).toISOString().split('T')[0] : '—'),
    supply: m.supply || m.partyName || '—',
    item: m.item || m.name || 'Unnamed Item',
    batch: m.batch || '',
    qty: m.qty ?? 0,
    uom: m.uom || 'PCS',
    rate: m.rate ?? 0,
    total: m.total ?? ((m.qty || 0) * (m.rate || 0)),
    qtyh: m.qtyh ?? 0
  }));

  return {
    success: true,
    data: formatted,
    total,
    page: Number(page),
    limit: Number(limit)
  };
});
