import { v4 as uuidv4 } from 'uuid';
import mongoose from 'mongoose';
import Ledger from '../models/Ledger';
import ChartOfAccounts from '../models/ChartOfAccounts';
import BankAccount from '../models/BankAccount';

interface PostLaborAdvanceParams {
  firm_id: string;
  amount: number;
  payment_date: string;
  bank_account_id?: string | null;
  payment_mode?: string;
  leader_name: string;
  created_by?: string;
}

interface PostLaborSettlementParams {
  firm_id: string;
  total_wages: number;
  total_expenses: number;
  total_advances: number;
  net_payable: number;
  paid_amount: number;
  adjustment_reason?: string | null;
  payment_date: string;
  bank_account_id?: string | null;
  payment_mode?: string;
  leader_name: string;
  created_by?: string;
}

/**
 * Helper to resolve or auto-create account head in Chart of Accounts
 */
async function resolveLedgerPostingAccount(params: {
  firmId: string;
  accountHead: string;
  fallbackType: string;
  session: mongoose.ClientSession;
}) {
  const { firmId, accountHead, fallbackType, session } = params;
  const firmIdObj = new mongoose.Types.ObjectId(String(firmId));

  let coa: any = await ChartOfAccounts.findOne({
    $or: [
      { firm_id: firmIdObj },
      { firmId: firmIdObj },
      { firm_id: firmId },
      { firmId: firmId },
    ],
    account_name: accountHead
  }).session(session);

  if (!coa) {
    const coaDocs = await (ChartOfAccounts as any).create(
      [
        {
          firm_id: firmIdObj,
          firmId: firmIdObj,
          account_name: accountHead,
          account_type: fallbackType,
          is_system: false,
        },
      ],
      { session }
    );
    coa = coaDocs[0];
  }

  if (!coa) {
    throw new Error(`Failed to resolve Chart of Accounts head for ${accountHead}`);
  }

  return {
    accountHead: coa.account_name,
    accountType: coa.account_type,
  };
}

/**
 * Assert double-entry balance (Debits === Credits)
 */
function assertBalanced(entries: any[], contextName: string) {
  const totalDebits = entries.reduce((sum, e) => sum + Number(e.debitAmount || 0), 0);
  const totalCredits = entries.reduce((sum, e) => sum + Number(e.creditAmount || 0), 0);

  if (Math.abs(totalDebits - totalCredits) > 0.01) {
    throw new Error(`Accounting imbalance in ${contextName}: Debits (${totalDebits}) != Credits (${totalCredits})`);
  }
}

export const laborLedgerHelper = {
  /**
   * Post Labor Advance Payment to MongoDB Ledger
   */
  async postLaborAdvance(params: PostLaborAdvanceParams): Promise<string> {
    const { firm_id, amount, payment_date, bank_account_id, payment_mode = 'CASH', leader_name, created_by } = params;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const firmIdObj = new mongoose.Types.ObjectId(String(firm_id));
      let paymentPostAccountHead = 'Cash in Hand';
      let paymentPostAccountType = 'CASH';
      let mongoBankAccountId: string | null = null;

      if (payment_mode === 'CASH') {
        const cashPost = await resolveLedgerPostingAccount({
          firmId: firm_id,
          accountHead: 'Cash in Hand',
          fallbackType: 'CASH',
          session,
        });
        paymentPostAccountHead = cashPost.accountHead;
        paymentPostAccountType = cashPost.accountType;
      } else {
        if (!bank_account_id) throw new Error('Bank account is required for non-cash payments');
        const bankAccount = await BankAccount.findOne({
          _id: bank_account_id,
          $or: [{ firm_id: firm_id }, { firmId: firm_id }, { firm_id: firmIdObj }, { firmId: firmIdObj }]
        }).session(session);
        if (!bankAccount) throw new Error('Bank account not found or access denied');

        const bankPost = await resolveLedgerPostingAccount({
          firmId: firm_id,
          accountHead: bankAccount.account_name,
          fallbackType: 'BANK',
          session,
        });
        paymentPostAccountHead = bankPost.accountHead;
        paymentPostAccountType = bankPost.accountType;
        mongoBankAccountId = bank_account_id;
      }

      // Resolve Labor Leader Account in COA
      const leaderPost = await resolveLedgerPostingAccount({
        firmId: firm_id,
        accountHead: leader_name,
        fallbackType: 'LABOR_LEADER',
        session,
      });

      const voucherGroupId = `LABOR_ADV_${uuidv4().substring(0, 8)}`;
      const transactionDate = payment_date || new Date().toISOString().split('T')[0];
      const bankIdObj = mongoBankAccountId ? new mongoose.Types.ObjectId(String(mongoBankAccountId)) : null;

      const entries = [
        // Credit: Cash / Bank Account (Funds leaving firm)
        {
          firmId: firmIdObj,
          firm_id: firmIdObj,
          accountHead: paymentPostAccountHead,
          accountType: paymentPostAccountType,
          creditAmount: amount,
          debitAmount: 0,
          narration: `Labor Advance to ${leader_name} (${payment_mode})`,
          bankAccountId: bankIdObj,
          paymentMode: payment_mode,
          refType: 'ADVANCE',
          voucherType: 'PAYMENT',
          transactionDate: transactionDate,
          voucherGroupId: voucherGroupId,
          createdBy: created_by,
        },
        // Debit: Labor Leader Account Sub-ledger
        {
          firmId: firmIdObj,
          firm_id: firmIdObj,
          accountHead: leaderPost.accountHead,
          accountType: leaderPost.accountType,
          creditAmount: 0,
          debitAmount: amount,
          narration: `Labor Advance to ${leader_name} (${payment_mode})`,
          paymentMode: payment_mode,
          refType: 'ADVANCE',
          voucherType: 'PAYMENT',
          transactionDate: transactionDate,
          voucherGroupId: voucherGroupId,
          createdBy: created_by,
        },
      ];

      assertBalanced(entries, `LABOR_ADVANCE ${voucherGroupId}`);

      await Ledger.insertMany(entries, { session });
      await session.commitTransaction();
      return voucherGroupId;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  },

  /**
   * Post Labor Final Settlement to MongoDB Ledger
   */
  async postLaborSettlement(params: PostLaborSettlementParams): Promise<string> {
    const {
      firm_id,
      total_wages,
      total_expenses,
      net_payable,
      paid_amount,
      adjustment_reason,
      payment_date,
      bank_account_id,
      payment_mode = 'CASH',
      leader_name,
      created_by,
    } = params;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const firmIdObj = new mongoose.Types.ObjectId(String(firm_id));
      let paymentPostAccountHead = 'Cash in Hand';
      let paymentPostAccountType = 'CASH';
      let mongoBankAccountId: string | null = null;

      if (payment_mode === 'CASH') {
        const cashPost = await resolveLedgerPostingAccount({
          firmId: firm_id,
          accountHead: 'Cash in Hand',
          fallbackType: 'CASH',
          session,
        });
        paymentPostAccountHead = cashPost.accountHead;
        paymentPostAccountType = cashPost.accountType;
      } else {
        if (!bank_account_id) throw new Error('Bank account is required for non-cash payments');
        const bankAccount = await BankAccount.findOne({
          _id: bank_account_id,
          $or: [{ firm_id: firm_id }, { firmId: firm_id }, { firm_id: firmIdObj }, { firmId: firmIdObj }]
        }).session(session);
        if (!bankAccount) throw new Error('Bank account not found or access denied');

        const bankPost = await resolveLedgerPostingAccount({
          firmId: firm_id,
          accountHead: bankAccount.account_name,
          fallbackType: 'BANK',
          session,
        });
        paymentPostAccountHead = bankPost.accountHead;
        paymentPostAccountType = bankPost.accountType;
        mongoBankAccountId = bank_account_id;
      }

      // Resolve Accounts in COA
      const leaderPost = await resolveLedgerPostingAccount({
        firmId: firm_id,
        accountHead: leader_name,
        fallbackType: 'LABOR_LEADER',
        session,
      });

      const expensePost = await resolveLedgerPostingAccount({
        firmId: firm_id,
        accountHead: 'Labor Wages & Expenses',
        fallbackType: 'EXPENSE',
        session,
      });

      const voucherGroupId = `LABOR_SETTLE_${uuidv4().substring(0, 8)}`;
      const transactionDate = payment_date || new Date().toISOString().split('T')[0];
      const totalGrossLiability = Number(total_wages) + Number(total_expenses);
      const adjustmentAmount = Number(net_payable) - Number(paid_amount);
      const bankIdObj = mongoBankAccountId ? new mongoose.Types.ObjectId(String(mongoBankAccountId)) : null;

      const entries: any[] = [
        // 1. Debit: Labor Wages & Expenses (Cost to firm)
        {
          firmId: firmIdObj,
          firm_id: firmIdObj,
          accountHead: expensePost.accountHead,
          accountType: expensePost.accountType,
          creditAmount: 0,
          debitAmount: totalGrossLiability,
          narration: `Final settlement for ${leader_name}`,
          refType: 'WAGE',
          voucherType: 'JOURNAL',
          transactionDate: transactionDate,
          voucherGroupId: voucherGroupId,
          createdBy: created_by,
        },
        // 2. Credit: Labor Leader Account (Gross liability)
        {
          firmId: firmIdObj,
          firm_id: firmIdObj,
          accountHead: leaderPost.accountHead,
          accountType: leaderPost.accountType,
          creditAmount: totalGrossLiability,
          debitAmount: 0,
          narration: `Settlement liability - ${leader_name}`,
          refType: 'WAGE',
          voucherType: 'JOURNAL',
          transactionDate: transactionDate,
          voucherGroupId: voucherGroupId,
          createdBy: created_by,
        },
        // 3. Credit: Cash / Bank Account (Funds leaving firm)
        {
          firmId: firmIdObj,
          firm_id: firmIdObj,
          accountHead: paymentPostAccountHead,
          accountType: paymentPostAccountType,
          creditAmount: paid_amount,
          debitAmount: 0,
          narration: `Final payout for ${leader_name}${adjustmentAmount !== 0 ? ' (Adjusted)' : ''} (${payment_mode})`,
          bankAccountId: bankIdObj,
          paymentMode: payment_mode,
          refType: 'WAGE',
          voucherType: 'PAYMENT',
          transactionDate: transactionDate,
          voucherGroupId: voucherGroupId,
          createdBy: created_by,
        },
        // 4. Debit: Labor Leader Account (Clear liability against payout)
        {
          firmId: firmIdObj,
          firm_id: firmIdObj,
          accountHead: leaderPost.accountHead,
          accountType: leaderPost.accountType,
          creditAmount: 0,
          debitAmount: paid_amount,
          narration: `Final payout for ${leader_name}`,
          paymentMode: payment_mode,
          refType: 'WAGE',
          voucherType: 'PAYMENT',
          transactionDate: transactionDate,
          voucherGroupId: voucherGroupId,
          createdBy: created_by,
        },
      ];

      // 5. Handle Adjustment / Discount
      if (Math.abs(adjustmentAmount) > 0.01) {
        const adjustmentPost = await resolveLedgerPostingAccount({
          firmId: firm_id,
          accountHead: 'Labor Settlement Adjustments',
          fallbackType: adjustmentAmount > 0 ? 'INCOME' : 'EXPENSE',
          session,
        });

        // If paying less than net_payable: Credit Income, Debit Leader Account
        entries.push({
          firmId: firmIdObj,
          firm_id: firmIdObj,
          accountHead: adjustmentPost.accountHead,
          accountType: adjustmentPost.accountType,
          creditAmount: adjustmentAmount > 0 ? adjustmentAmount : 0,
          debitAmount: adjustmentAmount < 0 ? Math.abs(adjustmentAmount) : 0,
          narration: `Settlement adjustment: ${adjustment_reason || 'Dispute/Rounding'}`,
          refType: 'WAGE',
          voucherType: 'JOURNAL',
          transactionDate: transactionDate,
          voucherGroupId: voucherGroupId,
          createdBy: created_by,
        });

        entries.push({
          firmId: firmIdObj,
          firm_id: firmIdObj,
          accountHead: leaderPost.accountHead,
          accountType: leaderPost.accountType,
          creditAmount: adjustmentAmount < 0 ? Math.abs(adjustmentAmount) : 0,
          debitAmount: adjustmentAmount > 0 ? adjustmentAmount : 0,
          narration: `Settlement adjustment clearing - ${leader_name}`,
          refType: 'WAGE',
          voucherType: 'JOURNAL',
          transactionDate: transactionDate,
          voucherGroupId: voucherGroupId,
          createdBy: created_by,
        });
      }

      assertBalanced(entries, `LABOR_SETTLEMENT ${voucherGroupId}`);

      await Ledger.insertMany(entries, { session });
      await session.commitTransaction();
      return voucherGroupId;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  },
};
