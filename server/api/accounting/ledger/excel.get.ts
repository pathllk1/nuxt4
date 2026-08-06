import { defineEventHandler, getQuery, createError, setHeader } from 'h3';
import mongoose from 'mongoose';
import Firm from '../../../models/Firm';
import { requireAuthSession } from '../../../utils/auth';
import { LedgerService } from '../../../utils/accounting/ledger.service';
import { generateLedgerExcel } from '../../../utils/accounting/excel-export.utils';

export default defineEventHandler(async (event) => {
  const session = await requireAuthSession(event);
  const query = getQuery(event);
  const accountHead = String(query.accountHead || query.account_head || '');

  if (!accountHead) {
    throw createError({ statusCode: 400, statusMessage: 'accountHead is required' });
  }

  const fromDate = query.fromDate ? String(query.fromDate) : undefined;
  const toDate = query.toDate ? String(query.toDate) : undefined;

  const firmIdObj = new mongoose.Types.ObjectId(String(session.firm_id));
  const ledgerData = await LedgerService.getLedger(firmIdObj, accountHead, fromDate, toDate);
  const firm = await Firm.findById(session.firm_id).lean();

  const buffer = await generateLedgerExcel({
    firmName: (firm as any)?.name || 'Company',
    periodText: fromDate && toDate ? `${fromDate} to ${toDate}` : 'All Time',
    accountHead,
    startingBal: ledgerData.startingBal,
    mappedEntries: ledgerData.entries,
    totalDebits: ledgerData.totalDebits,
    totalCredits: ledgerData.totalCredits,
    finalBalance: ledgerData.finalBalance,
    finalBalanceType: ledgerData.finalBalanceType,
  });

  setHeader(event, 'Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  setHeader(event, 'Content-Disposition', `attachment; filename="Ledger_${accountHead.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx"`);
  return buffer;
});
