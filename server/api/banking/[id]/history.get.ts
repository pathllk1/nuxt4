import { defineEventHandler, createError } from 'h3';
import mongoose from 'mongoose';
import BankAccount from '../../../models/BankAccount';
import Ledger from '../../../models/Ledger';
import { requireAuthSession } from '../../../utils/auth';

export default defineEventHandler(async (event) => {
  try {
    const session = await requireAuthSession(event);
    const id = event.context.params?.id;
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Bank Account ID required' });

    const account = await BankAccount.findOne({ _id: id, firm_id: session.firm_id }).lean();
    if (!account) throw createError({ statusCode: 404, statusMessage: 'Bank account not found' });

    const objectId = mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id;

    const firmFilter = { $or: [{ firmId: session.firm_id }, { firm_id: session.firm_id as any }] };
    const accountFilter = { $or: [
      { bankAccountId: objectId },
      { bank_account_id: id as any },
      { accountHead: account.account_name }
    ] };

    const history = await Ledger.find({
      $and: [firmFilter, accountFilter]
    })
      .sort({ transactionDate: -1, createdAt: -1 })
      .limit(100)
      .lean();

    return {
      success: true,
      data: history
    };
  } catch (error: any) {
    console.error('Fetch bank transaction history error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Error fetching transaction history'
    });
  }
});
