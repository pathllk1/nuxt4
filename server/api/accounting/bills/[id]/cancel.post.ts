import mongoose from 'mongoose';
import Bill from '../../../../models/Bill';
import Ledger from '../../../../models/Ledger';
import { requireAuthSession } from '../../../../utils/auth';

export default defineEventHandler(async (event) => {
  const user = await requireAuthSession(event);
  const id = getRouterParam(event, 'id');
  const body = await readBody(event) || {};

  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid bill ID' });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const bill = await Bill.findOne({
      _id: id,
      firmId: new mongoose.Types.ObjectId(user.firm_id as string)
    }).session(session);

    if (!bill) {
      throw createError({ statusCode: 404, statusMessage: 'Bill not found' });
    }

    if (bill.status === 'CANCELLED') {
      throw createError({ statusCode: 400, statusMessage: 'Bill is already cancelled' });
    }

    bill.status = 'CANCELLED';
    bill.cancellationReason = body.reason || 'Cancelled by user';
    bill.cancelledAt = new Date();
    bill.cancelledBy = new mongoose.Types.ObjectId(user._id as string);

    await bill.save({ session });

    // Reverse ledger entries by deleting or neutralizing
    await Ledger.deleteMany({
      firmId: new mongoose.Types.ObjectId(user.firm_id as string),
      refType: 'BILL',
      refId: bill._id
    }, { session });

    await session.commitTransaction();
    session.endSession();

    return {
      success: true,
      message: `Bill ${bill.bno} cancelled successfully`,
      data: bill
    };
  } catch (err: any) {
    await session.abortTransaction();
    session.endSession();
    throw createError({ statusCode: err.statusCode || 500, statusMessage: err.message });
  }
});
