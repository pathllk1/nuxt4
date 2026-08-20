import { defineEventHandler, getQuery } from 'h3';
import mongoose from 'mongoose';
import { requireAuthSession } from '../../../utils/auth';
import { LedgerService } from '../../../utils/accounting/ledger.service';

export default defineEventHandler(async (event) => {
  const session = await requireAuthSession(event);
  const query = getQuery(event);

  const firmIdObj = new mongoose.Types.ObjectId(String(session.firm_id));

  const date = query.date ? String(query.date) : undefined;
  const fromDate = query.fromDate ? String(query.fromDate) : undefined;
  const toDate = query.toDate ? String(query.toDate) : undefined;
  const voucherType = query.voucherType ? String(query.voucherType) : undefined;
  const accountHead = query.accountHead ? String(query.accountHead) : undefined;
  const partyId = query.partyId ? String(query.partyId) : undefined;
  const search = query.search ? String(query.search) : undefined;
  const limit = query.limit ? parseInt(String(query.limit), 10) : 500;
  const offset = query.offset ? parseInt(String(query.offset), 10) : 0;

  const result = await LedgerService.getDayBook(firmIdObj, {
    date,
    fromDate,
    toDate,
    voucherType,
    accountHead,
    partyId,
    search,
    limit,
    offset
  });

  return {
    success: true,
    data: result
  };
});
