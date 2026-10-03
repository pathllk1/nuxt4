import { defineEventHandler, createError } from 'h3';
import mongoose from 'mongoose';
import { requireAuthSession } from '../../../utils/auth';
import SubcontractorExpense from '../../../models/SubcontractorExpense';
import User from '../../../models/User';

/**
 * DELETE /api/subcontractor/expenses/:id
 * Subcontractor deletes an existing site slip from his wallet.
 * ZERO impact on Core General Ledger!
 */
export default defineEventHandler(async (event) => {
  const authSession = await requireAuthSession(event);
  const firmIdObj = new mongoose.Types.ObjectId(String(authSession.firm_id));
  const userIdObj = new mongoose.Types.ObjectId(String(authSession._id));

  const id = event.context.params?.id;
  if (!id || !mongoose.Types.ObjectId.isValid(String(id))) {
    throw createError({ statusCode: 400, statusMessage: 'Valid Slip ID is required' });
  }

  const slip = await SubcontractorExpense.findOne({
    _id: new mongoose.Types.ObjectId(String(id)),
    firmId: firmIdObj
  });

  if (!slip) {
    throw createError({ statusCode: 404, statusMessage: 'Site slip not found' });
  }

  const isOwner = slip.subcontractorUserId.toString() === userIdObj.toString();
  let isAdmin = false;
  if (!isOwner) {
    const currentUser = await User.findById(userIdObj).lean() as any;
    const currentAssignment = (currentUser?.firms || []).find((f: any) =>
      String(f.firm?._id || f.firm) === String(firmIdObj)
    );
    isAdmin = currentUser?.role === 'superadmin' || ['Owner', 'Admin'].includes(currentAssignment?.grade || '');
  }

  if (!isOwner && !isAdmin) {
    throw createError({ statusCode: 403, statusMessage: 'You are not authorized to delete this slip' });
  }

  await SubcontractorExpense.deleteOne({ _id: slip._id });

  return {
    success: true,
    message: 'Site slip deleted from your wallet'
  };
});
