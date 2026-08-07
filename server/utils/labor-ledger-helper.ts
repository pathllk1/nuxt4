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
  let coa: any = await ChartOfAccounts.findOne({ firm_id: firmId, account_name: accountHead }).session(session);

  if (!coa) {
    const coaDocs = await ChartOfAccounts.create(
      [
        {
          firm_id: firmId,
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
        const bankAccount = await BankAccount.findOne({ _id: bank_account_id, firm_id }).session(session);
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

      const entries = [
        // Credit: Cash / Bank Account (Funds leaving firm)
        {
          firm_id: firm_id,
          account_head: paymentPostAccountHead,
          account_type: paymentPostAccountType,
          credit_amount: amount,
          debit_amount: 0,
          narration: `Labor Advance to ${leader_name} (${payment_mode})`,
          bank_account_id: mongoBankAccountId,
          payment_mode: payment_mode,
          ref_type: 'ADVANCE',
          transaction_date: transactionDate,
          voucher_group_id: voucherGroupId,
          created_by: created_by,
        },
        // Debit: Labor Leader Account Sub-ledger
        {
          firm_id: firm_id,
          account_head: leaderPost.accountHead,
          account_type: leaderPost.accountType,
          credit_amount: 0,
          debit_amount: amount,
          narration: `Labor Advance to ${leader_name} (${payment_mode})`,
          payment_mode: payment_mode,
          ref_type: 'ADVANCE',
          transaction_date: transactionDate,
          voucher_group_id: voucherGroupId,
          created_by: created_by,
        },
      ];

      assertBalanced(
        entries.map((e) => ({ debitAmount: e.debit_amount, creditAmount: e.credit_amount })),
        `LABOR_ADVANCE ${voucherGroupId}`
      );

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
        const bankAccount = await BankAccount.findOne({ _id: bank_account_id, firm_id }).session(session);
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

      const entries = [
        // 1. Debit: Labor Wages & Expenses (Cost to firm)
        {
          firm_id: firm_id,
          account_head: expensePost.accountHead,
          account_type: expensePost.accountType,
          credit_amount: 0,
          debit_amount: totalGrossLiability,
          narration: `Final settlement for ${leader_name}`,
          ref_type: 'WAGE',
          transaction_date: transactionDate,
          voucher_group_id: voucherGroupId,
          created_by: created_by,
        },
        // 2. Credit: Labor Leader Account (Gross liability)
        {
          firm_id: firm_id,
          account_head: leaderPost.accountHead,
          account_type: leaderPost.accountType,
          credit_amount: totalGrossLiability,
          debit_amount: 0,
          narration: `Settlement liability - ${leader_name}`,
          ref_type: 'WAGE',
          transaction_date: transactionDate,
          voucher_group_id: voucherGroupId,
          created_by: created_by,
        },
        // 3. Credit: Cash / Bank Account (Funds leaving firm)
        {
          firm_id: firm_id,
          account_head: paymentPostAccountHead,
          account_type: paymentPostAccountType,
          credit_amount: paid_amount,
          debit_amount: 0,
          narration: `Final payout for ${leader_name}${adjustmentAmount !== 0 ? ' (Adjusted)' : ''} (${payment_mode})`,
          bank_account_id: mongoBankAccountId,
          payment_mode: payment_mode,
          ref_type: 'WAGE',
          transaction_date: transactionDate,
          voucher_group_id: voucherGroupId,
          created_by: created_by,
        },
        // 4. Debit: Labor Leader Account (Clear liability against payout)
        {
          firm_id: firm_id,
          account_head: leaderPost.accountHead,
          account_type: leaderPost.accountType,
          credit_amount: 0,
          debit_amount: paid_amount,
          narration: `Final payout for ${leader_name}`,
          payment_mode: payment_mode,
          ref_type: 'WAGE',
          transaction_date: transactionDate,
          voucher_group_id: voucherGroupId,
          created_by: created_by,
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
          firm_id: firm_id,
          account_head: adjustmentPost.accountHead,
          account_type: adjustmentPost.accountType,
          credit_amount: adjustmentAmount > 0 ? adjustmentAmount : 0,
          debit_amount: adjustmentAmount < 0 ? Math.abs(adjustmentAmount) : 0,
          narration: `Settlement adjustment: ${adjustment_reason || 'Dispute/Rounding'}`,
          ref_type: 'WAGE',
          transaction_date: transactionDate,
          voucher_group_id: voucherGroupId,
          created_by: created_by,
        });

        entries.push({
          firm_id: firm_id,
          account_head: leaderPost.accountHead,
          account_type: leaderPost.accountType,
          credit_amount: adjustmentAmount < 0 ? Math.abs(adjustmentAmount) : 0,
          debit_amount: adjustmentAmount > 0 ? adjustmentAmount : 0,
          narration: `Settlement adjustment clearing - ${leader_name}`,
          ref_type: 'WAGE',
          transaction_date: transactionDate,
          voucher_group_id: voucherGroupId,
          created_by: created_by,
        });
      }

      assertBalanced(
        entries.map((e) => ({ debitAmount: e.debit_amount, creditAmount: e.credit_amount })),
        `LABOR_SETTLEMENT ${voucherGroupId}`
      );

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
