import mongoose from 'mongoose';
import { OpeningBalanceService } from '../../utils/accounting/opening-balance.service';
import { getCurrentFinancialYear } from '../../utils/accounting/bill-utils';
import { requireAuthSession } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  const user = await requireAuthSession(event);
  const body = await readBody(event) || {};

  if (!body.accountHead || !body.accountType) {
    throw createError({ statusCode: 400, statusMessage: 'accountHead and accountType are required' });
  }

  const firmIdObj = new mongoose.Types.ObjectId(String(user.firm_id));
  const financialYear = body.financialYear || getCurrentFinancialYear();
  const debitAmount = parseFloat(body.debitAmount) || 0;
  const creditAmount = parseFloat(body.creditAmount) || 0;

  const amount = debitAmount > 0 ? debitAmount : creditAmount;
  const balanceType = debitAmount > 0 ? 'DR' : 'CR';

  const result = await OpeningBalanceService.syncOpeningBalance({
    firmId: firmIdObj,
    accountHead: body.accountHead,
    accountType: body.accountType,
    amount,
    balanceType,
    financialYear,
    userId: String(user._id)
  });

  return { success: true, message: 'Opening balance saved successfully', data: result.data };
});