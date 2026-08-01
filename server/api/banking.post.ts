import { defineEventHandler, readBody, createError } from 'h3';
import BankAccount from '../models/BankAccount';
import ChartOfAccounts from '../models/ChartOfAccounts';
import { requireAuthSession } from '../utils/auth';

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

    const doc = await BankAccount.create({
      firm_id: session.firm_id,
      ...body
    });

    try {
      await ChartOfAccounts.create({
        firm_id: session.firm_id,
        account_name: doc.account_name,
        account_type: 'BANK',
        is_system: true,
        is_active: true,
        created_by: session._id
      });
    } catch (coaErr: any) {
      console.error('Failed to create ChartOfAccounts for bank account:', coaErr.message);
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
