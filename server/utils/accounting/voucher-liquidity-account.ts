import { createError } from 'h3';
import mongoose from 'mongoose';
import BankAccount from '../../models/BankAccount';
import ChartOfAccounts from '../../models/ChartOfAccounts';

export interface IVoucherLiquidityAccount {
  accountHead: string;
  accountType: 'BANK' | 'CASH';
  bankAccountId: mongoose.Types.ObjectId | null;
}

export async function resolveVoucherLiquidityAccount(
  accountIdOrName: unknown,
  firmId: mongoose.Types.ObjectId,
  session?: mongoose.ClientSession
): Promise<IVoucherLiquidityAccount | null> {
  if (accountIdOrName === undefined || accountIdOrName === null || accountIdOrName === '') return null;
  if (typeof accountIdOrName !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Select a valid bank or cash account for this voucher.' });
  }

  if (mongoose.Types.ObjectId.isValid(accountIdOrName)) {
    const bankQuery = BankAccount.findOne({
      _id: accountIdOrName,
      status: 'ACTIVE',
      $or: [{ firm_id: firmId }, { firmId }]
    });
    if (session) bankQuery.session(session);
    const bankAccount = await bankQuery.lean();
    if (bankAccount) {
      return {
        accountHead: bankAccount.account_name,
        accountType: 'BANK',
        bankAccountId: bankAccount._id as mongoose.Types.ObjectId
      };
    }
  }

  const cashQuery = ChartOfAccounts.find({
    account_name: accountIdOrName,
    account_type: 'CASH',
    is_active: true,
    $or: [{ firm_id: firmId }, { firmId }]
  }, 'account_name');
  if (session) cashQuery.session(session);
  const cashAccounts = await cashQuery.lean();
  if (cashAccounts.length !== 1) {
    throw createError({
      statusCode: 400,
      statusMessage: `Selected liquidity account is not an active bank or uniquely registered cash account for this firm (matches: ${cashAccounts.length}).`
    });
  }

  return {
    accountHead: cashAccounts[0]!.account_name,
    accountType: 'CASH',
    bankAccountId: null
  };
}
