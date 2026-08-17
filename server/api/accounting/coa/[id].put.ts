import mongoose from 'mongoose';
import ChartOfAccounts from '../../../models/ChartOfAccounts';
import OpeningBalance from '../../../models/OpeningBalance';
import { getCurrentFinancialYear } from '../../../utils/accounting/bill-utils';
import { requireAuthSession } from '../../../utils/auth';

export default defineEventHandler(async (event) => {
  const user = await requireAuthSession(event);
  const accountId = event.context.params?.id;

  if (!accountId || !mongoose.Types.ObjectId.isValid(accountId)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid account ID' });
  }

  const body = await readBody(event) || {};
  const firmIdObj = new mongoose.Types.ObjectId(String(user.firm_id));
  const update: any = { updated_by: new mongoose.Types.ObjectId(String(user._id)) };

  if (body.account_name) update.account_name = String(body.account_name).trim();
  if (body.account_type) update.account_type = String(body.account_type).toUpperCase();
  if (body.pan !== undefined) update.pan = body.pan ? String(body.pan).trim().toUpperCase() : null;
  if (body.aadhaar_number !== undefined) update.aadhaar_number = body.aadhaar_number ? String(body.aadhaar_number).trim() : null;
  if (body.gstin !== undefined) update.gstin = body.gstin ? String(body.gstin).trim().toUpperCase() : null;
  if (body.phone !== undefined) update.phone = body.phone ? String(body.phone).trim() : null;
  if (body.hsn_sac !== undefined) update.hsn_sac = body.hsn_sac ? String(body.hsn_sac).trim() : null;
  if (body.gst_rate !== undefined) update.gst_rate = body.gst_rate != null ? parseFloat(body.gst_rate) || null : null;
  if (body.bank_name !== undefined) update.bank_name = body.bank_name ? String(body.bank_name).trim() : null;
  if (body.account_number !== undefined) update.account_number = body.account_number ? String(body.account_number).trim() : null;
  if (body.ifsc_code !== undefined) update.ifsc_code = body.ifsc_code ? String(body.ifsc_code).trim().toUpperCase() : null;
  if (body.branch_name !== undefined) update.branch_name = body.branch_name ? String(body.branch_name).trim() : null;
  if (body.account_type_code !== undefined) update.account_type_code = body.account_type_code ? String(body.account_type_code).trim() : '10';
  if (body.is_active !== undefined) update.is_active = body.is_active !== false;

  const account = await (ChartOfAccounts as any).findOneAndUpdate(
    { _id: new mongoose.Types.ObjectId(accountId), firm_id: firmIdObj },
    { $set: update },
    { returnDocument: 'after', runValidators: true }
  );

  if (!account) {
    throw createError({ statusCode: 404, statusMessage: 'Account head not found' });
  }

  const openingRaw = body.opening_balance ?? body.openingBalance;
  if (openingRaw !== undefined) {
    const openingBalance = parseFloat(openingRaw) || 0;
    const balanceType = String(body.balance_type || body.balanceType || 'DR').toUpperCase();
    await (OpeningBalance as any).findOneAndUpdate(
      { firmId: firmIdObj, accountHead: account.account_name, financialYear: getCurrentFinancialYear() },
      {
        accountType: account.account_type,
        debitAmount: balanceType === 'DR' ? openingBalance : 0,
        creditAmount: balanceType === 'CR' ? openingBalance : 0,
        createdBy: String(user._id)
      },
      { upsert: true, returnDocument: 'after' }
    );
  }

  return { success: true, message: 'Account head updated successfully', data: account };
});