import { defineEventHandler, getQuery, setHeader } from 'h3';
import mongoose from 'mongoose';
import Firm from '../../../../models/Firm';
import { requireAuthSession } from '../../../../utils/auth';
import { LedgerService } from '../../../../utils/accounting/ledger.service';
import { generateTrialBalanceExcel } from '../../../../utils/accounting/excel-export.utils';

export default defineEventHandler(async (event) => {
  const session = await requireAuthSession(event);
  const query = getQuery(event);

  const fromDate = query.fromDate ? String(query.fromDate) : undefined;
  const toDate = query.toDate ? String(query.toDate) : undefined;

  const firmIdObj = new mongoose.Types.ObjectId(String(session.firm_id));
  const tbData = await LedgerService.getTrialBalance(firmIdObj, fromDate, toDate);
  const firm = await Firm.findById(session.firm_id).lean();

  let totalDr = 0;
  let totalCr = 0;
  tbData.forEach((row: any) => {
    totalDr += row.totalDebit || 0;
    totalCr += row.totalCredit || 0;
  });

  const diff = Math.abs(totalDr - totalCr);
  const isBalanced = diff < 0.01;

  const buffer = await generateTrialBalanceExcel({
    firmName: (firm as any)?.name || 'Company',
    periodText: fromDate && toDate ? `${fromDate} to ${toDate}` : 'All Time',
    tbData,
    isBalanced,
    diff,
  });

  setHeader(event, 'Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  setHeader(event, 'Content-Disposition', 'attachment; filename="Trial_Balance.xlsx"');
  return buffer;
});
