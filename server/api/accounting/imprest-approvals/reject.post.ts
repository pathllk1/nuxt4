import mongoose from 'mongoose';
import { requireAuthSession } from '../../../utils/auth';
import User from '../../../models/User';
import SiteExpenseClaim from '../../../models/SiteExpenseClaim';

/**
 * POST /api/accounting/imprest-approvals/reject
 * Maker-Checker Rejection Endpoint:
 * Rejects one or more pending site expense claims with an audit reason.
 * Does NOT post to the General Ledger.
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
      statusMessage: 'Forbidden: Maker-Checker rejection requires Manager, Admin, or Owner privilege'
    });
  }

  const body = await readBody(event) || {};
  const { claimIds, rejectionReason = 'Rejected by checker' } = body;

  if (!claimIds || !Array.isArray(claimIds) || claimIds.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'claimIds array is required and must not be empty'
    });
  }

  const validIds = claimIds
    .filter((id: string) => mongoose.Types.ObjectId.isValid(id))
    .map((id: string) => new mongoose.Types.ObjectId(id));

  if (validIds.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'No valid claim IDs provided'
    });
  }

  const reviewerName = userDoc.name || authSession.username || authSession.email || 'Checker';

  const updateResult = await SiteExpenseClaim.updateMany(
    {
      _id: { $in: validIds },
      firmId: firmIdObj,
      status: 'PENDING'
    },
    {
      $set: {
        status: 'REJECTED',
        rejectionReason: String(rejectionReason).trim() || 'Rejected by checker',
        reviewedBy: reviewerName,
        reviewedAt: new Date()
      }
    }
  );

  return {
    success: true,
    message: `Rejected ${updateResult.modifiedCount} claim(s)`,
    data: {
      rejectedCount: updateResult.modifiedCount
    }
  };
});
