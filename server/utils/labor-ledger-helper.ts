import mongoose from 'mongoose';
import BankAccount from '../models/BankAccount';
import { UnifiedPostingService } from './accounting/unified-posting.service';
import { type IVoucherLeg } from '../types/accounting';

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

export const laborLedgerHelper = {
  /**
   * Post Labor Advance Payment to MongoDB Ledger via UnifiedPostingService
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

      if (payment_mode !== 'CASH') {
        if (!bank_account_id) throw new Error('Bank account is required for non-cash payments');
        const bankAccount = await BankAccount.findOne({
          _id: bank_account_id,
          $or: [{ firm_id: firm_id }, { firmId: firm_id }, { firm_id: firmIdObj }, { firmId: firmIdObj }]
        }).session(session);
        if (!bankAccount) throw new Error('Bank account not found or access denied');

        paymentPostAccountHead = bankAccount.account_name;
        paymentPostAccountType = 'BANK';
        mongoBankAccountId = bank_account_id;
      }

      const transactionDate: string = payment_date || (new Date().toISOString().split('T')[0] as string);
      const bankIdObj = mongoBankAccountId ? new mongoose.Types.ObjectId(String(mongoBankAccountId)) : null;

      const legs: IVoucherLeg[] = [
        // Debit: Labor Leader Account (advance given)
        {
          accountHead: leader_name,
          accountType: 'LABOR_LEADER',
          debitAmount: amount,
          creditAmount: 0,
          narration: `Labor Advance to ${leader_name} (${payment_mode})`,
        },
        // Credit: Cash / Bank Account (Funds leaving firm)
        {
          accountHead: paymentPostAccountHead,
          accountType: paymentPostAccountType,
          debitAmount: 0,
          creditAmount: amount,
          bankAccountId: bankIdObj,
          paymentMode: payment_mode,
          narration: `Labor Advance to ${leader_name} (${payment_mode})`,
        },
      ];

      const postResult = await UnifiedPostingService.postVoucher({
        firmId: firmIdObj,
        voucherType: 'PAYMENT',
        transactionDate,
        narration: `Labor Advance to ${leader_name} (${payment_mode})`,
        legs,
        createdBy: created_by || 'system',
        refType: 'ADVANCE',
        tags: { laborLeaderName: leader_name },
      }, session);

      await session.commitTransaction();
      return postResult.voucherGroupId;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  },

  /**
   * Post Labor Final Settlement to MongoDB Ledger via UnifiedPostingService
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

      if (payment_mode !== 'CASH') {
        if (!bank_account_id) throw new Error('Bank account is required for non-cash payments');
        const bankAccount = await BankAccount.findOne({
          _id: bank_account_id,
          $or: [{ firm_id: firm_id }, { firmId: firm_id }, { firm_id: firmIdObj }, { firmId: firmIdObj }]
        }).session(session);
        if (!bankAccount) throw new Error('Bank account not found or access denied');

        paymentPostAccountHead = bankAccount.account_name;
        paymentPostAccountType = 'BANK';
        mongoBankAccountId = bank_account_id;
      }

      const transactionDate: string = payment_date || (new Date().toISOString().split('T')[0] as string);
      const totalGrossLiability = Number(total_wages) + Number(total_expenses);
      const adjustmentAmount = Number(net_payable) - Number(paid_amount);
      const bankIdObj = mongoBankAccountId ? new mongoose.Types.ObjectId(String(mongoBankAccountId)) : null;

      const legs: IVoucherLeg[] = [
        // 1. Debit: Labor Wages & Expenses (Cost to firm)
        {
          accountHead: 'Labor Wages & Expenses',
          accountType: 'EXPENSE',
          debitAmount: totalGrossLiability,
          creditAmount: 0,
          narration: `Final settlement for ${leader_name}`,
        },
        // 2. Credit: Labor Leader Account (Gross liability)
        {
          accountHead: leader_name,
          accountType: 'LABOR_LEADER',
          debitAmount: 0,
          creditAmount: totalGrossLiability,
          narration: `Settlement liability - ${leader_name}`,
        },
        // 3. Credit: Cash / Bank Account (Funds leaving firm)
        {
          accountHead: paymentPostAccountHead,
          accountType: paymentPostAccountType,
          debitAmount: 0,
          creditAmount: paid_amount,
          bankAccountId: bankIdObj,
          paymentMode: payment_mode,
          narration: `Final payout for ${leader_name}${adjustmentAmount !== 0 ? ' (Adjusted)' : ''} (${payment_mode})`,
        },
        // 4. Debit: Labor Leader Account (Clear liability against payout)
        {
          accountHead: leader_name,
          accountType: 'LABOR_LEADER',
          debitAmount: paid_amount,
          creditAmount: 0,
          narration: `Final payout for ${leader_name}`,
        },
      ];

      // 5. Handle Adjustment / Discount
      if (Math.abs(adjustmentAmount) > 0.01) {
        // If paying less than net_payable: Credit Income, Debit Leader Account
        legs.push({
          accountHead: 'Labor Settlement Adjustments',
          accountType: adjustmentAmount > 0 ? 'INCOME' : 'EXPENSE',
          debitAmount: adjustmentAmount < 0 ? Math.abs(adjustmentAmount) : 0,
          creditAmount: adjustmentAmount > 0 ? adjustmentAmount : 0,
          narration: `Settlement adjustment: ${adjustment_reason || 'Dispute/Rounding'}`,
        });

        legs.push({
          accountHead: leader_name,
          accountType: 'LABOR_LEADER',
          debitAmount: adjustmentAmount > 0 ? adjustmentAmount : 0,
          creditAmount: adjustmentAmount < 0 ? Math.abs(adjustmentAmount) : 0,
          narration: `Settlement adjustment clearing - ${leader_name}`,
        });
      }

      const postResult = await UnifiedPostingService.postVoucher({
        firmId: firmIdObj,
        voucherType: 'JOURNAL',
        transactionDate,
        narration: `Final settlement for ${leader_name}`,
        legs,
        createdBy: created_by || 'system',
        refType: 'WAGE',
        tags: { laborLeaderName: leader_name },
      }, session);

      await session.commitTransaction();
      return postResult.voucherGroupId;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  },
};
