import { v4 as uuidv4 } from 'uuid';
import mongoose from 'mongoose';
import Ledger from '../models/Ledger';
import { IAdvance } from '../models/Advance';
import { resolveAccountHead, resolveBankAccount, getDefaultCashAccount, validateLedgerEntries } from './wages-ledger-helper';

export async function postAdvanceLedger(advance: IAdvance, session: mongoose.ClientSession) {
  const voucherId = uuidv4();
  const entries: any[] = [];
  const firmId = advance.firm_id;
  const userId = advance.created_by || advance.updated_by;
  const transactionDate = advance.date;

  try {
    const advanceAccount = await resolveAccountHead(firmId, 'Advance to Employees', 'ASSET', userId, session);
    
    let sourceAccount;
    if (advance.payment_mode === 'BANK' && advance.bank_account_id) {
      sourceAccount = await resolveBankAccount(firmId, advance.bank_account_id, userId, session);
    } else {
      sourceAccount = await getDefaultCashAccount(firmId, userId, session);
    }

    if (advance.type === 'ADVANCE') {
      // DEBIT: Advance to Employees
      entries.push({
        firmId: firmId,
        accountHead: advanceAccount.account_name,
        accountType: advanceAccount.account_type,
        debitAmount: advance.amount,
        creditAmount: 0,
        refType: 'ADVANCE',
        refId: advance._id,
        masterRollId: advance.master_roll_id,
        voucherGroupId: voucherId,
        transactionDate: transactionDate,
        narration: `Advance given to employee${advance.remarks ? ` - ${advance.remarks}` : ''}`,
      });

      // CREDIT: Bank/Cash
      entries.push({
        firmId: firmId,
        accountHead: sourceAccount.account_name,
        accountType: sourceAccount.account_type,
        debitAmount: 0,
        creditAmount: advance.amount,
        refType: 'ADVANCE',
        refId: advance._id,
        masterRollId: advance.master_roll_id,
        voucherGroupId: voucherId,
        bankAccountId: advance.bank_account_id || null,
        paymentMode: advance.payment_mode || null,
        transactionDate: transactionDate,
        narration: `Advance paid${advance.remarks ? ` - ${advance.remarks}` : ''}`,
      });
    } else {
      // REPAYMENT
      // DEBIT: Bank/Cash
      entries.push({
        firmId: firmId,
        accountHead: sourceAccount.account_name,
        accountType: sourceAccount.account_type,
        debitAmount: advance.amount,
        creditAmount: 0,
        refType: 'ADVANCE',
        refId: advance._id,
        masterRollId: advance.master_roll_id,
        voucherGroupId: voucherId,
        bankAccountId: advance.bank_account_id || null,
        paymentMode: advance.payment_mode || null,
        transactionDate: transactionDate,
        narration: `Advance repayment received${advance.remarks ? ` - ${advance.remarks}` : ''}`,
      });

      // CREDIT: Advance to Employees
      entries.push({
        firmId: firmId,
        accountHead: advanceAccount.account_name,
        accountType: advanceAccount.account_type,
        debitAmount: 0,
        creditAmount: advance.amount,
        refType: 'ADVANCE',
        refId: advance._id,
        masterRollId: advance.master_roll_id,
        voucherGroupId: voucherId,
        transactionDate: transactionDate,
        narration: `Advance repayment${advance.remarks ? ` - ${advance.remarks}` : ''}`,
      });
    }

    await validateLedgerEntries(entries, firmId, session);
    await Ledger.insertMany(entries, { session });
    return voucherId;

  } catch (error: any) {
    throw new Error(`Advance ledger posting failed: ${error.message}`);
  }
}

export async function deleteAdvanceLedger(advanceId: mongoose.Types.ObjectId, firmId: mongoose.Types.ObjectId, session: mongoose.ClientSession) {
  try {
    const result = await Ledger.deleteMany(
      {
        refType: 'ADVANCE',
        refId: advanceId,
        firmId: firmId,
      },
      { session }
    );
    return result.deletedCount;
  } catch (error: any) {
    throw new Error(`Advance ledger deletion failed: ${error.message}`);
  }
}
