import mongoose from 'mongoose';
import Advance from '../../models/Advance';
import { deleteAdvanceLedger } from '../../utils/advance-ledger-helper';
import { requireAuthSession } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  const user = await requireAuthSession(event);
  const id = getRouterParam(event, 'id');
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const record = await Advance.findOne({ _id: id, firm_id: user.firm_id }).session(session);
    if (!record) throw new Error('Record not found');

    if (record.payment_mode === 'WAGE_DEDUCTION' && record.wage_id) {
      throw new Error('Cannot delete a wage deduction repayment from here');
    }

    await deleteAdvanceLedger(record._id as mongoose.Types.ObjectId, user.firm_id, session);
    await record.deleteOne({ session });

    await session.commitTransaction();
    return { message: 'Advance record deleted' };
  } catch (err: any) {
    await session.abortTransaction();
    throw createError({
      statusCode: 500,
      message: err.message
    });
  } finally {
    session.endSession();
  }
});
