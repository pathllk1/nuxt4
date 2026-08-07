import { defineEventHandler, createError } from 'h3';
import BankAccount from '../../models/BankAccount';
import { requireAuthSession } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  try {
    const session = await requireAuthSession(event);
    const id = event.context.params?.id;
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Bank Account ID required' });

    const deleted = await BankAccount.findOneAndDelete({ _id: id, firm_id: session.firm_id });
    if (!deleted) throw createError({ statusCode: 404, statusMessage: 'Bank account not found' });

    return {
      success: true,
      message: 'Bank account deleted successfully'
    };
  } catch (error: any) {
    console.error('Delete bank account error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Error deleting bank account'
    });
  }
});
