import { defineEventHandler } from 'h3';
import mongoose from 'mongoose';
import StockReg from '../../../models/StockReg';
import { requireAuthSession } from '../../../utils/auth';
import { connectDB } from '../../../plugins/mongodb';

const DEFAULT_SERVICES = [
  { item: 'Freight & Transportation', hsn: '9965', rate: 0, grate: 18 },
  { item: 'Installation Services', hsn: '9987', rate: 0, grate: 18 },
  { item: 'Consulting Charges', hsn: '9983', rate: 0, grate: 18 },
  { item: 'Repair & Maintenance', hsn: '9987', rate: 0, grate: 18 }
];

export default defineEventHandler(async (event) => {
  try {
    await connectDB();
    const user = await requireAuthSession(event);
    const firmIdStr = String(user.firm_id);
    const firmIdObj = mongoose.Types.ObjectId.isValid(firmIdStr) ? new mongoose.Types.ObjectId(firmIdStr) : null;

    const services = await StockReg.find({
      $or: [
        { firm_id: firmIdStr },
        { firmId: firmIdStr },
        ...(firmIdObj ? [{ firm_id: firmIdObj }, { firmId: firmIdObj }] : [])
      ],
      item_type: 'SERVICES'
    })
      .select('item hsn rate grate')
      .limit(50)
      .lean();

    const map = new Map<string, any>();
    for (const def of DEFAULT_SERVICES) {
      map.set(def.item.toLowerCase(), def);
    }

    for (const s of services) {
      if (s.item && !map.has(s.item.toLowerCase())) {
        map.set(s.item.toLowerCase(), {
          item: s.item,
          hsn: s.hsn || '9983',
          rate: s.rate || 0,
          grate: s.grate || 18
        });
      }
    }

    return { success: true, data: Array.from(map.values()) };
  } catch {
    return { success: true, data: DEFAULT_SERVICES };
  }
});
