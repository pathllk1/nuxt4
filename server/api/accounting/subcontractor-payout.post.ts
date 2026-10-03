import { defineEventHandler, createError, readBody } from 'h3';
import mongoose from 'mongoose';
import User from '../../models/User';
import BankAccount from '../../models/BankAccount';
import { UnifiedPostingService } from '../../utils/accounting/unified-posting.service';
import { TdsCalculator } from '../../utils/accounting/tds-calculator';
import { type IVoucherLeg } from '../../types/accounting';

export default defineEventHandler(async (event) => {
  try {
    const currentUserId = event.context.user?.id;
    if (!currentUserId) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized'
      });
    }

    const body = await readBody(event) || {};
    const {
      firmId,
      subcontractorUserId,
      amount,
      tdsMode = 'DEDUCT', // 'DEDUCT' | 'GROSS_UP' | 'NONE'
      ratePercent,
      paymentMode = 'BANK',
      bankAccountId,
      paymentDate,
      narration,
      projectId
    } = body;

    if (!firmId || !subcontractorUserId || !amount || Number(amount) <= 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Firm ID, Subcontractor ID, and a positive amount are required'
      });
    }

    // 1. Authorize current user in this firm (Owner, Admin, Manager or Superadmin)
    const currentUser = await User.findById(currentUserId);
    const currentAssignment = currentUser?.firms.find(f => f.firm.toString() === firmId);
    const currentGrade = currentAssignment?.grade;
    const isAuthorized = currentUser?.role === 'superadmin' || ['Owner', 'Admin', 'Manager'].includes(currentGrade || '');

    if (!isAuthorized) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Insufficient permissions: Owner, Admin, or Manager privileges required'
      });
    }

    // 2. Fetch Subcontractor and verify linked COA Direct Expense head
    const subconUser = await User.findById(subcontractorUserId);
    if (!subconUser) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Subcontractor user not found'
      });
    }

    const subconAssignment = subconUser.firms.find(f => f.firm.toString() === firmId);
    if (!subconAssignment || subconAssignment.grade !== 'Subcontractor') {
      throw createError({
        statusCode: 400,
        statusMessage: 'User is not assigned as a Subcontractor in this firm'
      });
    }

    const expenseHead = subconAssignment.linkedLedgerHead;
    if (!expenseHead) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Subcontractor does not have an active Direct Expense head in Chart of Accounts'
      });
    }

    // 3. Evaluate TDS Rate u/s 194C
    let effectiveRate = Number(ratePercent);
    if (isNaN(effectiveRate) || effectiveRate < 0) {
      const panValidation = TdsCalculator.validatePan(subconAssignment.panNumber);
      effectiveRate = panValidation.default194CRate; // 1% Individual/HUF, 2% Co/Firm, 20% Missing
    }

    const isGrossUp = tdsMode === 'GROSS_UP';
    const hasTds = tdsMode !== 'NONE' && effectiveRate > 0;

    const numAmount = Number(amount);
    const tdsComputation = hasTds 
      ? TdsCalculator.computeTds({
          netAmount: numAmount,
          ratePercent: effectiveRate,
          isGrossUp
        })
      : {
          netPayout: numAmount,
          grossAmount: numAmount,
          tdsAmount: 0,
          effectiveRate: 0,
          isGrossUp: false,
          catchUpTds: 0,
          regularTds: 0,
          formulaDescription: 'No TDS applied'
        };

    // 4. Resolve Payout Account (Bank or Cash)
    const firmIdObj = new mongoose.Types.ObjectId(firmId);
    let paymentPostAccountHead = 'Cash in Hand';
    let paymentPostAccountType: 'CASH' | 'BANK' = 'CASH';
    let mongoBankAccountId: mongoose.Types.ObjectId | null = null;

    if (paymentMode !== 'CASH') {
      if (!bankAccountId) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Bank account is required for non-cash payment modes'
        });
      }
      const bankAccount = await BankAccount.findOne({
        _id: bankAccountId,
        $or: [{ firm_id: firmId }, { firmId }, { firm_id: firmIdObj }, { firmId: firmIdObj }]
      });
      if (!bankAccount) {
        throw createError({
          statusCode: 404,
          statusMessage: 'Selected Bank Account not found in this firm'
        });
      }
      paymentPostAccountHead = bankAccount.account_name;
      paymentPostAccountType = 'BANK';
      mongoBankAccountId = new mongoose.Types.ObjectId(String(bankAccountId));
    }

    // 5. Construct Balanced Double-Entry Voucher Legs
    const transactionDate = paymentDate || (new Date().toISOString().split('T')[0] as string);
    const legs: IVoucherLeg[] = [];

    // Leg 1: Debit Subcontractor Direct Expense (Gross Amount)
    legs.push({
      accountHead: expenseHead,
      accountType: 'DIRECT_EXPENSE',
      debitAmount: tdsComputation.grossAmount,
      creditAmount: 0,
      narration: `Subcontract payout to ${subconUser.name}${hasTds ? ` (TDS u/s 194C @ ${effectiveRate}%${isGrossUp ? ' Gross-Up' : ''})` : ''}`
    });

    // Leg 2: Credit TDS Payable Liability (if TDS > 0)
    if (tdsComputation.tdsAmount > 0) {
      legs.push({
        accountHead: 'TDS Payable u/s 194C',
        accountType: 'LIABILITY',
        debitAmount: 0,
        creditAmount: tdsComputation.tdsAmount,
        narration: `TDS 194C withheld on payout to ${subconUser.name} (${effectiveRate}%)`
      });
    }

    // Leg 3: Credit Bank / Cash (Net payout disbursed)
    legs.push({
      accountHead: paymentPostAccountHead,
      accountType: paymentPostAccountType,
      debitAmount: 0,
      creditAmount: tdsComputation.netPayout,
      bankAccountId: mongoBankAccountId,
      paymentMode,
      narration: `Payout disbursed to ${subconUser.name} via ${paymentMode}`
    });

    // 6. Post Transaction via UnifiedPostingService with Mongo Session
    const session = await mongoose.startSession();
    session.startTransaction();

    let postResult;
    try {
      postResult = await UnifiedPostingService.postVoucher({
        firmId: firmIdObj,
        voucherType: 'PAYMENT',
        transactionDate,
        narration: narration || `Subcontractor Payout - ${subconUser.name} (${paymentMode})`,
        legs,
        createdBy: currentUserId,
        refType: 'PAYMENT',
        tags: {
          subcontractorUserId: subconUser._id.toString(),
          subcontractorName: subconUser.name,
          panNumber: subconAssignment.panNumber || '',
          tdsMode,
          tdsRate: effectiveRate,
          tdsAmount: tdsComputation.tdsAmount,
          grossAmount: tdsComputation.grossAmount,
          netPayout: tdsComputation.netPayout,
          projectId: projectId || ''
        }
      }, session);

      await session.commitTransaction();
    } catch (postError) {
      await session.abortTransaction();
      throw postError;
    } finally {
      session.endSession();
    }

    return {
      success: true,
      statusCode: 201,
      message: 'Subcontractor payout posted successfully',
      data: {
        voucherGroupId: postResult.voucherGroupId,
        voucherNo: postResult.voucherNo,
        subcontractorName: subconUser.name,
        expenseHead,
        grossAmount: tdsComputation.grossAmount,
        tdsAmount: tdsComputation.tdsAmount,
        netPayout: tdsComputation.netPayout,
        effectiveRate,
        formulaDescription: tdsComputation.formulaDescription
      }
    };
  } catch (error: any) {
    console.error('Subcontractor payout error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Failed to process subcontractor payout'
    });
  }
});
