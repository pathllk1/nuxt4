import mongoose from 'mongoose';
import Party from '../../models/Party';
import Ledger from '../../models/Ledger';
import { requireAuthSession } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  const user = await requireAuthSession(event);
  const query = getQuery(event);
  const { type, search } = query;

  const firmIdObj = new mongoose.Types.ObjectId(String(user.firm_id));
  const filter: any = { firmId: firmIdObj };

  if (type) {
    filter.partyType = { $in: [(type as string).toUpperCase(), 'BOTH'] };
  }
  if (search) {
    const s = String(search).trim();
    filter.$or = [
      { name: { $regex: s, $options: 'i' } },
      { gstin: { $regex: s, $options: 'i' } },
      { contact: { $regex: s, $options: 'i' } }
    ];
  }

  // 1. Fetch parties
  // 2. Aggregate all ledger entries by normalized account head (standard double-entry ledger)
  // 3. Aggregate any entries tagged with partyId (to catch renamed accounts or legacy entries without double-counting)
  const [parties, ledgerByHead, ledgerByPartyId] = await Promise.all([
    Party.find(filter).sort({ name: 1 }).lean(),
    Ledger.aggregate([
      { $match: { firmId: firmIdObj } },
      {
        $group: {
          _id: { $toLower: { $trim: { input: { $ifNull: ['$accountHead', ''] } } } },
          totalDebit: { $sum: '$debitAmount' },
          totalCredit: { $sum: '$creditAmount' }
        }
      }
    ]),
    Ledger.aggregate([
      { $match: { firmId: firmIdObj, partyId: { $exists: true, $ne: null } } },
      {
        $group: {
          _id: {
            partyId: '$partyId',
            head: { $toLower: { $trim: { input: { $ifNull: ['$accountHead', ''] } } } }
          },
          totalDebit: { $sum: '$debitAmount' },
          totalCredit: { $sum: '$creditAmount' }
        }
      }
    ])
  ]);

  const headMap = new Map<string, { totalDebit: number; totalCredit: number }>();
  ledgerByHead.forEach((item: any) => {
    if (item._id) {
      headMap.set(String(item._id), { totalDebit: item.totalDebit || 0, totalCredit: item.totalCredit || 0 });
    }
  });

  const partyOrphanMap = new Map<string, Array<{ head: string; totalDebit: number; totalCredit: number }>>();
  ledgerByPartyId.forEach((item: any) => {
    const pId = String(item._id?.partyId);
    const head = String(item._id?.head || '');
    if (!partyOrphanMap.has(pId)) partyOrphanMap.set(pId, []);
    partyOrphanMap.get(pId)!.push({ head, totalDebit: item.totalDebit || 0, totalCredit: item.totalCredit || 0 });
  });

  const enrichedParties = parties.map((p: any) => {
    const ob = Number(p.openingBalance) || 0;
    const obType = (p.balanceType || (p.partyType === 'SUPPLIER' ? 'CR' : 'DR')).toUpperCase();
    const obDr = obType === 'DR' ? ob : 0;
    const obCr = obType === 'CR' ? ob : 0;

    const normName = String(p.name || '').trim().toLowerCase();
    const headData = headMap.get(normName) || { totalDebit: 0, totalCredit: 0 };

    let totalDr = headData.totalDebit;
    let totalCr = headData.totalCredit;

    // Add any entries tagged with this partyId whose accountHead did not match p.name (prevents double counting while catching mismatches)
    const partyEntries = partyOrphanMap.get(String(p._id)) || [];
    partyEntries.forEach(pe => {
      if (pe.head !== normName) {
        totalDr += pe.totalDebit;
        totalCr += pe.totalCredit;
      }
    });

    const netBalance = (obDr + totalDr) - (obCr + totalCr);
    const closingBalance = Math.abs(Number(netBalance.toFixed(2)));
    const closingBalanceType: 'DR' | 'CR' | 'NIL' = netBalance > 0.005 ? 'DR' : (netBalance < -0.005 ? 'CR' : 'NIL');

    return {
      ...p,
      closingBalance,
      closingBalanceType,
      formattedBalance: closingBalance === 0 ? '₹0.00' : `₹${closingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${closingBalanceType}`
    };
  });

  return {
    success: true,
    count: enrichedParties.length,
    data: enrichedParties
  };
});
