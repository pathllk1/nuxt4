import { defineEventHandler, getQuery, setHeader } from 'h3';
import mongoose from 'mongoose';
import Firm from '../../../../models/Firm';
import { requireAuthSession } from '../../../../utils/auth';
import { LedgerService } from '../../../../utils/accounting/ledger.service';
import { exportProfitLossToPdfBuffer } from '../../../../utils/accounting/pdf-export.utils';

export default defineEventHandler(async (event) => {
  const session = await requireAuthSession(event);
  const query = getQuery(event);

  const fromDate = query.fromDate ? String(query.fromDate) : undefined;
  const toDate = query.toDate ? String(query.toDate) : undefined;

  const firmIdObj = new mongoose.Types.ObjectId(String(session.firm_id));
  const plModel = await LedgerService.getProfitAndLossModel(firmIdObj, fromDate, toDate);
  const firm = await Firm.findById(session.firm_id).lean();

  const buffer = await exportProfitLossToPdfBuffer({
    firmName: (firm as any)?.name || 'Company',
    periodText: fromDate && toDate ? `${fromDate} to ${toDate}` : 'All Time',
    plModel,
  });

  setHeader(event, 'Content-Type', 'application/pdf');
  setHeader(event, 'Content-Disposition', 'attachment; filename="Profit_and_Loss.pdf"');
  return buffer;
});
