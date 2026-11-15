import { defineEventHandler } from 'h3';
import mongoose from 'mongoose';
import Bill from '../../../models/Bill';
import ChartOfAccounts from '../../../models/ChartOfAccounts';
import { requireAuthSession } from '../../../utils/auth';
import { connectDB } from '../../../plugins/mongodb';

function getChargeIcon(name: string): string {
  const n = (name || '').toLowerCase();
  if (n.includes('freight') || n.includes('transport') || n.includes('cartage') || n.includes('carriage')) return '🚚';
  if (n.includes('pack') || n.includes('handling')) return '📦';
  if (n.includes('insurance')) return '🛡️';
  if (n.includes('load') || n.includes('unload')) return '🏗️';
  if (n.includes('courier') || n.includes('postage') || n.includes('express')) return '⚡';
  if (n.includes('round')) return '🎯';
  if (n.includes('demurrage') || n.includes('detention') || n.includes('port')) return '⚓';
  if (n.includes('install') || n.includes('erect') || n.includes('repair')) return '🔧';
  if (n.includes('commis') || n.includes('broker')) return '🤝';
  if (n.includes('travel') || n.includes('fuel')) return '⛽';
  if (n.includes('cess') || n.includes('duty') || n.includes('toll')) return '🏷️';
  return '📌';
}

function inferDefaultSac(name: string): string {
  const n = (name || '').toLowerCase();
  if (n.includes('freight') || n.includes('transport') || n.includes('cartage') || n.includes('carriage')) return '9965';
  if (n.includes('pack') || n.includes('handling')) return '9985';
  if (n.includes('insurance')) return '9971';
  if (n.includes('load') || n.includes('unload')) return '9965';
  if (n.includes('courier') || n.includes('postage') || n.includes('express')) return '9968';
  if (n.includes('demurrage') || n.includes('detention')) return '9967';
  if (n.includes('install') || n.includes('erect')) return '9954';
  if (n.includes('commis') || n.includes('broker')) return '9983';
  if (n.includes('round')) return '9999';
  return '9997';
}

const DEFAULT_CHARGES = [
  { name: 'Freight Charges', type: 'freight', hsnSac: '9965', grate: 18, icon: '🚚', source: 'default' },
  { name: 'Packaging & Handling', type: 'packaging', hsnSac: '9985', grate: 18, icon: '📦', source: 'default' },
  { name: 'Insurance Charges', type: 'insurance', hsnSac: '9971', grate: 18, icon: '🛡️', source: 'default' },
  { name: 'Loading / Unloading', type: 'loading', hsnSac: '9965', grate: 18, icon: '🏗️', source: 'default' },
  { name: 'Courier & Delivery', type: 'courier', hsnSac: '9968', grate: 18, icon: '⚡', source: 'default' },
  { name: 'Demurrage / Detention', type: 'demurrage', hsnSac: '9967', grate: 18, icon: '⚓', source: 'default' },
  { name: 'Installation & Erection', type: 'installation', hsnSac: '9954', grate: 18, icon: '🔧', source: 'default' },
  { name: 'Commission & Brokerage', type: 'commission', hsnSac: '9983', grate: 18, icon: '🤝', source: 'default' },
  { name: 'Round Off', type: 'roundoff', hsnSac: '9999', grate: 0, icon: '🎯', source: 'default' },
];

const EXCLUDED_SYSTEM_ACCOUNTS = new Set([
  'sales', 'purchases', 'inventory', 'cogs', 'cash in hand',
  'cgst input credit', 'sgst input credit', 'igst input credit', 'cess input credit',
  'cgst payable', 'sgst payable', 'igst payable', 'cess payable',
  'difference in opening balances', 'opening balance', 'advance to employees',
  'salaries & wages', 'epf payable', 'esic payable', 'other deductions', 'tds payable u/s 194c'
]);

export default defineEventHandler(async (event) => {
  try {
    await connectDB();
    const user = await requireAuthSession(event);
    const firmIdStr = String(user.firm_id);
    const firmIdObj = mongoose.Types.ObjectId.isValid(firmIdStr) ? new mongoose.Types.ObjectId(firmIdStr) : null;

    const chargesMap = new Map<string, any>();

    // 1. Seed standard statutory GST charges
    for (const def of DEFAULT_CHARGES) {
      chargesMap.set(def.name.toLowerCase(), def);
    }

    // 2. Query ChartOfAccounts from MongoDB for the firm
    try {
      const coaAccounts = await ChartOfAccounts.find({
        $or: [
          { firmId: firmIdStr },
          { firm_id: firmIdStr },
          ...(firmIdObj ? [{ firmId: firmIdObj }, { firm_id: firmIdObj }] : [])
        ],
        is_active: { $ne: false }
      })
        .select('account_name account_type hsn_sac gst_rate is_system')
        .lean();

      for (const acc of coaAccounts) {
        const name = (acc.account_name || '').trim();
        if (!name) continue;
        const lowerName = name.toLowerCase();

        if (EXCLUDED_SYSTEM_ACCOUNTS.has(lowerName)) continue;

        const isExpenseOrCharge = /expense|charge|freight|cartage|pack|load|unload|delivery|courier|transport|insurance|demurrage|handling|cess|round.?off|commission|general/i.test(
          `${acc.account_type || ''} ${name}`
        );

        if (isExpenseOrCharge) {
          const existing = chargesMap.get(lowerName) || {};
          chargesMap.set(lowerName, {
            name: name,
            type: acc.account_type || 'expense',
            hsnSac: acc.hsn_sac || existing.hsnSac || inferDefaultSac(name),
            grate: acc.gst_rate !== null && acc.gst_rate !== undefined ? acc.gst_rate : (existing.grate !== undefined ? existing.grate : 18),
            source: 'coa',
            icon: existing.icon || getChargeIcon(name)
          });
        }
      }
    } catch (coaErr) {
      console.warn('[other-charges/types] Failed to fetch COA:', coaErr);
    }

    // 3. Query historical Other Charges from past Bills in MongoDB
    try {
      const bills = await Bill.find({
        $or: [
          { firmId: firmIdStr },
          { firm_id: firmIdStr },
          ...(firmIdObj ? [{ firmId: firmIdObj }, { firm_id: firmIdObj }] : [])
        ],
        otherCharges: { $exists: true, $ne: null }
      })
        .select('otherCharges')
        .sort({ createdAt: -1 })
        .limit(150)
        .lean();

      for (const bill of bills) {
        if (!Array.isArray(bill.otherCharges)) continue;
        for (const charge of bill.otherCharges) {
          const name = (charge.name || charge.type || '').trim();
          if (!name) continue;
          const lowerName = name.toLowerCase();

          if (!chargesMap.has(lowerName)) {
            chargesMap.set(lowerName, {
              name: name,
              type: charge.type || 'other',
              hsnSac: charge.hsnSac || inferDefaultSac(name),
              grate: charge.grate !== undefined ? charge.grate : (charge.gstRate !== undefined ? charge.gstRate : 18),
              source: 'history',
              icon: getChargeIcon(name)
            });
          }
        }
      }
    } catch (billErr) {
      console.warn('[other-charges/types] Failed to fetch historical bills:', billErr);
    }

    return {
      success: true,
      data: Array.from(chargesMap.values())
    };
  } catch (err: any) {
    console.error('[other-charges/types] Error:', err);
    return {
      success: true,
      data: DEFAULT_CHARGES
    };
  }
});
