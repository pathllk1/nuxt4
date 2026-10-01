import { defineEventHandler, readBody, createError } from 'h3';
import mongoose from 'mongoose';
import BankAccount from '../../models/BankAccount';
import ChartOfAccounts from '../../models/ChartOfAccounts';
import Ledger from '../../models/Ledger';
import { OpeningBalanceService } from '../../utils/accounting/opening-balance.service';
import { requireAuthSession } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  try {
    const session = await requireAuthSession(event);
    const id = event.context.params?.id;
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Bank Account ID required' });

    const body = await readBody(event);
    const { account_name, bank_name, account_number, ifsc_code, branch_name, is_default, status, account_type } = body;

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

    const oldName = existing.account_name;

    if (is_default) {
      await BankAccount.updateMany(firmFilter, { is_default: false });
    }

    const updated = await BankAccount.findOneAndUpdate(
      { _id: id, ...firmFilter },
      {
        firmId: firmIdObj || session.firm_id,
        firm_id: firmIdObj || session.firm_id,
        account_name,
        bank_name,
        account_number,
        ifsc_code,
        branch_name,
        is_default: !!is_default,
        status: status || 'ACTIVE',
        account_type: account_type || 'CURRENT'
      },
      { returnDocument: 'after' }
    ).lean();

    // If account_name changed, rename across ChartOfAccounts, Ledger, and OpeningBalance
    if (account_name && oldName && account_name !== oldName) {
      await ChartOfAccounts.updateMany(
        { ...firmFilter, account_name: oldName },
        { $set: { account_name } }
      );
      await Ledger.updateMany(
        { ...firmFilter, accountHead: oldName },
        { $set: { accountHead: account_name } }
      );
      await OpeningBalanceService.renameAccountHead({
        firmId: firmIdObj || session.firm_id,
        oldHead: oldName,
        newHead: account_name
      });
    }

    // Sync opening balance if specified
    const obRaw = body.opening_balance ?? body.openingBalance;
    if (obRaw !== undefined) {
      const obAmount = parseFloat(obRaw) || 0;
      const bType = String(body.balance_type || body.balanceType || (['OD', 'CC'].includes(account_type) ? 'CR' : 'DR')).toUpperCase();
      await OpeningBalanceService.syncOpeningBalance({
        firmId: firmIdObj || session.firm_id,
        accountHead: account_name || oldName,
        accountType: 'BANK',
        amount: obAmount,
        balanceType: bType,
        bankAccountId: id,
        userId: String(session._id)
      });
    }

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
