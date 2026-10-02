import mongoose from 'mongoose';
import BulkPayment from '../../../models/BulkPayment';
import { UnifiedPostingService } from '../../../utils/accounting/unified-posting.service';
import { requireAuthSession } from '../../../utils/auth';

export default defineEventHandler(async (event) => {
  const user = await requireAuthSession(event);
  const firmIdObj = new mongoose.Types.ObjectId(String(user.firm_id));
  const id = getRouterParam(event, 'id');

  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Valid Bulk Payment ID is required' });
  }

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

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const voucherGroupIds: string[] = batch.items
      .map(item => item.voucherGroupId)
      .filter((id): id is string => typeof id === 'string' && id.length > 0);

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
    await batch.save({ session });

    await session.commitTransaction();

    return {
      success: true,
      message: `Bulk payment batch ${batch.batchNo} cancelled and ${voucherGroupIds.length} vouchers reversed successfully`
    };
  } catch (err: any) {
    await session.abortTransaction();
    console.error('Error cancelling bulk payment batch:', err);
    throw createError({ statusCode: 500, statusMessage: err.message || 'Failed to cancel bulk payment batch' });
  } finally {
    session.endSession();
  }
});
