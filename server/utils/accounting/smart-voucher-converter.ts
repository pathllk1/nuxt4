import mongoose from 'mongoose';
import type { LedgerEntryParams } from './ledger.service';
import { convertVoucherInputToLegs } from './posting-adapter';

export interface VoucherLineInput {
  accountHead: string;
  amount?: number;
  debitAmount?: number;
  creditAmount?: number;
  accountType?: string;
  type?: string;
  laborPeriodId?: string;
  partyId?: any;
  bankAccountId?: any;
}

/**
 * @deprecated SmartVoucherConverter is retired.
 * Use convertVoucherInputToLegs() from posting-adapter.ts and UnifiedPostingService instead.
 */
export class SmartVoucherConverter {
  static convertToLedgerEntries(
    firmId: mongoose.Types.ObjectId,
    voucherId: number | string,
    voucherNo: string,
    vtype: string,
    vdate: string,
    mainAccount: string,
    entries: VoucherLineInput[],
    narration: string,
    createdBy: string
  ): LedgerEntryParams[] {
    const legs = convertVoucherInputToLegs({
      vtype,
      entries,
      mainAccount,
      narration,
    });

    return legs.map((leg) => ({
      firmId,
      transactionDate: vdate,
      accountHead: leg.accountHead,
      accountType: leg.accountType || 'GENERAL',
      debitAmount: leg.debitAmount,
      creditAmount: leg.creditAmount,
      narration: leg.narration || narration,
      voucherGroupId: String(voucherId),
      voucherNo,
      voucherType: vtype,
      partyId: leg.partyId ? new mongoose.Types.ObjectId(String(leg.partyId)) : undefined,
      bankAccountId: leg.bankAccountId ? new mongoose.Types.ObjectId(String(leg.bankAccountId)) : undefined,
      createdBy,
    }));
  }
}
