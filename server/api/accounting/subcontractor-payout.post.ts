import { defineEventHandler, createError, readBody } from 'h3';
import mongoose from 'mongoose';
import User from '../../models/User';
import Ledger from '../../models/Ledger';
import ChartOfAccounts from '../../models/ChartOfAccounts';
import TdsExemptionCertificate from '../../models/TdsExemptionCertificate';
import { UnifiedPostingService } from '../../utils/accounting/unified-posting.service';
import { TdsCalculator } from '../../utils/accounting/tds-calculator';
import { requireAuthSession } from '../../utils/auth';
import { getFinancialYearFromDate } from '../../utils/accounting/period-lock.service';
import { resolveVoucherLiquidityAccount } from '../../utils/accounting/voucher-liquidity-account';
import { type IVoucherLeg } from '../../types/accounting';
import { connectDB } from '../../plugins/mongodb';

const isUuid = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export default defineEventHandler(async (event) => {
  try {
    const auth = await requireAuthSession(event);
    const body = await readBody(event) || {};
    const {
      firmId,
      subcontractorUserId,
      amount,
      tdsMode,
      ratePercent,
      paymentMode,
      bankAccountId,
      paymentDate,
      narration,
      projectId,
      idempotencyKey
    } = body;

    if (String(firmId || '') !== String(auth.firm_id)) {
      throw createError({ statusCode: 403, statusMessage: 'Payout firm must match the authenticated firm.' });
    }
    if (!mongoose.Types.ObjectId.isValid(String(subcontractorUserId))) {
      throw createError({ statusCode: 400, statusMessage: 'A valid subcontractor user ID is required.' });
    }
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0 || !isUuid(idempotencyKey)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'A positive amount and UUID idempotency key are required.'
      });
    }
    const validDate = typeof paymentDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(paymentDate)
      ? new Date(`${paymentDate}T00:00:00.000Z`)
      : null;
    if (!validDate || Number.isNaN(validDate.getTime()) || validDate.toISOString().slice(0, 10) !== paymentDate) {
      throw createError({ statusCode: 400, statusMessage: 'A valid payment date in YYYY-MM-DD format is required.' });
    }
    getFinancialYearFromDate(paymentDate);
    if (!['DEDUCT', 'GROSS_UP', 'NONE'].includes(tdsMode)) {
      throw createError({ statusCode: 400, statusMessage: 'A supported TDS mode is required.' });
    }
    if (!['BANK', 'UPI', 'CHEQUE', 'CASH', 'NEFT', 'RTGS'].includes(paymentMode)) {
      throw createError({ statusCode: 400, statusMessage: 'A supported payment mode is required.' });
    }

    await connectDB();

    // 1. Authorize current user in this firm (Owner, Admin, Manager or Superadmin)
    const currentUser = await User.findById(auth._id).lean();
    const currentAssignment = currentUser?.firms?.find((f: any) => String(f.firm?._id || f.firm) === String(auth.firm_id));
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

    const subconAssignment = subconUser.firms?.find((f: any) => String(f.firm?._id || f.firm) === String(auth.firm_id));
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

    const firmIdObj = new mongoose.Types.ObjectId(String(auth.firm_id));
    const expenseAccounts = await ChartOfAccounts.find({
      account_name: expenseHead,
      account_type: 'DIRECT_EXPENSE',
      is_active: true,
      $or: [{ firm_id: firmIdObj }, { firmId: firmIdObj }]
    }, '_id').lean();
    if (expenseAccounts.length !== 1) {
      throw createError({ statusCode: 409, statusMessage: 'Subcontractor expense head is not uniquely active in the authenticated firm.' });
    }

    // 3. Evaluate statutory TDS rate; caller-supplied rates require a matching active certificate.
    const panValidation = TdsCalculator.validatePan(subconAssignment.panNumber);
    if (tdsMode !== 'NONE' && (typeof ratePercent !== 'number' || !Number.isFinite(ratePercent) || ratePercent < 0 || ratePercent > 20)) {
      throw createError({ statusCode: 400, statusMessage: 'A valid statutory TDS rate is required.' });
    }
    let effectiveRate = tdsMode === 'NONE' ? 0 : panValidation.default194CRate;
    let certificateNumber: string | null = null;
    if (tdsMode !== 'NONE' && ratePercent !== effectiveRate) {
      if (!panValidation.isValid || ratePercent >= effectiveRate) {
        throw createError({ statusCode: 400, statusMessage: `TDS rate ${ratePercent}% is not permitted for this deductee.` });
      }
      const certificates = await TdsExemptionCertificate.find({
        firmId: firmIdObj,
        pan: panValidation.pan,
        section: '194C',
        status: 'ACTIVE',
        validFrom: { $lte: paymentDate },
        validTo: { $gte: paymentDate }
      }).lean();
      if (certificates.length !== 1 || Number(certificates[0]!.permittedRate) !== ratePercent) {
        throw createError({ statusCode: 400, statusMessage: 'Rate override requires exactly one active firm-scoped Section 194C certificate with the same permitted rate.' });
      }
      effectiveRate = ratePercent;
      certificateNumber = certificates[0]!.certificateNumber;
    }

    const isGrossUp = tdsMode === 'GROSS_UP';
    const hasTds = tdsMode !== 'NONE' && effectiveRate > 0;
    const tdsComputation = hasTds 
      ? TdsCalculator.computeTds({
          netAmount: amount,
          ratePercent: effectiveRate,
          isGrossUp,
          catchUpBaseAmount: 0
        })
      : {
          netPayout: amount,
          grossAmount: amount,
          tdsAmount: 0,
          effectiveRate: 0,
          isGrossUp: false,
          catchUpTds: 0,
          regularTds: 0,
          formulaDescription: 'No TDS applied'
        };

    // 4. Resolve Payout Account (Bank or Cash)
    if (paymentMode !== 'CASH' && !bankAccountId) {
      throw createError({ statusCode: 400, statusMessage: 'Bank account is required for non-cash payment modes.' });
    }
    if (paymentMode === 'CASH' && bankAccountId) {
      throw createError({ statusCode: 400, statusMessage: 'Cash payments must not include a bank account ID.' });
    }
    const liquidityAccount = await resolveVoucherLiquidityAccount(
      paymentMode === 'CASH' ? 'Cash in Hand' : bankAccountId,
      firmIdObj
    );
    if (!liquidityAccount) {
      throw createError({ statusCode: 400, statusMessage: 'A resolved cash or bank account is required.' });
    }

    // 4. Require source history to be absent until this route can verify a complete linked register.
    const [fyStartYear] = getFinancialYearFromDate(paymentDate).split('-');
    const fyStartDate = `${fyStartYear}-04-01`;
    const priorPayments = await Ledger.find({
      $or: [{ firmId: firmIdObj }, { firm_id: firmIdObj }],
      accountHead: expenseHead,
      accountType: 'DIRECT_EXPENSE',
      transactionDate: { $gte: fyStartDate, $lte: paymentDate },
      debitAmount: { $gt: 0 },
      isReversed: { $ne: true },
      voucherGroupId: { $ne: `SUBCON-${String(firmIdObj)}-${idempotencyKey}` }
    }, 'debitAmount voucherGroupId transactionDate').lean();
    if (priorPayments.length > 0) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Prior subcontractor payment history is present but this payout route cannot verify its complete source-to-TDS linkage. Use the authoritative TDS threshold workflow; no voucher was posted.'
      });
    }
    const taxableCurrentAmount = tdsComputation.grossAmount;
    const threshold = TdsCalculator.check194CThreshold(0, taxableCurrentAmount, 0);
    if (tdsMode === 'NONE' && threshold.isThresholdBreached) {
      throw createError({ statusCode: 409, statusMessage: 'Section 194C requires deduction for this payment amount; No TDS is not permitted.' });
    }
    if (tdsMode !== 'NONE' && !threshold.isThresholdBreached && tdsComputation.tdsAmount > 0) {
      throw createError({ statusCode: 409, statusMessage: 'Section 194C threshold is not met for this payment. Select No TDS; no voucher was posted.' });
    }

    const transactionDate = paymentDate;
    const externalVoucherGroupId = `SUBCON-${String(firmIdObj)}-${idempotencyKey}`;
    const sourcePaymentRef = `SUBCONTRACTOR-${String(firmIdObj)}-${idempotencyKey}`;
    const legs: IVoucherLeg[] = [];

    // Leg 1: Debit Subcontractor Direct Expense (Gross Amount)
    legs.push({
      accountHead: expenseHead,
      accountType: 'DIRECT_EXPENSE',
      debitAmount: tdsComputation.grossAmount,
      creditAmount: 0,
      narration: `Subcontract payout to ${subconUser.name}${hasTds ? ` (TDS u/s 194C @ ${effectiveRate}%${isGrossUp ? ' Gross-Up' : ''})` : ''}`,
      sourcePaymentRef
    });

    // Statutory TDS snapshot for canonical register tracking (F-04)
    // ONLY set if TDS is actually withheld (> 0) and populate taxableAmount explicitly!
    const statutorySnapshot = tdsComputation.tdsAmount > 0 ? {
      isTds: true,
      tdsSection: '194C',
      tdsRate: effectiveRate,
      isGrossUp: isGrossUp,
      grossAmount: tdsComputation.grossAmount,
      taxableAmount: tdsComputation.grossAmount, // Canonical taxable base (F-04)
      netAmount: tdsComputation.netPayout,
      tdsAmount: tdsComputation.tdsAmount,
      pan: panValidation.pan,
      deducteeName: subconUser.name,
      deducteeId: String(subconUser._id),
      deducteeType: 'SUBCONTRACTOR',
      sourcePaymentRef,
      certificateNumber,
      isExempt: certificateNumber !== null,
      exemptionReason: certificateNumber ? 'Active Section 194C certificate rate override' : null
    } : undefined;

    // Leg 2: Credit TDS Payable Liability (if TDS > 0)
    if (tdsComputation.tdsAmount > 0) {
      legs.push({
        accountHead: 'TDS Payable u/s 194C',
        accountType: 'DUTIES_AND_TAXES',
        debitAmount: 0,
        creditAmount: tdsComputation.tdsAmount,
        narration: `TDS 194C withheld on payout to ${subconUser.name} (${effectiveRate}%${isGrossUp ? ' Gross-Up' : ''})`,
        statutory: statutorySnapshot,
        sourcePaymentRef
      });
    }

    // Leg 3: Credit Bank / Cash (Net payout disbursed)
    legs.push({
      accountHead: liquidityAccount.accountHead,
      accountType: liquidityAccount.accountType,
      debitAmount: 0,
      creditAmount: tdsComputation.netPayout,
      bankAccountId: liquidityAccount.bankAccountId,
      paymentMode,
      narration: `Payout disbursed to ${subconUser.name} via ${paymentMode}`,
      sourcePaymentRef
    });

    // 6. Post Transaction via UnifiedPostingService with Mongo Session
    const executePost = async (session?: mongoose.ClientSession) => {
      return await UnifiedPostingService.postVoucher({
        firmId: firmIdObj,
        voucherType: 'PAYMENT',
        transactionDate,
        narration: narration || `Subcontractor Payout - ${subconUser.name} (${paymentMode})`,
        legs,
        createdBy: String(auth._id),
        externalVoucherGroupId,
        refType: 'PAYMENT',
        tags: {
          subcontractorUserId: subconUser._id.toString(),
          subcontractorName: subconUser.name,
          panNumber: panValidation.pan,
          tdsMode,
          tdsRate: effectiveRate,
          tdsAmount: tdsComputation.tdsAmount,
          grossAmount: tdsComputation.grossAmount,
          netPayout: tdsComputation.netPayout,
          projectId: projectId || '',
          statutory: statutorySnapshot
        }
      }, session);
    };

    let postResult: any;
    let session: mongoose.ClientSession | null = null;
    try {
      session = await mongoose.connection.startSession();
      session.startTransaction();
      postResult = await executePost(session);
      await session.commitTransaction();
    } catch (postError: any) {
      if (session?.inTransaction()) {
        try {
          await session.abortTransaction();
        } catch (abortError: any) {
          throw createError({
            statusCode: 500,
            statusMessage: `Subcontractor payout failed (${postError.message}); transaction abort also failed (${abortError.message}).`
          });
        }
      }
      throw postError;
    } finally {
      if (session) await session.endSession();
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
