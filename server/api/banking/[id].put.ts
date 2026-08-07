import { defineEventHandler, readBody, createError } from 'h3';
import BankAccount from '../../models/BankAccount';
import { requireAuthSession } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  try {
    const session = await requireAuthSession(event);
    const id = event.context.params?.id;
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Bank Account ID required' });

    const body = await readBody(event);
    const { account_name, bank_name, account_number, ifsc_code, branch_name, is_default, status, account_type } = body;

    if (is_default) {
      await BankAccount.updateMany({ firm_id: session.firm_id }, { is_default: false });
    }

    const updated = await BankAccount.findOneAndUpdate(
      { _id: id, firm_id: session.firm_id },
      {
        account_name,
        bank_name,
        account_number,
        ifsc_code,
        branch_name,
        is_default: !!is_default,
        status: status || 'ACTIVE',
        account_type: account_type || 'CURRENT'
      },
      { new: true }
    ).lean();

    if (!updated) throw createError({ statusCode: 404, statusMessage: 'Bank account not found' });

    return {
      success: true,
      data: updated
    };
  } catch (error: any) {
    console.error('Update bank account error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Error updating bank account'
    });
  }
});
