import { defineEventHandler, createError } from 'h3';
import BankAccount from '../../models/BankAccount';
import { requireAuthSession } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  try {
    const session = await requireAuthSession(event);
    const accounts = await BankAccount.find({
      firm_id: session.firm_id,
      status: 'ACTIVE'
    })
      .sort({ is_default: -1, bank_name: 1 })
      .lean();

    return {
      success: true,
      data: accounts
    };
  } catch (error: any) {
    console.error('Get bank accounts error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Error fetching bank accounts'
    });
  }
});
