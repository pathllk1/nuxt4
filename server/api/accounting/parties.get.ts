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

  const [parties, ledgerByPartyId, ledgerByHead] = await Promise.all([
    Party.find(filter).sort({ name: 1 }).lean(),
    Ledger.aggregate([
      { $match: { firmId: firmIdObj, partyId: { $exists: true, $ne: null } } },
      {
        $group: {
          _id: '$partyId',
          totalDebit: { $sum: '$debitAmount' },
          totalCredit: { $sum: '$creditAmount' }
        }
      }
    ]),
    Ledger.aggregate([
      { $match: { firmId: firmIdObj } },
      {
        $group: {
          _id: '$accountHead',
          totalDebit: { $sum: '$debitAmount' },
          totalCredit: { $sum: '$creditAmount' }
        }
      }
    ])
  ]);

  const partyIdMap = new Map<string, { totalDebit: number; totalCredit: number }>();
  ledgerByPartyId.forEach((item: any) => {
    partyIdMap.set(String(item._id), { totalDebit: item.totalDebit || 0, totalCredit: item.totalCredit || 0 });
  });

  const headMap = new Map<string, { totalDebit: number; totalCredit: number }>();
  ledgerByHead.forEach((item: any) => {
    if (item._id) headMap.set(String(item._id).trim().toLowerCase(), { totalDebit: item.totalDebit || 0, totalCredit: item.totalCredit || 0 });
  });

  const enrichedParties = parties.map((p: any) => {
    const ob = Number(p.openingBalance) || 0;
    const obType = (p.balanceType || (p.partyType === 'SUPPLIER' ? 'CR' : 'DR')).toUpperCase();
    const obDr = obType === 'DR' ? ob : 0;
    const obCr = obType === 'CR' ? ob : 0;

    // Check by partyId first, then fallback to accountHead (party name)
    const byId = partyIdMap.get(String(p._id));
    const byHead = headMap.get(String(p.name || '').trim().toLowerCase());

    const ledgerDr = (byId?.totalDebit ?? byHead?.totalDebit) || 0;
    const ledgerCr = (byId?.totalCredit ?? byHead?.totalCredit) || 0;

    const netBalance = (obDr + ledgerDr) - (obCr + ledgerCr);
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
