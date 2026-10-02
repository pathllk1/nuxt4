import mongoose from 'mongoose';
import Ledger from '../../models/Ledger';
import PeriodLock from '../../models/PeriodLock';
import { UnifiedPostingService } from './unified-posting.service';
import { LedgerService } from './ledger.service';
import { getCurrentFinancialYear } from './bill-utils';
import {
  type IVoucherPayload,
  type IVoucherLeg,
  classifyAccountType,
  PNL_ACCOUNT_TYPES,
} from '../../types/accounting';

// ─────────────────────────────────────────────────────────────────────────
// FISCAL YEAR CLOSING SERVICE
//
// Executes the year-end closing workflow in 3 atomic steps:
//   1. P&L Account Zeroing Sweep — debits all income, credits all expense,
//      nets to Reserves & Surplus
//   2. Roll-Forward Opening Balances — generates OB vouchers for the next FY
//      for all Balance Sheet accounts
//   3. Hard Period Lock — freezes the closed FY
//
// CAUTION: This is an irreversible financial operation. The closingStatus
// flag on PeriodLock prevents double-execution. Only a DBA can reset
// a CLOSED status.
// ─────────────────────────────────────────────────────────────────────────

export interface IClosingPreview {
  financialYear: string;
  trialBalanceParity: boolean;
  totalIncome: number;
  totalExpense: number;
  netProfit: number;
  profitType: 'PROFIT' | 'LOSS';
  balanceSheetAccountCount: number;
  pnlAccountCount: number;
  canClose: boolean;
  blockingReasons: string[];
}

export interface IClosingResult {
  success: boolean;
  financialYear: string;
  closingVoucherNo: string;
  netProfit: number;
  profitType: 'PROFIT' | 'LOSS';
  openingBalancesGenerated: number;
  lockDate: string;
}

export class FiscalYearClosingService {

  static readonly RESERVES_HEAD = 'Reserves & Surplus';
  static readonly RESERVES_TYPE = 'CAPITAL';

  /**
   * Validates whether a financial year is ready for closing.
   * Returns a preview with P&L summary and any blocking reasons.
   *
   * This is a READ-ONLY operation — safe to call multiple times.
   */
  static async previewClose(
    firmId: mongoose.Types.ObjectId | string,
    financialYear: string
  ): Promise<IClosingPreview> {
    const firmIdObj = new mongoose.Types.ObjectId(String(firmId));
    const { fyStartDate, fyEndDate } = this.getFYDates(financialYear);

    const blockingReasons: string[] = [];

    // Check if already closed
    const existingLock = await PeriodLock.findOne({
      firmId: firmIdObj,
      financialYear,
    }).lean();

    if (existingLock?.closingStatus === 'CLOSED') {
      blockingReasons.push(`FY ${financialYear} has already been closed`);
    }

    if (existingLock?.closingStatus === 'IN_PROGRESS') {
      blockingReasons.push(`FY ${financialYear} closing is currently in progress`);
    }

    // Get Trial Balance for the FY period
    const trialBalance = await LedgerService.getTrialBalance(firmIdObj, fyStartDate, fyEndDate);

    // Check Trial Balance parity
    const totalDr = trialBalance.reduce((sum, b) => sum + b.totalDebit, 0);
    const totalCr = trialBalance.reduce((sum, b) => sum + b.totalCredit, 0);
    const tbParity = Math.abs(totalDr - totalCr) < 0.01;

    if (!tbParity) {
      blockingReasons.push(
        `Trial Balance is not balanced: DR ₹${totalDr.toFixed(2)} vs CR ₹${totalCr.toFixed(2)} ` +
        `(Difference: ₹${Math.abs(totalDr - totalCr).toFixed(2)})`
      );
    }

    // Classify accounts and compute P&L summary
    let totalIncome = 0;
    let totalExpense = 0;
    let pnlCount = 0;
    let bsCount = 0;

    for (const account of trialBalance) {
      const classification = classifyAccountType(account.accountType);

      if (classification === 'PNL') {
        pnlCount++;
        const netBalance = account.totalCredit - account.totalDebit;

        if (PNL_ACCOUNT_TYPES.has(account.accountType) &&
            (account.accountType === 'INCOME' || account.accountType === 'INDIRECT_INCOME')) {
          totalIncome += Math.abs(netBalance);
        } else {
          totalExpense += Math.abs(account.totalDebit - account.totalCredit);
        }
      } else {
        bsCount++;
      }
    }

    const netProfit = totalIncome - totalExpense;

    return {
      financialYear,
      trialBalanceParity: tbParity,
      totalIncome,
      totalExpense,
      netProfit: Math.abs(netProfit),
      profitType: netProfit >= 0 ? 'PROFIT' : 'LOSS',
      balanceSheetAccountCount: bsCount,
      pnlAccountCount: pnlCount,
      canClose: blockingReasons.length === 0,
      blockingReasons,
    };
  }

  /**
   * Executes the year-end closing for a financial year.
   *
   * This is an ATOMIC operation wrapped in a MongoDB transaction:
   *   Step 1: Validate Trial Balance parity
   *   Step 2: Post CLOSING_ENTRY voucher (zero P&L, net to Reserves)
   *   Step 3: Generate OPENING_BALANCE vouchers for next FY
   *   Step 4: Set period lock on the closed FY
   *
   * IDEMPOTENCY: Refuses to execute if closingStatus is IN_PROGRESS or CLOSED.
   */
  static async executeClose(params: {
    firmId: mongoose.Types.ObjectId | string;
    financialYear: string;
    closedBy: string;
  }): Promise<IClosingResult> {
    const { firmId, financialYear, closedBy } = params;
    const firmIdObj = new mongoose.Types.ObjectId(String(firmId));
    const { fyStartDate, fyEndDate, nextFyStartDate, nextFY } = this.getFYDates(financialYear);

    // ── Idempotency Guard ──
    const existingLock = await PeriodLock.findOne({
      firmId: firmIdObj,
      financialYear,
    });

    if (existingLock?.closingStatus === 'CLOSED') {
      throw new Error(`FY ${financialYear} has already been closed. Cannot re-execute.`);
    }

    if (existingLock?.closingStatus === 'IN_PROGRESS') {
      throw new Error(`FY ${financialYear} closing is already in progress. Please wait.`);
    }

    // ── Mark as IN_PROGRESS (pessimistic lock) ──
    await PeriodLock.findOneAndUpdate(
      { firmId: firmIdObj, financialYear },
      {
        $set: { closingStatus: 'IN_PROGRESS' },
        $setOnInsert: {
          firmId: firmIdObj,
          financialYear,
          lockDate: fyEndDate,
          lockedBy: closedBy,
          isActive: false,
          reason: 'Year-end close in progress',
        },
      },
      { upsert: true }
    );

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // ── Step 1: Get Trial Balance for the FY ──
      const trialBalance = await LedgerService.getTrialBalance(firmIdObj, fyStartDate, fyEndDate);

      const totalDr = trialBalance.reduce((sum, b) => sum + b.totalDebit, 0);
      const totalCr = trialBalance.reduce((sum, b) => sum + b.totalCredit, 0);

      if (Math.abs(totalDr - totalCr) > 0.01) {
        throw new Error(
          `Cannot close: Trial Balance is unbalanced. ` +
          `DR ₹${totalDr.toFixed(2)} vs CR ₹${totalCr.toFixed(2)}`
        );
      }

      // ── Step 2: Post CLOSING_ENTRY — Zero all P&L accounts ──
      const closingLegs: IVoucherLeg[] = [];
      let totalIncomeCleared = 0;
      let totalExpenseCleared = 0;

      for (const account of trialBalance) {
        const classification = classifyAccountType(account.accountType);
        if (classification !== 'PNL') continue;

        const netBalance = account.totalDebit - account.totalCredit;
        if (Math.abs(netBalance) < 0.01) continue; // Already zero

        if (netBalance > 0) {
          // Account has a net debit balance (Expense) — credit to zero it
          closingLegs.push({
            accountHead: account.accountHead,
            accountType: account.accountType,
            debitAmount: 0,
            creditAmount: netBalance,
            narration: `Year-End Close: Zeroing ${account.accountHead} (FY ${financialYear})`,
          });
          totalExpenseCleared += netBalance;
        } else {
          // Account has a net credit balance (Income) — debit to zero it
          closingLegs.push({
            accountHead: account.accountHead,
            accountType: account.accountType,
            debitAmount: Math.abs(netBalance),
            creditAmount: 0,
            narration: `Year-End Close: Zeroing ${account.accountHead} (FY ${financialYear})`,
          });
          totalIncomeCleared += Math.abs(netBalance);
        }
      }

      // Net profit/loss goes to Reserves & Surplus
      const netProfit = totalIncomeCleared - totalExpenseCleared;
      let closingVoucherNo = '';

      if (closingLegs.length > 0) {
        if (netProfit > 0) {
          // Profit: Credit Reserves & Surplus
          closingLegs.push({
            accountHead: this.RESERVES_HEAD,
            accountType: this.RESERVES_TYPE,
            debitAmount: 0,
            creditAmount: netProfit,
            narration: `Net Profit transferred to Reserves & Surplus (FY ${financialYear})`,
          });
        } else if (netProfit < 0) {
          // Loss: Debit Reserves & Surplus
          closingLegs.push({
            accountHead: this.RESERVES_HEAD,
            accountType: this.RESERVES_TYPE,
            debitAmount: Math.abs(netProfit),
            creditAmount: 0,
            narration: `Net Loss transferred to Reserves & Surplus (FY ${financialYear})`,
          });
        }

        const closingPayload: IVoucherPayload = {
          firmId: firmIdObj,
          voucherType: 'CLOSING_ENTRY',
          transactionDate: fyEndDate,
          narration: `Year-End Closing Entry for FY ${financialYear}`,
          legs: closingLegs,
          createdBy: closedBy,
          refType: 'YEAR_END_CLOSE',
          _bypassPeriodLock: true, // Must bypass since we're writing to the period being locked
        };

        const closingResult = await UnifiedPostingService.postVoucher(closingPayload, session);
        closingVoucherNo = closingResult.voucherNo;
      }

      // ── Step 3: Generate Opening Balances for next FY ──
      // Get the UPDATED trial balance (after closing entry) for BS accounts only
      const updatedBalance = await Ledger.aggregate([
        {
          $match: {
            firmId: firmIdObj,
            transactionDate: { $lte: fyEndDate },
          },
        },
        {
          $group: {
            _id: { accountHead: '$accountHead', accountType: '$accountType' },
            totalDebit: { $sum: '$debitAmount' },
            totalCredit: { $sum: '$creditAmount' },
          },
        },
      ]).session(session);

      let obCount = 0;
      const obLegs: IVoucherLeg[] = [];

      for (const row of updatedBalance) {
        const accountType = row._id.accountType;
        const classification = classifyAccountType(accountType);

        // Only carry forward Balance Sheet (permanent) accounts
        if (classification !== 'BALANCE_SHEET') continue;

        const netBalance = (row.totalDebit || 0) - (row.totalCredit || 0);
        if (Math.abs(netBalance) < 0.01) continue; // Zero balance, skip

        obLegs.push({
          accountHead: row._id.accountHead,
          accountType: accountType,
          debitAmount: netBalance > 0 ? netBalance : 0,
          creditAmount: netBalance < 0 ? Math.abs(netBalance) : 0,
          narration: `Opening Balance for FY ${nextFY}`,
        });

        obCount++;
      }

      // Post OB voucher if there are any non-zero balances
      if (obLegs.length > 0) {
        // OB entries are self-balancing by definition (they represent the entire
        // balance sheet which must balance). But we use 'Difference in Opening Balances'
        // as the contra if there's any rounding drift.
        const obDr = obLegs.reduce((s, l) => s + (l.debitAmount || 0), 0);
        const obCr = obLegs.reduce((s, l) => s + (l.creditAmount || 0), 0);
        const obDiff = obDr - obCr;

        if (Math.abs(obDiff) > 0.001) {
          obLegs.push({
            accountHead: 'Difference in Opening Balances',
            accountType: 'CAPITAL',
            debitAmount: obDiff < 0 ? Math.abs(obDiff) : 0,
            creditAmount: obDiff > 0 ? obDiff : 0,
            narration: `Rounding adjustment for OB FY ${nextFY}`,
          });
        }

        const obPayload: IVoucherPayload = {
          firmId: firmIdObj,
          voucherType: 'OPENING_BALANCE',
          transactionDate: nextFyStartDate,
          narration: `Opening Balances rolled forward from FY ${financialYear}`,
          legs: obLegs,
          createdBy: closedBy,
          refType: 'YEAR_END_CLOSE',
          _bypassPeriodLock: true,
        };

        await UnifiedPostingService.postVoucher(obPayload, session);
      }

      // ── Step 4: Set Hard Period Lock ──
      await PeriodLock.findOneAndUpdate(
        { firmId: firmIdObj, financialYear },
        {
          $set: {
            lockDate: fyEndDate,
            isActive: true,
            closingStatus: 'CLOSED',
            closedAt: new Date(),
            closedBy: closedBy,
            reason: `Year-End Close executed by ${closedBy}`,
            lockedBy: closedBy,
          },
        },
        { session }
      );

      await session.commitTransaction();

      return {
        success: true,
        financialYear,
        closingVoucherNo,
        netProfit: Math.abs(netProfit),
        profitType: netProfit >= 0 ? 'PROFIT' : 'LOSS',
        openingBalancesGenerated: obCount,
        lockDate: fyEndDate,
      };
    } catch (err) {
      await session.abortTransaction();

      // Reset closingStatus back to NOT_CLOSED on failure
      await PeriodLock.findOneAndUpdate(
        { firmId: firmIdObj, financialYear, closingStatus: 'IN_PROGRESS' },
        { $set: { closingStatus: 'NOT_CLOSED' } }
      );

      throw err;
    } finally {
      session.endSession();
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // INTERNAL — Date Helpers
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Parses a financial year string (e.g. '2025-26') into start/end dates.
   * Indian FY: April 1 to March 31.
   */
  private static getFYDates(fy: string) {
    const parts = fy.split('-');
    const startYear = parseInt(parts[0] || '', 10);

    if (isNaN(startYear)) {
      throw new Error(`Invalid financial year format: "${fy}". Expected format: 2025-26`);
    }

    const endYear = startYear + 1;

    return {
      fyStartDate: `${startYear}-04-01`,
      fyEndDate: `${endYear}-03-31`,
      nextFyStartDate: `${endYear}-04-01`,
      nextFY: `${endYear}-${String(endYear + 1).slice(-2)}`,
    };
  }
}
