import { defineEventHandler, getQuery, createError, setHeader } from 'h3';
import mongoose from 'mongoose';
import Firm from '../../../../models/Firm';
import { requireAuthSession } from '../../../../utils/auth';
import { LedgerService } from '../../../../utils/accounting/ledger.service';
import { exportDrillDownToPdfBuffer } from '../../../../utils/accounting/pdf-export.utils';

export default defineEventHandler(async (event) => {
  const session = await requireAuthSession(event);
  const query = getQuery(event);
  const type = String(query.type || query.accountType || '');

  if (!type) {
    throw createError({ statusCode: 400, statusMessage: 'type/accountType is required' });
  }

  const fromDate = query.fromDate ? String(query.fromDate) : undefined;
  const toDate = query.toDate ? String(query.toDate) : undefined;

  const firmIdObj = new mongoose.Types.ObjectId(String(session.firm_id));
  const trialBalance = await LedgerService.getTrialBalance(firmIdObj, fromDate, toDate);
  const firm = await Firm.findById(session.firm_id).lean();

  const typeUpper = type.toUpperCase();
  const matchingAccounts = trialBalance.filter(a => {
    const aType = (a.accountType || '').toUpperCase();
    if (typeUpper === 'SUNDRY_CREDITORS' || typeUpper === 'CREDITOR') {
      return ['CREDITOR', 'SUNDRY_CREDITORS', 'PAYABLE'].includes(aType);
    }
    if (typeUpper === 'SUNDRY_DEBTORS' || typeUpper === 'DEBTOR') {
      return ['DEBTOR', 'SUNDRY_DEBTORS', 'RECEIVABLE'].includes(aType);
    }
    return aType === typeUpper;
  });

  const grandTotalDebit = matchingAccounts.reduce((sum, a) => sum + (a.totalDebit || 0), 0);
  const grandTotalCredit = matchingAccounts.reduce((sum, a) => sum + (a.totalCredit || 0), 0);

  const buffer = await exportDrillDownToPdfBuffer({
    firmName: (firm as any)?.name || 'Company',
    periodText: fromDate && toDate ? `${fromDate} to ${toDate}` : (toDate ? `As of ${toDate}` : 'All Time'),
    categoryTitle: type.replace(/_/g, ' '),
    accounts: matchingAccounts,
    grandTotalDebit,
    grandTotalCredit,
  });

  setHeader(event, 'Content-Type', 'application/pdf');
  setHeader(event, 'Content-Disposition', `attachment; filename="DrillDown_${type.replace(/[^a-zA-Z0-9]/g, '_')}.pdf"`);
  return buffer;
});
