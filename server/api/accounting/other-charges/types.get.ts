import { defineEventHandler } from 'h3';
import Bill from '../../../models/Bill';

const DEFAULT_CHARGES = [
  { name: 'Freight Charges', type: 'freight', hsnSac: '9965', grate: 18 },
  { name: 'Packaging & Handling', type: 'packaging', hsnSac: '9985', grate: 18 },
  { name: 'Insurance Charges', type: 'insurance', hsnSac: '9971', grate: 18 },
  { name: 'Loading / Unloading', type: 'loading', hsnSac: '9965', grate: 18 }
];

export default defineEventHandler(async (event) => {
  try {
    let bills: any[] = [];
    try {
      bills = await Bill.find({ otherCharges: { $exists: true, $ne: null } })
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
  } catch (error: any) {
    return {
      success: true,
      data: DEFAULT_CHARGES
    };
  }
});
