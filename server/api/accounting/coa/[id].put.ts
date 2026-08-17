import mongoose from 'mongoose';
import ChartOfAccounts from '../../../models/ChartOfAccounts';
import Party from '../../../models/Party';
import BankAccount from '../../../models/BankAccount';
import OpeningBalance from '../../../models/OpeningBalance';
import { getCurrentFinancialYear } from '../../../utils/accounting/bill-utils';
import { requireAuthSession } from '../../../utils/auth';
import { getSql, connectPostgres } from '../../../utils/pg.config';

export default defineEventHandler(async (event) => {
  const user = await requireAuthSession(event);
  let accountId = event.context.params?.id;

  if (!accountId || !mongoose.Types.ObjectId.isValid(accountId)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid account ID' });
  }

  const body = await readBody(event) || {};
  const firmIdStr = String(user.firm_id);
  const firmIdObj = new mongoose.Types.ObjectId(firmIdStr);
  const update: any = { updated_by: new mongoose.Types.ObjectId(String(user._id)) };

  if (body.account_name || body.name) update.account_name = String(body.account_name || body.name).trim();
  if (body.account_type || body.accountType) update.account_type = String(body.account_type || body.accountType).toUpperCase();
  if (body.pan !== undefined) update.pan = body.pan ? String(body.pan).trim().toUpperCase() : null;
  if (body.aadhaar_number !== undefined || body.aadhaar !== undefined) update.aadhaar_number = (body.aadhaar_number || body.aadhaar) ? String(body.aadhaar_number || body.aadhaar).trim() : null;
  if (body.gstin !== undefined) update.gstin = body.gstin ? String(body.gstin).trim().toUpperCase() : null;
  if (body.phone !== undefined || body.contact !== undefined) update.phone = (body.phone || body.contact) ? String(body.phone || body.contact).trim() : null;
  if (body.hsn_sac !== undefined) update.hsn_sac = body.hsn_sac ? String(body.hsn_sac).trim() : null;
  if (body.gst_rate !== undefined) update.gst_rate = body.gst_rate != null ? parseFloat(body.gst_rate) || null : null;
  if (body.bank_name !== undefined || body.bankName !== undefined) update.bank_name = (body.bank_name || body.bankName) ? String(body.bank_name || body.bankName).trim() : null;
  if (body.account_number !== undefined || body.accountNumber !== undefined) update.account_number = (body.account_number || body.accountNumber) ? String(body.account_number || body.accountNumber).trim() : null;
  if (body.ifsc_code !== undefined || body.ifscCode !== undefined) update.ifsc_code = (body.ifsc_code || body.ifscCode) ? String(body.ifsc_code || body.ifscCode).trim().toUpperCase() : null;
  if (body.branch_name !== undefined || body.branchName !== undefined) update.branch_name = (body.branch_name || body.branchName) ? String(body.branch_name || body.branchName).trim() : null;
  if (body.account_type_code !== undefined || body.accountTypeCode !== undefined) update.account_type_code = (body.account_type_code || body.accountTypeCode) ? String(body.account_type_code || body.accountTypeCode).trim() : '10';
  if (body.is_active !== undefined) update.is_active = body.is_active !== false;

  let prevAccount = await (ChartOfAccounts as any).findOne({
    _id: new mongoose.Types.ObjectId(accountId),
    firm_id: firmIdObj
  });

  if (!prevAccount) {
    const bankDoc = await (BankAccount as any).findOne({ _id: new mongoose.Types.ObjectId(accountId), firm_id: firmIdObj });
    if (bankDoc) {
      prevAccount = await (ChartOfAccounts as any).findOne({
        $or: [{ account_name: bankDoc.account_name }, { account_number: bankDoc.account_number }],
        firm_id: firmIdObj
      });
      if (prevAccount) {
        accountId = String(prevAccount._id);
      }
    }
  }

  if (!prevAccount) {
    const partyDoc = await (Party as any).findOne({ _id: new mongoose.Types.ObjectId(accountId), firmId: firmIdObj });
    if (partyDoc) {
      prevAccount = await (ChartOfAccounts as any).findOne({
        account_name: partyDoc.name,
        firm_id: firmIdObj
      });
      if (prevAccount) {
        accountId = String(prevAccount._id);
      }
    }
  }

  if (!prevAccount) {
    throw createError({ statusCode: 404, statusMessage: 'Account head not found' });
  }

  const account = await (ChartOfAccounts as any).findOneAndUpdate(
    { _id: new mongoose.Types.ObjectId(accountId), firm_id: firmIdObj },
    { $set: update },
    { returnDocument: 'after', runValidators: true }
  );

  const finalName = account.account_name;
  const finalType = account.account_type;

  // 1. Dual-Sync PostgreSQL if Labor Leader
  if (finalType === 'LABOR_LEADER') {
    try {
      let sql = getSql();
      if (!sql) sql = await connectPostgres();
      if (sql) {
        await sql`
          UPDATE labor_leaders 
          SET 
            name = ${finalName},
            phone = ${account.phone || null},
            pan = ${account.pan || null},
            aadhaar_number = ${account.aadhaar_number || null},
            bank_name = ${account.bank_name || null},
            account_number = ${account.account_number || null},
            ifsc_code = ${account.ifsc_code || null},
            updated_at = CURRENT_TIMESTAMP
          WHERE firm_id = ${firmIdStr} AND (name = ${prevAccount.account_name} OR name = ${finalName})
        `;
      }
    } catch (pgErr) {
      console.error('Failed to sync PostgreSQL labor leader on update:', pgErr);
    }
  }

  // 2. Dual-Sync MongoDB Parties
  if (['SUNDRY_DEBTORS', 'SUNDRY_CREDITORS', 'BOTH'].includes(finalType) || body.gstLocations) {
    const partyType = finalType === 'SUNDRY_DEBTORS' ? 'CUSTOMER' : (finalType === 'SUNDRY_CREDITORS' ? 'SUPPLIER' : 'BOTH');
    const primaryLoc = (body.gstLocations || []).find((l: any) => l.isPrimary) || (body.gstLocations || [])[0] || {};

    const partyUpdate: any = {
      name: finalName,
      contact: account.phone || null,
      pan: account.pan || null,
      bankName: account.bank_name || null,
      accountNumber: account.account_number || null,
      ifscCode: account.ifsc_code || null,
      branchName: account.branch_name || null,
      partyType: partyType
    };

    if (primaryLoc.gstin || body.gstin) partyUpdate.gstin = primaryLoc.gstin || body.gstin;
    if (primaryLoc.state || body.state) partyUpdate.state = primaryLoc.state || body.state;
    if (primaryLoc.stateCode || body.stateCode) partyUpdate.stateCode = primaryLoc.stateCode || body.stateCode;
    if (primaryLoc.address || body.address) partyUpdate.address = primaryLoc.address || body.address;
    if (primaryLoc.pincode || body.pin) partyUpdate.pin = primaryLoc.pincode || body.pin;
    if (body.gstLocations && body.gstLocations.length > 0) partyUpdate.gstLocations = body.gstLocations;

    await (Party as any).findOneAndUpdate(
      { firmId: firmIdObj, $or: [{ name: prevAccount.account_name }, { name: finalName }] },
      { $set: partyUpdate },
      { upsert: true, returnDocument: 'after' }
    );
  }

  // 3. Dual-Sync BankAccount collection if Treasury Bank Account
  if (finalType === 'BANK' && (account.account_number || body.account_number)) {
    const accNum = String(account.account_number || body.account_number).trim();
    if (body.is_default) {
      await (BankAccount as any).updateMany({ firm_id: firmIdObj }, { is_default: false });
    }
    await (BankAccount as any).findOneAndUpdate(
      { firm_id: firmIdObj, $or: [{ account_name: prevAccount.account_name }, { account_number: accNum }] },
      {
        $set: {
          firm_id: firmIdObj,
          account_name: finalName,
          bank_name: account.bank_name || body.bank_name,
          branch_name: account.branch_name || body.branch_name,
          account_number: accNum,
          ifsc_code: account.ifsc_code || body.ifsc_code,
          account_type: body.bank_account_type || body.account_type || 'CURRENT',
          is_default: !!body.is_default,
          status: body.status || 'ACTIVE'
        }
      },
      { upsert: true, returnDocument: 'after' }
    );
  }

  // 4. Update Opening Balance
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