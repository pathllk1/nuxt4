import { defineEventHandler, getQuery, setHeader } from 'h3';
import mongoose from 'mongoose';
import Firm from '../../../../models/Firm';
import { requireAuthSession } from '../../../../utils/auth';
import { LedgerService } from '../../../../utils/accounting/ledger.service';
import { exportBalanceSheetToPdfBuffer } from '../../../../utils/accounting/pdf-export.utils';

export default defineEventHandler(async (event) => {
  const session = await requireAuthSession(event);
  const query = getQuery(event);

  const asOfDate = query.asOfDate ? String(query.asOfDate) : (query.toDate ? String(query.toDate) : undefined);

  const firmIdObj = new mongoose.Types.ObjectId(String(session.firm_id));
  const bsModel = await LedgerService.getBalanceSheetModel(firmIdObj, asOfDate);
  const firm = await Firm.findById(session.firm_id).lean();

  const buffer = await exportBalanceSheetToPdfBuffer({
    firmName: (firm as any)?.name || 'Company',
    periodText: asOfDate ? `As of ${asOfDate}` : 'As of Today',
    bsModel,
  });

  setHeader(event, 'Content-Type', 'application/pdf');
  setHeader(event, 'Content-Disposition', 'attachment; filename="Balance_Sheet.pdf"');
  return buffer;
});
