import mongoose from 'mongoose';
import ChartOfAccounts from '../../models/ChartOfAccounts';
import Party from '../../models/Party';
import BankAccount from '../../models/BankAccount';
import OpeningBalance from '../../models/OpeningBalance';
import { getCurrentFinancialYear } from '../../utils/accounting/bill-utils';
import { requireAuthSession } from '../../utils/auth';
import { getSql, connectPostgres } from '../../utils/pg.config';

export default defineEventHandler(async (event) => {
  const user = await requireAuthSession(event);
  const body = await readBody(event) || {};

  const name = String(body.account_name || body.name || '').trim();
  const rawType = String(body.account_type || body.accountType || body.partyType || '').toUpperCase();

  if (!name || !rawType) {
    throw createError({ statusCode: 400, statusMessage: 'Account name and type are required' });
  }

  // Normalize classification type
  let accountType = rawType;
  if (rawType === 'CUSTOMER') accountType = 'SUNDRY_DEBTORS';
  else if (rawType === 'SUPPLIER') accountType = 'SUNDRY_CREDITORS';

  const firmIdStr = String(user.firm_id);
  const firmIdObj = new mongoose.Types.ObjectId(firmIdStr);
  const userIdObj = new mongoose.Types.ObjectId(String(user._id));
  const openingBalance = parseFloat(body.opening_balance ?? body.openingBalance) || 0;
  const balanceType = String(body.balance_type || body.balanceType || 'DR').toUpperCase();

  try {
    // 1. Dual-Sync PostgreSQL if Labor Leader
    if (accountType === 'LABOR_LEADER') {
      try {
        let sql = getSql();
        if (!sql) sql = await connectPostgres();
        if (sql) {
          await sql`
            INSERT INTO labor_leaders (firm_id, name, phone, pan, aadhaar_number, bank_name, account_number, ifsc_code, status)
            VALUES (
              ${firmIdStr}, 
              ${name}, 
              ${body.phone || body.contact || null}, 
              ${body.pan ? String(body.pan).trim().toUpperCase() : null}, 
              ${body.aadhaar_number || body.aadhaar || null}, 
              ${body.bank_name || body.bankName || null}, 
              ${body.account_number || body.accountNumber || null}, 
              ${body.ifsc_code || body.ifscCode ? String(body.ifsc_code || body.ifscCode).trim().toUpperCase() : null}, 
              'Active'
            )
            ON CONFLICT (id) DO NOTHING
          `;
        }
      } catch (pgErr) {
        console.error('Failed to sync PostgreSQL labor leader on create:', pgErr);
      }
    }

    // 2. Dual-Sync Parties collection if Customer / Supplier
    if (['SUNDRY_DEBTORS', 'SUNDRY_CREDITORS', 'BOTH'].includes(accountType) || (body.gstLocations && body.gstLocations.length > 0)) {
      const partyType = accountType === 'SUNDRY_DEBTORS' ? 'CUSTOMER' : (accountType === 'SUNDRY_CREDITORS' ? 'SUPPLIER' : 'BOTH');
      const primaryLoc = (body.gstLocations || []).find((l: any) => l.isPrimary) || (body.gstLocations || [])[0] || {};

      await (Party as any).findOneAndUpdate(
        { firmId: firmIdObj, name: name },
        {
          $set: {
            firmId: firmIdObj,
            name: name,
            gstin: primaryLoc.gstin || body.gstin || 'UNREGISTERED',
            contact: body.phone || body.contact || null,
            state: primaryLoc.state || body.state || null,
            stateCode: primaryLoc.stateCode || body.stateCode || null,
            address: primaryLoc.address || body.address || null,
            pin: primaryLoc.pincode || body.pin || null,
            pan: body.pan ? String(body.pan).trim().toUpperCase() : null,
            bankName: body.bank_name || body.bankName || null,
            accountNumber: body.account_number || body.accountNumber || null,
            ifscCode: body.ifsc_code || body.ifscCode ? String(body.ifsc_code || body.ifscCode).trim().toUpperCase() : null,
            branchName: body.branch_name || body.branchName || null,
            gstLocations: body.gstLocations || [],
            partyType: partyType,
            openingBalance: openingBalance,
            balanceType: balanceType,
            createdBy: String(user._id)
          }
        },
        { upsert: true, returnDocument: 'after' }
      );
    }

    // 3. Upsert into ChartOfAccounts
    const account = await (ChartOfAccounts as any).findOneAndUpdate(
      {
        $or: [{ firm_id: firmIdObj }, { firmId: firmIdObj }],
        account_name: name
      },
      {
        $set: {
          firm_id: firmIdObj,
          account_name: name,
          account_type: accountType,
          pan: body.pan ? String(body.pan).trim().toUpperCase() : null,
          aadhaar_number: body.aadhaar_number || body.aadhaar ? String(body.aadhaar_number || body.aadhaar).trim() : null,
          gstin: body.gstin ? String(body.gstin).trim().toUpperCase() : null,
          phone: body.phone || body.contact ? String(body.phone || body.contact).trim() : null,
          hsn_sac: body.hsn_sac ? String(body.hsn_sac).trim() : null,
          gst_rate: body.gst_rate != null ? parseFloat(body.gst_rate) || null : null,
          description: body.description ? String(body.description).trim() : null,
          bank_name: body.bank_name || body.bankName ? String(body.bank_name || body.bankName).trim() : null,
          account_number: body.account_number || body.accountNumber ? String(body.account_number || body.accountNumber).trim() : null,
          ifsc_code: body.ifsc_code || body.ifscCode ? String(body.ifsc_code || body.ifscCode).trim().toUpperCase() : null,
          branch_name: body.branch_name || body.branchName ? String(body.branch_name || body.branchName).trim() : null,
          account_type_code: body.account_type_code || body.accountTypeCode ? String(body.account_type_code || body.accountTypeCode).trim() : '10',
          is_system: false,
          is_active: body.is_active !== false,
          updated_by: userIdObj
        },
        $setOnInsert: {
          created_by: userIdObj
        }
      },
      { upsert: true, returnDocument: 'after' }
    );

    // 4. Dual-Sync BankAccount collection if Treasury Bank Account
    if (accountType === 'BANK' && body.account_number && body.bank_name) {
      if (body.is_default) {
        await (BankAccount as any).updateMany({ firm_id: firmIdObj }, { is_default: false });
      }
      await (BankAccount as any).findOneAndUpdate(
        { firm_id: firmIdObj, account_number: String(body.account_number).trim() },
        {
          $set: {
            firm_id: firmIdObj,
            account_name: name,
            bank_name: String(body.bank_name).trim(),
            branch_name: body.branch_name ? String(body.branch_name).trim() : null,
            account_number: String(body.account_number).trim(),
            ifsc_code: body.ifsc_code ? String(body.ifsc_code).trim().toUpperCase() : '',
            account_type: body.bank_account_type || body.account_type || 'CURRENT',
            is_default: !!body.is_default,
            status: body.status || 'ACTIVE'
          }
        },
        { upsert: true, returnDocument: 'after' }
      );
    }

    // 5. Update Opening Balance
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

    return { success: true, message: 'Account head registered successfully', data: account };
  } catch (error: any) {
    if (error?.code === 11000) {
      throw createError({ statusCode: 400, statusMessage: 'Account name already exists for this firm' });
    }
    throw createError({ statusCode: 500, statusMessage: error.message || 'Failed to register account head' });
  }
});