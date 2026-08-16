import mongoose from 'mongoose';
import ChartOfAccounts from '../../models/ChartOfAccounts';
import OpeningBalance from '../../models/OpeningBalance';
import { getCurrentFinancialYear } from '../../utils/accounting/bill-utils';
import { requireAuthSession } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  const user = await requireAuthSession(event);
  const body = await readBody(event) || {};

  if (!body.account_name || !body.account_type) {
    throw createError({ statusCode: 400, statusMessage: 'Account name and type are required' });
  }

  const firmIdObj = new mongoose.Types.ObjectId(String(user.firm_id));
  const userIdObj = new mongoose.Types.ObjectId(String(user._id));
  const openingBalance = parseFloat(body.opening_balance ?? body.openingBalance) || 0;
  const balanceType = String(body.balance_type || body.balanceType || 'DR').toUpperCase();

  try {
    const account = await (ChartOfAccounts as any).create({
      firm_id: firmIdObj,
      account_name: String(body.account_name).trim(),
      account_type: String(body.account_type).toUpperCase(),
      pan: body.pan ? String(body.pan).trim().toUpperCase() : null,
      aadhaar_number: body.aadhaar_number ? String(body.aadhaar_number).trim() : null,
      gstin: body.gstin ? String(body.gstin).trim().toUpperCase() : null,
      phone: body.phone ? String(body.phone).trim() : null,
      hsn_sac: body.hsn_sac ? String(body.hsn_sac).trim() : null,
      gst_rate: body.gst_rate != null ? parseFloat(body.gst_rate) || null : null,
      description: body.description ? String(body.description).trim() : null,
      is_system: false,
      is_active: body.is_active !== false,
      created_by: userIdObj,
      updated_by: userIdObj
    });

    if (openingBalance > 0) {
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

    return { success: true, message: 'Account head created successfully', data: account };
  } catch (error: any) {
    if (error?.code === 11000) {
      throw createError({ statusCode: 400, statusMessage: 'Account name already exists for this firm' });
    }
    throw createError({ statusCode: 500, statusMessage: error.message || 'Failed to create account head' });
  }
});