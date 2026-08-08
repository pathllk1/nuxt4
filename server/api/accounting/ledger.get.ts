import mongoose from 'mongoose';
import Ledger from '../../models/Ledger';
import { requireAuthSession } from '../../utils/auth';
import { LedgerService } from '../../utils/accounting/ledger.service';

export default defineEventHandler(async (event) => {
  const user = await requireAuthSession(event);
  const query = getQuery(event);
  const { accountHead, partyId, voucherType, dateFrom, dateTo, fromDate, toDate, limit, offset } = query;

  const firmIdObj = new mongoose.Types.ObjectId(user.firm_id as string);
  const fDate = (fromDate || dateFrom) ? String(fromDate || dateFrom) : undefined;
  const tDate = (toDate || dateTo) ? String(toDate || dateTo) : undefined;

  // If a specific accountHead is requested, return full statement model with starting balance & running balances
  if (accountHead) {
    const statement = await LedgerService.getLedger(firmIdObj, String(accountHead), fDate, tDate);
    return {
      success: true,
      data: statement
    };
  }

  const filter: any = { firmId: firmIdObj };

  if (partyId && mongoose.Types.ObjectId.isValid(partyId as string)) {
    filter.partyId = new mongoose.Types.ObjectId(partyId as string);
  }
  if (voucherType) filter.voucherType = String(voucherType).toUpperCase();
  if (fDate || tDate) {
    filter.transactionDate = {};
    if (fDate) filter.transactionDate.$gte = fDate;
    if (tDate) filter.transactionDate.$lte = tDate;
  }

  const limitNum = Math.min(parseInt(limit as string) || 200, 1000);
  const offsetNum = parseInt(offset as string) || 0;

  const total = await Ledger.countDocuments(filter);
  const entries = await Ledger.find(filter)
    .sort({ transactionDate: -1, createdAt: -1 })
    .skip(offsetNum)
    .limit(limitNum)
    .lean();

  return {
    success: true,
    total,
    count: entries.length,
    data: entries
  };
});
