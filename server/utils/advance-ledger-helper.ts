import mongoose from 'mongoose';
import Ledger from '../models/Ledger';
import type { IAdvance } from '../models/Advance';
import { resolveAccountHead, resolveBankAccount, getDefaultCashAccount } from './wages-ledger-helper';
import { UnifiedPostingService } from './accounting/unified-posting.service';
import type { IVoucherLeg } from '../types/accounting';

export async function postAdvanceLedger(advance: IAdvance, session: mongoose.ClientSession): Promise<string> {
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

    const legs: IVoucherLeg[] = [];
    const isAdvance = advance.type === 'ADVANCE';

    if (isAdvance) {
      // DEBIT: Advance to Employees
      legs.push({
        accountHead: advanceAccount.account_name,
        accountType: advanceAccount.account_type,
        debitAmount: advance.amount,
        creditAmount: 0,
        narration: `Advance given to employee${advance.remarks ? ` - ${advance.remarks}` : ''}`,
      });

      // CREDIT: Bank/Cash
      legs.push({
        accountHead: sourceAccount.account_name,
        accountType: sourceAccount.account_type,
        debitAmount: 0,
        creditAmount: advance.amount,
        bankAccountId: advance.bank_account_id || null,
        paymentMode: advance.payment_mode || null,
        narration: `Advance paid${advance.remarks ? ` - ${advance.remarks}` : ''}`,
      });
    } else {
      // REPAYMENT
      // DEBIT: Bank/Cash
      legs.push({
        accountHead: sourceAccount.account_name,
        accountType: sourceAccount.account_type,
        debitAmount: advance.amount,
        creditAmount: 0,
        bankAccountId: advance.bank_account_id || null,
        paymentMode: advance.payment_mode || null,
        narration: `Advance repayment received${advance.remarks ? ` - ${advance.remarks}` : ''}`,
      });

      // CREDIT: Advance to Employees
      legs.push({
        accountHead: advanceAccount.account_name,
        accountType: advanceAccount.account_type,
        debitAmount: 0,
        creditAmount: advance.amount,
        narration: `Advance repayment${advance.remarks ? ` - ${advance.remarks}` : ''}`,
      });
    }

    const postResult = await UnifiedPostingService.postVoucher({
      firmId,
      voucherType: isAdvance ? 'PAYMENT' : 'RECEIPT',
      transactionDate,
      narration: isAdvance
        ? `Advance given${advance.remarks ? ` - ${advance.remarks}` : ''}`
        : `Advance repayment${advance.remarks ? ` - ${advance.remarks}` : ''}`,
      legs,
      createdBy: String(userId || 'system'),
      refType: 'ADVANCE',
      refId: advance._id,
      tags: { masterRollId: advance.master_roll_id },
    }, session);

    return postResult.voucherGroupId;
  } catch (error: any) {
    throw new Error(`Advance ledger posting failed: ${error.message}`);
  }
}

export async function deleteAdvanceLedger(
  advanceId: mongoose.Types.ObjectId,
  firmId: mongoose.Types.ObjectId,
  session: mongoose.ClientSession
): Promise<number> {
  try {
    const origEntries = await Ledger.find({
      refType: 'ADVANCE',
      refId: advanceId,
      firmId,
    }).session(session).lean();

    const firstEntry = origEntries[0];
    if (firstEntry && firstEntry.voucherGroupId) {
      const vGroupId: string = firstEntry.voucherGroupId;
      await UnifiedPostingService.reverseVoucher({
        originalVoucherGroupId: vGroupId,
        firmId,
        reason: 'Advance deleted/cancelled',
        createdBy: 'system',
        session,
      });

      await Ledger.updateMany(
        { refType: 'ADVANCE', refId: advanceId, firmId },
        { $set: { isReversed: true } },
        { session }
      );
    }

    return origEntries.length;
  } catch (error: any) {
    throw new Error(`Advance ledger deletion/reversal failed: ${error.message}`);
  }
}
