import { defineEventHandler, getQuery, setHeader } from 'h3';
import mongoose from 'mongoose';
import Firm from '../../../../models/Firm';
import { requireAuthSession } from '../../../../utils/auth';
import { LedgerService } from '../../../../utils/accounting/ledger.service';
import { generateBalanceSheetExcel } from '../../../../utils/accounting/excel-export.utils';

export default defineEventHandler(async (event) => {
  const session = await requireAuthSession(event);
  const query = getQuery(event);

  const asOfDate = query.asOfDate ? String(query.asOfDate) : (query.toDate ? String(query.toDate) : undefined);

  const firmIdObj = new mongoose.Types.ObjectId(String(session.firm_id));
  const bsModel = await LedgerService.getBalanceSheetModel(firmIdObj, asOfDate);
  const firm = await Firm.findById(session.firm_id).lean();

  const buffer = await generateBalanceSheetExcel({
    firmName: (firm as any)?.name || 'Company',
    periodText: asOfDate ? `As of ${asOfDate}` : 'As of Today',
    bsModel,
  });

  setHeader(event, 'Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  setHeader(event, 'Content-Disposition', 'attachment; filename="Balance_Sheet.xlsx"');
  return buffer;
});
