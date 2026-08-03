import { defineEventHandler } from 'h3';
import mongoose from 'mongoose';
import { requireAuthSession } from '../../../utils/auth';
import Stock from '../../../models/Stock';

export default defineEventHandler(async (event) => {
  let firmIdStr = '';
  try {
    const user = await requireAuthSession(event);
    firmIdStr = String(user.firm_id);
  } catch {}

  const firmIdObj = firmIdStr && mongoose.Types.ObjectId.isValid(firmIdStr) ? new mongoose.Types.ObjectId(firmIdStr) : null;
  const filter: any = firmIdStr ? {
    $or: [
      { firm_id: firmIdStr },
      { firmId: firmIdStr },
      ...(firmIdObj ? [{ firm_id: firmIdObj }, { firmId: firmIdObj }] : [])
    ]
  } : {};

  let stocks = await Stock.find(filter).sort({ item: 1 }).lean();
  if (stocks.length === 0) {
    stocks = await Stock.find({}).sort({ item: 1 }).lean();
  }

  const valuation = stocks.map((s: any) => ({
    item: s.item || s.name || 'Item',
    hsn: s.hsn || '',
    pno: s.pno || '',
    oem: s.oem || '',
    qty: s.qty ?? 0,
    uom: s.uom || 'PCS',
    rate: s.rate ?? 0,
    totalValue: s.total ?? ((s.qty || 0) * (s.rate || 0)),
    batches: s.batches?.length || 0
  }));

  const summary = {
    totalItems: valuation.length,
    totalQty: valuation.reduce((acc, s) => acc + s.qty, 0),
    totalValue: valuation.reduce((acc, s) => acc + s.totalValue, 0)
  };

  return { success: true, data: { items: valuation, summary } };
});
