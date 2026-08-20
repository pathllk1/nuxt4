import { defineEventHandler } from 'h3';
import mongoose from 'mongoose';
import Bill from '../../../models/Bill';
import { requireAuthSession } from '../../../utils/auth';
import { connectDB } from '../../../plugins/mongodb';

const DEFAULT_CHARGES = [
  { name: 'Freight Charges', type: 'freight', hsnSac: '9965', grate: 18 },
  { name: 'Packaging & Handling', type: 'packaging', hsnSac: '9985', grate: 18 },
  { name: 'Insurance Charges', type: 'insurance', hsnSac: '9971', grate: 18 },
  { name: 'Loading / Unloading', type: 'loading', hsnSac: '9965', grate: 18 }
];

export default defineEventHandler(async (event) => {
  try {
    await connectDB();
    const user = await requireAuthSession(event);
    const firmIdStr = String(user.firm_id);
    const firmIdObj = mongoose.Types.ObjectId.isValid(firmIdStr) ? new mongoose.Types.ObjectId(firmIdStr) : null;

    let bills: any[] = [];
    try {
      bills = await Bill.find({
        $or: [
          { firmId: firmIdStr },
          { firm_id: firmIdStr },
          ...(firmIdObj ? [{ firmId: firmIdObj }, { firm_id: firmIdObj }] : [])
        ],
        otherCharges: { $exists: true, $ne: null }
      })
        .select('otherCharges')
        .sort({ createdAt: -1 })
        .limit(100)
        .lean();
    } catch {
      // Fallback if DB query fails
    }

    const chargesMap = new Map<string, any>();
    
    // Seed default suggestions
    for (const def of DEFAULT_CHARGES) {
      chargesMap.set(def.name.toLowerCase(), def);
    }

    for (const bill of bills) {
      if (!Array.isArray(bill.otherCharges)) continue;
      for (const charge of bill.otherCharges) {
        const name = charge.name || charge.type;
        if (name && !chargesMap.has(name.toLowerCase())) {
          chargesMap.set(name.toLowerCase(), {
            name: name,
            type: charge.type || 'other',
            hsnSac: charge.hsnSac || '',
            grate: charge.grate || charge.gstRate || 18
          });
        }
      }
    }

    return {
      success: true,
      data: Array.from(chargesMap.values())
    };
  } catch {
    return {
      success: true,
      data: DEFAULT_CHARGES
    };
  }
});
