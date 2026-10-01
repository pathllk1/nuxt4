import { defineEventHandler, readBody, createError } from 'h3';
import mongoose from 'mongoose';
import BankAccount from '../../models/BankAccount';
import ChartOfAccounts from '../../models/ChartOfAccounts';
import { OpeningBalanceService } from '../../utils/accounting/opening-balance.service';
import { requireAuthSession } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  try {
    const session = await requireAuthSession(event);
    const body = await readBody(event);

    const existing = await BankAccount.findOne({ 
      firm_id: session.firm_id, 
      account_number: body.account_number 
    });
    
    if (existing) {
      throw createError({ statusCode: 400, statusMessage: 'Account number already exists' });
    }

    if (body.is_default) {
      await BankAccount.updateMany({ firm_id: session.firm_id }, { is_default: false });
    }

    const firmIdObj = mongoose.Types.ObjectId.isValid(String(session.firm_id))
      ? new mongoose.Types.ObjectId(String(session.firm_id))
      : session.firm_id;

    const doc = await BankAccount.create({
      firm_id: firmIdObj,
      firmId: firmIdObj,
      ...body
    });

    // Auto-create ChartOfAccounts entry
    try {
      await ChartOfAccounts.create({
        firm_id: firmIdObj,
        firmId: firmIdObj,
        account_name: doc.account_name,
        account_type: 'BANK',
        is_system: true,
        is_active: true,
        created_by: session._id
      });
    } catch (coaErr: any) {
      console.error('Failed to create ChartOfAccounts for bank account:', coaErr.message);
    }

    // Sync opening balance if specified
    const obAmount = parseFloat(body.opening_balance ?? body.openingBalance) || 0;
    if (obAmount > 0) {
      const balanceType = String(body.balance_type || body.balanceType || (['OD', 'CC'].includes(body.account_type) ? 'CR' : 'DR')).toUpperCase();
      await OpeningBalanceService.syncOpeningBalance({
        firmId: firmIdObj,
        accountHead: doc.account_name,
        accountType: 'BANK',
        amount: obAmount,
        balanceType,
        bankAccountId: doc._id,
        userId: String(session._id)
      });
    }

    return {
      success: true,
      message: 'Bank account created',
      data: doc
    };
  } catch (error: any) {
    console.error('Create bank account error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Failed to create bank account'
    });
  }
});
