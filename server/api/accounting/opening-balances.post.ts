import mongoose from 'mongoose';
import OpeningBalance from '../../models/OpeningBalance';
import Ledger from '../../models/Ledger';
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

  const balance = await (OpeningBalance as any).findOneAndUpdate(
    { firmId: firmIdObj, accountHead: body.accountHead, financialYear },
    {
      accountType: body.accountType,
      debitAmount,
      creditAmount,
      createdBy: String(user._id)
    },
    { upsert: true, new: true, runValidators: true }
  );

  await (Ledger as any).deleteMany({
    firmId: firmIdObj,
    accountHead: body.accountHead,
    voucherType: 'OPENING_BALANCE',
    voucherGroupId: `OB-${financialYear}-${body.accountHead}`
  });

  if (debitAmount || creditAmount) {
    await (Ledger as any).create({
      firmId: firmIdObj,
      transactionDate: `${String(financialYear).split('-')[0]}-04-01`,
      accountHead: body.accountHead,
      accountType: body.accountType,
      debitAmount,
      creditAmount,
      narration: `Opening Balance for ${financialYear}`,
      voucherType: 'OPENING_BALANCE',
      voucherNo: `OB/${financialYear}/${body.accountHead}`,
      voucherGroupId: `OB-${financialYear}-${body.accountHead}`,
      createdBy: String(user._id)
    });
  }

  return { success: true, message: 'Opening balance saved successfully', data: balance };
});