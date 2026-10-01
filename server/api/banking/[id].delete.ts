import { defineEventHandler, createError } from 'h3';
import mongoose from 'mongoose';
import BankAccount from '../../models/BankAccount';
import ChartOfAccounts from '../../models/ChartOfAccounts';
import Ledger from '../../models/Ledger';
import { requireAuthSession } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  try {
    const session = await requireAuthSession(event);
    const id = event.context.params?.id;
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Bank Account ID required' });

    const firmIdObj = mongoose.Types.ObjectId.isValid(String(session.firm_id))
      ? new mongoose.Types.ObjectId(String(session.firm_id))
      : null;

    const firmFilter = {
      $or: [
        { firm_id: session.firm_id },
        { firmId: session.firm_id },
        ...(firmIdObj ? [{ firm_id: firmIdObj }, { firmId: firmIdObj }] : [])
      ]
    };

    const existing = await BankAccount.findOne({ _id: id, ...firmFilter });
    if (!existing) throw createError({ statusCode: 404, statusMessage: 'Bank account not found' });

    // Check if bank account has any transactions in General Ledger
    const ledgerTxCount = await Ledger.countDocuments({
      ...firmFilter,
      $or: [
        { bankAccountId: id },
        { accountHead: existing.account_name }
      ]
    });

    if (ledgerTxCount > 0) {
      // Soft deactivate instead of hard delete to preserve audit trail
      existing.status = 'INACTIVE';
      await existing.save();
      return {
        success: true,
        message: 'Bank account has historical ledger entries and was set to INACTIVE to preserve audit trail'
      };
    }

    await BankAccount.deleteOne({ _id: id, ...firmFilter });
    // Remove auto-created ChartOfAccounts entry if no ledger entries existed
    await ChartOfAccounts.deleteMany({
      ...firmFilter,
      account_name: existing.account_name,
      is_system: true
    });

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
