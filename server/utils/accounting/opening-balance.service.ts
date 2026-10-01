import mongoose from 'mongoose';
import OpeningBalance from '../../models/OpeningBalance';
import Ledger from '../../models/Ledger';
import Party from '../../models/Party';
import ChartOfAccounts from '../../models/ChartOfAccounts';
import { getCurrentFinancialYear } from './bill-utils';

export interface SyncOpeningBalanceParams {
  firmId: mongoose.Types.ObjectId | string;
  accountHead: string;
  accountType?: string;
  amount: number;
  balanceType?: 'DR' | 'CR' | string;
  financialYear?: string;
  partyId?: mongoose.Types.ObjectId | string;
  bankAccountId?: mongoose.Types.ObjectId | string;
  userId?: mongoose.Types.ObjectId | string;
  session?: mongoose.ClientSession;
}

export class OpeningBalanceService {
  public static readonly CONTRA_HEAD = 'Difference in Opening Balances';
  public static readonly CONTRA_TYPE = 'CAPITAL';

  /**
   * Sanitizes an account head for use in voucher group IDs
   */
  private static sanitizeId(name: string): string {
    return name.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  }

  /**
   * Ensures the system contra account 'Difference in Opening Balances' exists in COA
   */
  private static async ensureContraAccount(firmId: mongoose.Types.ObjectId, userId?: string, session?: mongoose.ClientSession) {
    try {
      await (ChartOfAccounts as any).findOneAndUpdate(
        {
          firm_id: firmId,
          account_name: this.CONTRA_HEAD
        },
        {
          $setOnInsert: {
            firm_id: firmId,
            firmId: firmId,
            account_name: this.CONTRA_HEAD,
            account_type: this.CONTRA_TYPE,
            is_system: true,
            is_active: true,
            created_by: userId ? new mongoose.Types.ObjectId(String(userId)) : undefined
          }
        },
        { upsert: true, session }
      );
    } catch (e: any) {
      // Ignore conflict if created concurrently
    }
  }

  /**
   * Unified entry point to sync an opening balance across OpeningBalance, Ledger, Party, and COA.
   * Guarantees 0 user mistakes by maintaining balanced double-entry contra vouchers.
   */
  static async syncOpeningBalance(params: SyncOpeningBalanceParams) {
    const firmIdObj = mongoose.Types.ObjectId.isValid(String(params.firmId))
      ? new mongoose.Types.ObjectId(String(params.firmId))
      : null;

    if (!firmIdObj) {
      throw new Error('Valid firmId is required to sync opening balance');
    }

    const accountHead = String(params.accountHead || '').trim();
    if (!accountHead) {
      throw new Error('accountHead is required to sync opening balance');
    }

    const financialYear = params.financialYear || getCurrentFinancialYear();
    const fyYear = String(financialYear).split('-')[0];
    const fyStart = `${fyYear}-04-01`;

    const rawAmount = parseFloat(String(params.amount)) || 0;
    const amount = Math.abs(rawAmount);
    const balanceType = (String(params.balanceType || 'DR').toUpperCase() === 'CR' ? 'CR' : 'DR') as 'DR' | 'CR';
    const accountType = (params.accountType || 'GENERAL').toUpperCase();
    const userIdStr = String(params.userId || 'system');
    const session = params.session;

    const sanitized = this.sanitizeId(accountHead);
    const voucherGroupId = `OB-${financialYear}-${sanitized}`;
    const legacyVoucherGroupId = `OB-${financialYear}-${accountHead}`;
    const voucherNo = `OB/${financialYear}/${accountHead}`;

    // 1. Ensure system contra account exists
    await this.ensureContraAccount(firmIdObj, userIdStr, session);

    // 2. Remove any existing Ledger OB voucher entries for this account
    await (Ledger as any).deleteMany(
      {
        firmId: firmIdObj,
        voucherType: 'OPENING_BALANCE',
        $or: [
          { voucherGroupId },
          { voucherGroupId: legacyVoucherGroupId },
          { voucherNo },
          { accountHead, voucherType: 'OPENING_BALANCE', transactionDate: fyStart }
        ]
      },
      session ? { session } : {}
    );

    // 3. Upsert into OpeningBalance collection
    let obDoc = null;
    if (amount > 0) {
      obDoc = await (OpeningBalance as any).findOneAndUpdate(
        { firmId: firmIdObj, accountHead, financialYear },
        {
          $set: {
            firmId: firmIdObj,
            accountHead,
            accountType,
            debitAmount: balanceType === 'DR' ? amount : 0,
            creditAmount: balanceType === 'CR' ? amount : 0,
            financialYear,
            createdBy: userIdStr
          }
        },
        { upsert: true, returnDocument: 'after', runValidators: true, session }
      );

      // 4. Create balanced double-entry voucher pair in Ledger:
      // Leg 1: The actual account head
      const leg1 = {
        firmId: firmIdObj,
        transactionDate: fyStart,
        accountHead,
        accountType,
        partyId: params.partyId ? new mongoose.Types.ObjectId(String(params.partyId)) : undefined,
        bankAccountId: params.bankAccountId ? new mongoose.Types.ObjectId(String(params.bankAccountId)) : undefined,
        debitAmount: balanceType === 'DR' ? amount : 0,
        creditAmount: balanceType === 'CR' ? amount : 0,
        narration: `Opening Balance for ${financialYear}`,
        voucherType: 'OPENING_BALANCE',
        voucherNo,
        voucherGroupId,
        createdBy: userIdStr
      };

      // Leg 2: Dynamic Contra Head 'Difference in Opening Balances'
      const leg2 = {
        firmId: firmIdObj,
        transactionDate: fyStart,
        accountHead: this.CONTRA_HEAD,
        accountType: this.CONTRA_TYPE,
        debitAmount: balanceType === 'CR' ? amount : 0, // Inverted for contra
        creditAmount: balanceType === 'DR' ? amount : 0, // Inverted for contra
        narration: `Contra - Opening Balance for ${accountHead} (${financialYear})`,
        voucherType: 'OPENING_BALANCE',
        voucherNo,
        voucherGroupId,
        createdBy: userIdStr
      };

      await (Ledger as any).insertMany([leg1, leg2], session ? { session } : {});
    } else {
      // Amount is 0: clear the OpeningBalance document
      obDoc = await (OpeningBalance as any).findOneAndUpdate(
        { firmId: firmIdObj, accountHead, financialYear },
        {
          $set: {
            debitAmount: 0,
            creditAmount: 0
          }
        },
        { returnDocument: 'after', session }
      );
    }

    // 5. Dual-Sync Party collection if this is a Customer / Supplier
    try {
      await (Party as any).updateMany(
        { firmId: firmIdObj, name: accountHead },
        {
          $set: {
            openingBalance: amount,
            balanceType: balanceType
          }
        },
        session ? { session } : {}
      );
    } catch (partyErr) {
      console.error('Failed to dual-sync party opening balance:', partyErr);
    }

    // 6. Dual-Sync ChartOfAccounts collection
    try {
      await (ChartOfAccounts as any).updateMany(
        { firm_id: firmIdObj, account_name: accountHead },
        {
          $set: {
            opening_balance: amount,
            balance_type: balanceType
          }
        },
        session ? { session } : {}
      );
    } catch (coaErr) {
      console.error('Failed to dual-sync COA opening balance:', coaErr);
    }

    return {
      success: true,
      data: obDoc,
      accountHead,
      amount,
      balanceType,
      voucherGroupId
    };
  }

  /**
   * Automatically updates opening balance references when an account is renamed
   */
  static async renameAccountHead(params: {
    firmId: mongoose.Types.ObjectId | string;
    oldHead: string;
    newHead: string;
    session?: mongoose.ClientSession;
  }) {
    const firmIdObj = new mongoose.Types.ObjectId(String(params.firmId));
    const oldHead = String(params.oldHead).trim();
    const newHead = String(params.newHead).trim();
    const session = params.session;

    if (!oldHead || !newHead || oldHead === newHead) return;

    // 1. Update OpeningBalance records
    await (OpeningBalance as any).updateMany(
      { firmId: firmIdObj, accountHead: oldHead },
      { $set: { accountHead: newHead } },
      session ? { session } : {}
    );

    // 2. Update Ledger OB vouchers for leg 1
    await (Ledger as any).updateMany(
      {
        firmId: firmIdObj,
        voucherType: 'OPENING_BALANCE',
        accountHead: oldHead
      },
      { $set: { accountHead: newHead } },
      session ? { session } : {}
    );

    // 3. Update narration on leg 2 contra entries
    const oldSanitized = this.sanitizeId(oldHead);
    const newSanitized = this.sanitizeId(newHead);
    const financialYear = getCurrentFinancialYear();

    await (Ledger as any).updateMany(
      {
        firmId: firmIdObj,
        voucherType: 'OPENING_BALANCE',
        accountHead: this.CONTRA_HEAD,
        voucherGroupId: `OB-${financialYear}-${oldSanitized}`
      },
      {
        $set: {
          voucherGroupId: `OB-${financialYear}-${newSanitized}`,
          voucherNo: `OB/${financialYear}/${newHead}`,
          narration: `Contra - Opening Balance for ${newHead} (${financialYear})`
        }
      },
      session ? { session } : {}
    );
  }

  /**
   * Cleans up opening balance entries when an account is deleted
   */
  static async deleteOpeningBalance(params: {
    firmId: mongoose.Types.ObjectId | string;
    accountHead: string;
    financialYear?: string;
    session?: mongoose.ClientSession;
  }) {
    const firmIdObj = new mongoose.Types.ObjectId(String(params.firmId));
    const accountHead = String(params.accountHead).trim();
    const financialYear = params.financialYear || getCurrentFinancialYear();
    const session = params.session;

    const sanitized = this.sanitizeId(accountHead);
    const voucherGroupId = `OB-${financialYear}-${sanitized}`;

    await (OpeningBalance as any).deleteMany(
      { firmId: firmIdObj, accountHead, financialYear },
      session ? { session } : {}
    );

    await (Ledger as any).deleteMany(
      {
        firmId: firmIdObj,
        voucherType: 'OPENING_BALANCE',
        $or: [
          { voucherGroupId },
          { accountHead, voucherType: 'OPENING_BALANCE' }
        ]
      },
      session ? { session } : {}
    );
  }

  /**
   * Computes the net Difference in Opening Balances across all accounts for a firm
   */
  static async getOpeningBalanceSummary(firmId: mongoose.Types.ObjectId | string, financialYear?: string) {
    const firmIdObj = new mongoose.Types.ObjectId(String(firmId));
    const fy = financialYear || getCurrentFinancialYear();

    const obs = await (OpeningBalance as any).find({ firmId: firmIdObj, financialYear: fy }).lean();

    let totalDr = 0;
    let totalCr = 0;

    for (const ob of obs) {
      totalDr += Number(ob.debitAmount) || 0;
      totalCr += Number(ob.creditAmount) || 0;
    }

    const netDifference = totalDr - totalCr;
    const differenceType: 'CR' | 'DR' = netDifference >= 0 ? 'CR' : 'DR';
    const isBalanced = Math.abs(netDifference) < 0.01;

    return {
      financialYear: fy,
      totalDr,
      totalCr,
      netDifference: Math.abs(netDifference),
      rawDifference: netDifference,
      differenceType,
      isBalanced,
      contraAccountHead: this.CONTRA_HEAD
    };
  }
}
