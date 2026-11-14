import mongoose from 'mongoose';
import BankAccount from '../models/BankAccount';
import ChartOfAccounts from '../models/ChartOfAccounts';
import { UnifiedPostingService } from './accounting/unified-posting.service';
import { type IVoucherLeg } from '../types/accounting';
import { getFinancialYearFromDate } from './accounting/period-lock.service';

interface PostLaborAdvanceParams {
  firm_id: string;
  amount: number;
  payment_date: string;
  bank_account_id?: string | null;
  payment_mode: string;
  leader_name: string;
  created_by: string;
  tds_mode: 'NONE' | 'DEDUCT' | 'GROSS_UP';
  tds_rate: number;
  tds_amount: number;
  gross_amount: number;
  external_voucher_group_id: string;
  source_payment_ref: string;
  deductee_id: string;
  deductee_pan: string;
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
  payment_mode: string;
  leader_name: string;
  created_by: string;
  external_voucher_group_id: string;
}

export const laborLedgerHelper = {
  /**
   * Post Labor Advance Payment to MongoDB Ledger via UnifiedPostingService
   */
  async postLaborAdvance(params: PostLaborAdvanceParams): Promise<string> {
    const {
      firm_id, amount, payment_date, bank_account_id, payment_mode,
      leader_name, created_by, tds_mode, tds_rate, tds_amount,
      gross_amount
    } = params;

    getFinancialYearFromDate(payment_date);
    if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(tds_amount) || tds_amount < 0 ||
      !Number.isFinite(gross_amount) || gross_amount <= 0 || !Number.isFinite(tds_rate) || tds_rate < 0 ||
      !params.external_voucher_group_id || !params.source_payment_ref || !params.deductee_id || !created_by) {
      throw new Error('Labor advance posting requires valid amounts, source identity, date, and creator.');
    }
    if (
      Math.abs(gross_amount - amount - tds_amount) > 0.01 ||
      (tds_mode === 'NONE' && tds_amount !== 0) ||
      (tds_mode !== 'NONE' && tds_rate <= 0)
    ) {
      throw new Error('Labor advance TDS values do not form a balanced gross, net, and tax amount.');
    }

    const session = await mongoose.startSession();

    try {
      session.startTransaction();
      const firmIdObj = new mongoose.Types.ObjectId(String(firm_id));
      let paymentPostAccountHead = '';
      let paymentPostAccountType = '';
      let mongoBankAccountId: string | null = null;

      if (payment_mode === 'CASH') {
        const cashAccounts = await ChartOfAccounts.find({
          $or: [{ firm_id: firmIdObj }, { firmId: firmIdObj }],
          account_name: 'Cash in Hand',
          account_type: 'CASH',
          is_active: true
        }, 'account_name').session(session).lean();
        if (cashAccounts.length !== 1) {
          throw new Error(`Expected exactly one active Cash in Hand account for firm ${firm_id}; found ${cashAccounts.length}.`);
        }
        paymentPostAccountHead = cashAccounts[0]!.account_name;
        paymentPostAccountType = 'CASH';
      } else {
        if (!bank_account_id) throw new Error('Bank account is required for non-cash payments');
        const bankAccount = await BankAccount.findOne({
          _id: bank_account_id,
          status: 'ACTIVE',
          $or: [{ firm_id: firm_id }, { firmId: firm_id }, { firm_id: firmIdObj }, { firmId: firmIdObj }]
        }).session(session);
        if (!bankAccount) throw new Error('Bank account not found or access denied');

        paymentPostAccountHead = bankAccount.account_name;
        paymentPostAccountType = 'BANK';
        mongoBankAccountId = bank_account_id;
      }

      if (!['BANK', 'CHEQUE', 'UPI', 'NEFT', 'RTGS'].includes(payment_mode) && payment_mode !== 'CASH') {
        throw new Error(`Unsupported labor payment mode "${payment_mode}".`);
      }
      const transactionDate = payment_date;
      const bankIdObj = mongoBankAccountId ? new mongoose.Types.ObjectId(String(mongoBankAccountId)) : null;

      const statutorySnapshot = tds_amount > 0 ? {
        isTds: true,
        tdsSection: '194C',
        tdsRate: tds_rate,
        isGrossUp: tds_mode === 'GROSS_UP',
        grossAmount: gross_amount,
        taxableAmount: gross_amount,
        netAmount: amount,
        tdsAmount: tds_amount,
        pan: params.deductee_pan,
        deducteeId: params.deductee_id,
        deducteeName: leader_name,
        sourcePaymentRef: params.source_payment_ref
      } : undefined;

      let legs: IVoucherLeg[] = [];

      if (tds_mode === 'GROSS_UP' && tds_amount > 0) {
        legs = [
          // 1. Debit: Labor Leader Account (Net advance against wages - leader's bill is deducted only by net)
          {
            accountHead: leader_name,
            accountType: 'LABOR_LEADER',
            debitAmount: amount,
            creditAmount: 0,
            narration: `Labor Advance to ${leader_name} (${payment_mode})`,
            sourcePaymentRef: params.source_payment_ref
          },
          // 2. Debit: TDS Borne by Company (Tax expense on firm's head u/s 195A)
          {
            accountHead: 'TDS Borne by Company',
            accountType: 'EXPENSE',
            debitAmount: tds_amount,
            creditAmount: 0,
            narration: `TDS u/s 194C borne by firm u/s 195A on advance to ${leader_name} (${tds_rate}%)`,
            sourcePaymentRef: params.source_payment_ref
          },
          // 3. Credit: TDS Payable Liability
          {
            accountHead: 'TDS Payable u/s 194C',
            accountType: 'DUTIES_AND_TAXES',
            debitAmount: 0,
            creditAmount: tds_amount,
            narration: `TDS 194C on Advance to ${leader_name} (${tds_rate}%)`,
            statutory: statutorySnapshot,
            sourcePaymentRef: params.source_payment_ref
          } as IVoucherLeg,
          // 4. Credit: Cash / Bank Account (Net cash paid out)
          {
            accountHead: paymentPostAccountHead,
            accountType: paymentPostAccountType,
            debitAmount: 0,
            creditAmount: amount,
            bankAccountId: bankIdObj,
            paymentMode: payment_mode,
            narration: `Labor Advance net payout to ${leader_name} (${payment_mode})`,
            sourcePaymentRef: params.source_payment_ref
          },
        ];
      } else if (tds_mode === 'DEDUCT' && tds_amount > 0) {
        legs = [
          // Debit: Labor Leader Account (Gross contract value - leader bears TDS)
          {
            accountHead: leader_name,
            accountType: 'LABOR_LEADER',
            debitAmount: gross_amount,
            creditAmount: 0,
            narration: `Labor Advance to ${leader_name} (TDS Deducted u/s 194C @ ${tds_rate}%)`,
            sourcePaymentRef: params.source_payment_ref
          },
          // Credit: TDS Payable Liability
          {
            accountHead: 'TDS Payable u/s 194C',
            accountType: 'DUTIES_AND_TAXES',
            debitAmount: 0,
            creditAmount: tds_amount,
            narration: `TDS 194C on Advance to ${leader_name} (${tds_rate}%)`,
            statutory: statutorySnapshot,
            sourcePaymentRef: params.source_payment_ref
          } as IVoucherLeg,
          // Credit: Cash / Bank Account (Net cash paid)
          {
            accountHead: paymentPostAccountHead,
            accountType: paymentPostAccountType,
            debitAmount: 0,
            creditAmount: amount,
            bankAccountId: bankIdObj,
            paymentMode: payment_mode,
            narration: `Labor Advance net payout to ${leader_name} (${payment_mode})`,
            sourcePaymentRef: params.source_payment_ref
          },
        ];
      } else {
        // Standard 2-leg Advance without TDS
        legs = [
          // Debit: Labor Leader Account (advance given)
          {
            accountHead: leader_name,
            accountType: 'LABOR_LEADER',
            debitAmount: amount,
            creditAmount: 0,
            narration: `Labor Advance to ${leader_name} (${payment_mode})`,
            sourcePaymentRef: params.source_payment_ref
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
            sourcePaymentRef: params.source_payment_ref
          },
        ];
      }

      const postResult = await UnifiedPostingService.postVoucher({
        firmId: firmIdObj,
        voucherType: 'PAYMENT',
        transactionDate,
        narration: `Labor Advance to ${leader_name} (${payment_mode})${tds_mode === 'GROSS_UP' ? ' [TDS Gross-Up]' : ''}`,
        legs,
        createdBy: created_by,
        refType: 'ADVANCE',
        externalVoucherGroupId: params.external_voucher_group_id,
        tags: { laborLeaderName: leader_name, tdsMode: tds_mode, tdsRate: tds_rate, tdsAmount: tds_amount, statutory: statutorySnapshot },
      }, session);

      await session.commitTransaction();
      return postResult.voucherGroupId;
    } catch (error: any) {
      if (session.inTransaction()) {
        try {
          await session.abortTransaction();
        } catch (abortError: any) {
          throw new Error(`Labor advance posting failed (${error.message}); transaction abort also failed (${abortError.message}).`);
        }
      }
      throw error;
    } finally {
      await session.endSession();
    }
  },

  /**
   * Post Labor Final Settlement to MongoDB Ledger via UnifiedPostingService
   */
  async postLaborSettlement(params: PostLaborSettlementParams): Promise<string | null> {
    const {
      firm_id,
      total_wages,
      total_expenses,
      total_advances,
      net_payable,
      paid_amount,
      adjustment_reason,
      payment_date,
      bank_account_id,
      payment_mode,
      leader_name,
      created_by,
    } = params;

    getFinancialYearFromDate(payment_date);
    if (!created_by || !params.external_voucher_group_id ||
      ![total_wages, total_expenses, total_advances, net_payable, paid_amount].every(Number.isFinite) ||
      [total_wages, total_expenses, total_advances, paid_amount].some(value => value < 0)) {
      throw new Error('Labor settlement posting requires valid amounts, source identity, date, and creator.');
    }

    const session = await mongoose.startSession();

    try {
      session.startTransaction();
      const firmIdObj = new mongoose.Types.ObjectId(String(firm_id));
      let paymentPostAccountHead = '';
      let paymentPostAccountType = '';
      let mongoBankAccountId: string | null = null;

      if (payment_mode === 'CASH' && paid_amount > 0) {
        const cashAccounts = await ChartOfAccounts.find({
          $or: [{ firm_id: firmIdObj }, { firmId: firmIdObj }],
          account_name: 'Cash in Hand',
          account_type: 'CASH',
          is_active: true
        }, 'account_name').session(session).lean();
        if (cashAccounts.length !== 1) {
          throw new Error(`Expected exactly one active Cash in Hand account for firm ${firm_id}; found ${cashAccounts.length}.`);
        }
        paymentPostAccountHead = cashAccounts[0]!.account_name;
        paymentPostAccountType = 'CASH';
      } else if (payment_mode !== 'CASH' && paid_amount > 0) {
        if (!bank_account_id) throw new Error('Bank account is required for non-cash payments');
        const bankAccount = await BankAccount.findOne({
          _id: bank_account_id,
          status: 'ACTIVE',
          $or: [{ firm_id: firm_id }, { firmId: firm_id }, { firm_id: firmIdObj }, { firmId: firmIdObj }]
        }).session(session);
        if (!bankAccount) throw new Error('Bank account not found or access denied');

        paymentPostAccountHead = bankAccount.account_name;
        paymentPostAccountType = 'BANK';
        mongoBankAccountId = bank_account_id;
      }

      getFinancialYearFromDate(payment_date);
      if (!['CASH', 'BANK', 'CHEQUE', 'UPI', 'NEFT', 'RTGS'].includes(payment_mode)) {
        throw new Error(`Unsupported labor payment mode "${payment_mode}".`);
      }
      const transactionDate = payment_date;
      const totalGrossLiability = Number(total_wages) + Number(total_expenses);
      const numNetPayable = Number(net_payable);
      const numPaidAmount = Number(paid_amount);
      if (Math.abs(numNetPayable - (Number(total_wages) + Number(total_expenses) - Number(total_advances))) > 0.01) {
        throw new Error('Labor settlement net payable does not match wages, expenses, and advances.');
      }
      const bankIdObj = mongoBankAccountId ? new mongoose.Types.ObjectId(String(mongoBankAccountId)) : null;

      const legs: IVoucherLeg[] = [];

      // 1 & 2. Gross Wage / Expense Liability (Cost to firm)
      if (totalGrossLiability > 0) {
        legs.push(
          {
            accountHead: 'Labor Wages & Expenses',
            accountType: 'EXPENSE',
            debitAmount: totalGrossLiability,
            creditAmount: 0,
            narration: `Final settlement for ${leader_name}`,
          },
          {
            accountHead: leader_name,
            accountType: 'LABOR_LEADER',
            debitAmount: 0,
            creditAmount: totalGrossLiability,
            narration: `Settlement liability - ${leader_name}`,
          }
        );
      }

      // 3 & 4. Payout Legs (Funds leaving firm, only if money actually paid)
      if (numPaidAmount > 0) {
        legs.push(
          {
            accountHead: paymentPostAccountHead,
            accountType: paymentPostAccountType,
            debitAmount: 0,
            creditAmount: numPaidAmount,
            bankAccountId: bankIdObj,
            paymentMode: payment_mode,
            narration: `Final payout for ${leader_name} (${payment_mode})`,
          },
          {
            accountHead: leader_name,
            accountType: 'LABOR_LEADER',
            debitAmount: numPaidAmount,
            creditAmount: 0,
            narration: `Final payout for ${leader_name}`,
          }
        );
      }

      // 5 & 6. Handle Settlement Adjustment / Discount / Rounding
      // Note: Adjustments only apply when net_payable > 0 and the actual payout differs from net_payable.
      // If net_payable <= 0, advances exceeded wages; the remaining advance balance simply carries forward
      // on the leader's account in the General Ledger as an asset (unabsorbed advance) and MUST NOT be written off.
      let adjustmentAmount = 0;
      if (numNetPayable > 0) {
        adjustmentAmount = numNetPayable - numPaidAmount;
      }

      if (Math.abs(adjustmentAmount) > 0.01) {
        if (!adjustment_reason?.trim()) {
          throw new Error('An explicit adjustment reason is required when settlement amount differs from net payable.');
        }
        // If paying less than net_payable: Credit Income (Discount/Waiver), Debit Leader Account
        legs.push({
          accountHead: 'Labor Settlement Adjustments',
          accountType: adjustmentAmount > 0 ? 'INCOME' : 'EXPENSE',
          debitAmount: adjustmentAmount < 0 ? Math.abs(adjustmentAmount) : 0,
          creditAmount: adjustmentAmount > 0 ? adjustmentAmount : 0,
          narration: `Settlement adjustment: ${adjustment_reason.trim()}`,
        });

        legs.push({
          accountHead: leader_name,
          accountType: 'LABOR_LEADER',
          debitAmount: adjustmentAmount > 0 ? adjustmentAmount : 0,
          creditAmount: adjustmentAmount < 0 ? Math.abs(adjustmentAmount) : 0,
          narration: `Settlement adjustment clearing - ${leader_name}`,
        });
      }

      // A zero-activity settlement has no ledger voucher.
      if (legs.length === 0) {
        await session.commitTransaction();
        return null;
      }

      const postResult = await UnifiedPostingService.postVoucher({
        firmId: firmIdObj,
        voucherType: 'JOURNAL',
        transactionDate,
        narration: `Final settlement for ${leader_name}`,
        legs,
        createdBy: created_by,
        refType: 'WAGE',
        externalVoucherGroupId: params.external_voucher_group_id,
        tags: { laborLeaderName: leader_name },
      }, session);

      await session.commitTransaction();
      return postResult.voucherGroupId;
    } catch (error: any) {
      if (session.inTransaction()) {
        try {
          await session.abortTransaction();
        } catch (abortError: any) {
          throw new Error(`Labor settlement posting failed (${error.message}); transaction abort also failed (${abortError.message}).`);
        }
      }
      throw error;
    } finally {
      await session.endSession();
    }
  },
};
