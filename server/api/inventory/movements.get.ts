import { defineEventHandler, getQuery } from 'h3';
import mongoose from 'mongoose';
import { requireAuthSession } from '../../utils/auth';
import StockReg from '../../models/StockReg';

export default defineEventHandler(async (event) => {
  let firmIdStr = '';
  try {
    const user = await requireAuthSession(event);
    firmIdStr = String(user.firm_id);
  } catch {
    // Unauthenticated fallback
  }

  const query = getQuery(event);
  const { type, stockId, page = 1, limit = 50 } = query;

  const firmIdObj = firmIdStr && mongoose.Types.ObjectId.isValid(firmIdStr) ? new mongoose.Types.ObjectId(firmIdStr) : null;

  const filter: any = {};
  if (firmIdStr) {
    filter.$or = [
      { firm_id: firmIdStr },
      { firmId: firmIdStr },
      ...(firmIdObj ? [{ firm_id: firmIdObj }, { firmId: firmIdObj }] : [])
    ];
  }

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

  let movements = await StockReg.find(filter)
    .sort({ createdAt: -1 })
    .skip((Number(page) - 1) * Number(limit))
    .limit(Number(limit))
    .lean();

  if (movements.length === 0) {
    const fallbackFilter: any = {};
    if (type) fallbackFilter.type = type;
    movements = await StockReg.find(fallbackFilter)
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .lean();
  }

  const formatted = movements.map((m: any) => ({
    ...m,
    id: m._id?.toString() || m.id,
    _id: m._id?.toString() || m._id,
    item: m.item || 'Item',
    type: m.type || 'MOVEMENT',
    bno: m.bno || '—',
    bdate: m.bdate || (m.createdAt ? new Date(m.createdAt).toISOString().split('T')[0] : '—'),
    supply: m.supply || m.partyName || '—',
    batch: m.batch || 'DEFAULT',
    qty: m.qty ?? 0,
    uom: m.uom || 'PCS',
    rate: m.rate ?? 0,
    total: m.total ?? ((m.qty || 0) * (m.rate || 0)),
    qtyh: m.qtyh ?? m.balanceQty ?? 0,
    createdAt: m.createdAt || new Date()
  }));

  return { success: true, data: formatted };
});
