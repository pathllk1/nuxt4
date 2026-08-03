import { defineEventHandler, createError } from 'h3';
import mongoose from 'mongoose';
import StockReg from '../../../../models/StockReg';

export default defineEventHandler(async (event) => {
  const stockId = event.context.params?.stockId;
  if (!stockId) {
    throw createError({ statusCode: 400, statusMessage: 'Stock ID required' });
  }

  const stockIdStr = String(stockId);
  const stockIdObj = mongoose.Types.ObjectId.isValid(stockIdStr) ? new mongoose.Types.ObjectId(stockIdStr) : null;

  const filter = {
    $or: [
      { stock_id: stockIdStr },
      { stockId: stockIdStr },
      ...(stockIdObj ? [{ stock_id: stockIdObj }, { stockId: stockIdObj }] : [])
    ]
  };

  const history = await StockReg.find(filter).sort({ createdAt: -1 }).lean();

  const formatted = history.map((h: any) => ({
    ...h,
    id: h._id?.toString() || h.id,
    _id: h._id?.toString() || h._id,
    type: h.type || 'MOVEMENT',
    bno: h.bno || '—',
    bdate: h.bdate || (h.createdAt ? new Date(h.createdAt).toISOString().split('T')[0] : '—'),
    supply: h.supply || h.partyName || '—',
    qty: h.qty ?? 0,
    uom: h.uom || 'PCS',
    rate: h.rate ?? 0,
    total: h.total ?? ((h.qty || 0) * (h.rate || 0)),
    qtyh: h.qtyh ?? 0
  }));

  return { success: true, data: formatted };
});
