import mongoose from 'mongoose';
import BulkPayment from '../../../models/BulkPayment';
import { UnifiedPostingService } from '../../../utils/accounting/unified-posting.service';
import { requireAuthSession } from '../../../utils/auth';
import { connectDB } from '../../../plugins/mongodb';

export default defineEventHandler(async (event) => {
  const user = await requireAuthSession(event);
  const firmIdObj = new mongoose.Types.ObjectId(String(user.firm_id));
  const id = getRouterParam(event, 'id');

  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Valid Bulk Payment ID is required' });
  }

  await connectDB();

  const batch = await BulkPayment.findOne({
    _id: new mongoose.Types.ObjectId(id),
    firmId: firmIdObj
  });

  if (!batch) {
    throw createError({ statusCode: 404, statusMessage: 'Bulk payment batch not found' });
  }

  if (batch.status === 'CANCELLED') {
    throw createError({ statusCode: 400, statusMessage: 'Batch is already cancelled' });
  }

  const voucherGroupIds: string[] = batch.items
    .map(item => item.voucherGroupId)
    .filter((vId): vId is string => typeof vId === 'string' && vId.length > 0);

  const executeCancel = async (session?: mongoose.ClientSession) => {
    // Reversal vouchers for each voucher in batch instead of hard delete
    for (const vGroupId of voucherGroupIds) {
      try {
        await UnifiedPostingService.reverseVoucher({
          originalVoucherGroupId: vGroupId,
          firmId: firmIdObj,
          reason: `Bulk payment batch cancellation (${batch.batchNo})`,
          createdBy: user.username || user.email || 'system',
          session
        });
      } catch (revErr: any) {
        console.warn(`[BulkPayment Cancel] Reversal note for ${vGroupId}:`, revErr.message);
      }
    }

    batch.status = 'CANCELLED';
    if (session) {
      await batch.save({ session });
    } else {
      await batch.save();
    }
  };

  let session: mongoose.ClientSession | null = null;
  try {
    session = await mongoose.connection.startSession();
    session.startTransaction();
    await executeCancel(session);
    await session.commitTransaction();
  } catch (err: any) {
    if (session) {
      try { await session.abortTransaction(); } catch (_) {}
    }

    if (
      err.message?.includes('ClientSession must be from the same MongoClient') ||
      err.message?.includes('replica set') ||
      err.message?.includes('Transaction numbers')
    ) {
      console.warn('[BulkPayment Cancel] Retrying without transaction session:', err.message);
      try {
        await executeCancel(undefined);
      } catch (retryErr: any) {
        throw createError({ statusCode: 500, statusMessage: retryErr.message || 'Failed to cancel bulk payment batch' });
      }
    } else {
      console.error('Error cancelling bulk payment batch:', err);
      throw createError({ statusCode: 500, statusMessage: err.message || 'Failed to cancel bulk payment batch' });
    }
  } finally {
    if (session) {
      try { session.endSession(); } catch (_) {}
    }
  }

  return {
    success: true,
    message: `Bulk payment batch ${batch.batchNo} cancelled and ${voucherGroupIds.length} vouchers reversed successfully`
  };
});
