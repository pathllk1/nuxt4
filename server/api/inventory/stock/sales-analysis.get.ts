import { defineEventHandler } from 'h3';
import mongoose from 'mongoose';
import { requireAuthSession } from '../../../utils/auth';
import StockReg from '../../../models/StockReg';

export default defineEventHandler(async (event) => {
  let firmIdStr = '';
  try {
    const user = await requireAuthSession(event);
    firmIdStr = String(user.firm_id);
  } catch {}

  const firmIdObj = firmIdStr && mongoose.Types.ObjectId.isValid(firmIdStr) ? new mongoose.Types.ObjectId(firmIdStr) : null;
  const filter: any = { type: { $in: ['SALES', 'OUTWARD'] } };
  if (firmIdStr) {
    filter.$or = [
      { firm_id: firmIdStr },
      { firmId: firmIdStr },
      ...(firmIdObj ? [{ firm_id: firmIdObj }, { firmId: firmIdObj }] : [])
    ];
  }

  let movements = await StockReg.find(filter).lean();
  if (movements.length === 0) {
    movements = await StockReg.find({ type: { $in: ['SALES', 'OUTWARD'] } }).lean();
  }

  const map = new Map<string, any>();
  for (const m of movements) {
    const key = m.item || 'Item';
    const qty = parseFloat(m.qty as any) || 0;
    const total = parseFloat(m.total as any) || (qty * (parseFloat(m.rate as any) || 0));

    if (!map.has(key)) {
      map.set(key, { item: key, hsn: m.hsn || '', totalSoldQty: 0, totalRevenue: 0, uom: m.uom || 'PCS' });
    }
    const entry = map.get(key);
    entry.totalSoldQty += qty;
    entry.totalRevenue += total;
  }

  const items = Array.from(map.values()).sort((a, b) => b.totalRevenue - a.totalRevenue);

  return {
    success: true,
    data: {
      items,
      totalRevenue: items.reduce((acc, i) => acc + i.totalRevenue, 0),
      totalQuantitySold: items.reduce((acc, i) => acc + i.totalSoldQty, 0)
    }
  };
});
