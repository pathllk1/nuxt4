import mongoose from 'mongoose';
import { requireAuthSession } from '../../../utils/auth';
import User from '../../../models/User';
import SiteExpenseClaim from '../../../models/SiteExpenseClaim';
import { UnifiedPostingService } from '../../../utils/accounting/unified-posting.service';

/**
 * POST /api/accounting/imprest-approvals/approve
 * Maker-Checker Approval Endpoint:
 * Batched or single approval of site expense claims.
 * Posts balanced double-entry JOURNAL voucher (Dr Expense, Cr Imprest Account)
 * via UnifiedPostingService within a strict database transaction.
 */
export default defineEventHandler(async (event) => {
  const authSession = await requireAuthSession(event);
  const firmIdObj = new mongoose.Types.ObjectId(String(authSession.firm_id));
  const userIdObj = new mongoose.Types.ObjectId(String(authSession._id));

  // Role validation
  const userDoc = await User.findById(userIdObj).lean() as any;
  if (!userDoc) {
    throw createError({ statusCode: 401, statusMessage: 'User not found' });
  }

  const firmAssignment = (userDoc.firms || []).find((f: any) =>
    String(f.firm?._id || f.firm) === String(firmIdObj)
  );

  const grade = firmAssignment?.grade || 'Staff';
  if (userDoc.role !== 'superadmin' && !['Owner', 'Admin', 'Manager'].includes(grade)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden: Maker-Checker approval requires Manager, Admin, or Owner privilege'
    });
  }

  const body = await readBody(event) || {};
  const { claimIds, overrides = {} } = body;

  if (!claimIds || !Array.isArray(claimIds) || claimIds.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'claimIds array is required and must not be empty'
    });
  }

  // Filter valid ObjectIds
  const validIds = claimIds
    .filter((id: string) => mongoose.Types.ObjectId.isValid(id))
    .map((id: string) => new mongoose.Types.ObjectId(id));

  if (validIds.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'No valid claim IDs provided'
    });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Find pending claims strictly belonging to this firm
    const claims = await SiteExpenseClaim.find({
      _id: { $in: validIds },
      firmId: firmIdObj,
      status: 'PENDING'
    }).session(session);

    if (claims.length === 0) {
      throw createError({
        statusCode: 404,
        statusMessage: 'No pending claims found matching the provided IDs'
      });
    }

    const reviewerName = userDoc.name || authSession.username || authSession.email || 'Checker';
    const approvedResults: Array<{ claimId: string; voucherNo: string; voucherGroupId: string }> = [];

    for (const claim of claims) {
      const claimIdStr = claim._id.toString();
      const override = overrides[claimIdStr] || {};
      const targetHead = (override.targetAccountHead || claim.targetAccountHead).trim();
      const imprestHead = claim.imprestAccountHead.trim();

      if (!targetHead) {
        throw createError({
          statusCode: 400,
          statusMessage: `Claim ${claimIdStr} has no valid target expense account head`
        });
      }

      if (!imprestHead) {
        throw createError({
          statusCode: 400,
          statusMessage: `Claim ${claimIdStr} has no supervisor imprest account head`
        });
      }

      // Build balanced JOURNAL voucher payload
      const postResult = await UnifiedPostingService.postVoucher({
        firmId: firmIdObj,
        voucherType: 'JOURNAL',
        transactionDate: claim.expenseDate,
        referenceNo: `CLAIM-${claimIdStr.slice(-6).toUpperCase()}`,
        narration: `[Site Expense Approval] ${claim.category}: ${claim.narration || ''} (Supervisor: ${claim.supervisorName})${claim.projectId ? ` [Project: ${claim.projectId}]` : ''}`.trim(),
        legs: [
          {
            accountHead: targetHead,
            debitAmount: claim.amount,
            creditAmount: 0,
            narration: claim.narration || `${claim.category} site expense`,
            paymentMode: claim.paymentMode || 'CASH'
          },
          {
            accountHead: imprestHead,
            debitAmount: 0,
            creditAmount: claim.amount,
            narration: `Settlement of ${claim.category} expense by ${claim.supervisorName}`,
            paymentMode: claim.paymentMode || 'CASH'
          }
        ],
        createdBy: reviewerName,
        refType: 'SITE_EXPENSE_CLAIM',
        tags: {
          claimId: claimIdStr,
          supervisorId: claim.supervisorId.toString(),
          projectId: claim.projectId || null,
          category: claim.category
        }
      }, session);

      // Update staging claim
      claim.status = 'APPROVED';
      claim.targetAccountHead = targetHead;
      claim.reviewedBy = reviewerName;
      claim.reviewedAt = new Date();
      claim.generatedVoucherGroupId = postResult.voucherGroupId;

      await claim.save({ session });

      approvedResults.push({
        claimId: claimIdStr,
        voucherNo: postResult.voucherNo,
        voucherGroupId: postResult.voucherGroupId
      });
    }

    await session.commitTransaction();
    session.endSession();

    return {
      success: true,
      message: `Successfully approved and posted ${approvedResults.length} expense claim(s) to General Ledger`,
      data: {
        approvedCount: approvedResults.length,
        results: approvedResults
      }
    };
  } catch (err: any) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
});
