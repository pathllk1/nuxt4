import { defineEventHandler, getQuery, setHeader } from 'h3';
import mongoose from 'mongoose';
import Firm from '../../../models/Firm';
import { requireAuthSession } from '../../../utils/auth';
import { LedgerService } from '../../../utils/accounting/ledger.service';
import { generateDayBookExcel } from '../../../utils/accounting/excel-export.utils';

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

  const result = await LedgerService.getDayBook(firmIdObj, {
    date,
    fromDate,
    toDate,
    voucherType,
    accountHead,
    partyId,
    search,
    limit: 5000,
    offset: 0
  });

  const firm = await Firm.findById(session.firm_id).lean();
  const fDate = fromDate || date;
  const tDate = toDate || date;
  const periodText = fDate && tDate ? (fDate === tDate ? fDate : `${fDate} to ${tDate}`) : (fDate || tDate || 'All Time');

  const buffer = await generateDayBookExcel({
    firmName: (firm as any)?.name || 'Company',
    periodText,
    vouchers: result.vouchers,
    summary: result.summary
  });

  setHeader(event, 'Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  setHeader(event, 'Content-Disposition', `attachment; filename="DayBook_${periodText.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx"`);
  return buffer;
});
