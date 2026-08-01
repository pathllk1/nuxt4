import mongoose from 'mongoose';
import Wage from '../../models/Wage';
import Advance from '../../models/Advance';
import { deleteWageLedger } from '../../utils/wages-ledger-helper';
import { requireAuthSession } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  const user = await requireAuthSession(event);
  const id = getRouterParam(event, 'id');

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const wage = await Wage.findOne({ _id: id, firm_id: user.firm_id }).session(session);
    if (!wage) {
      await session.abortTransaction();
      throw createError({
        statusCode: 404,
        message: 'Wage not found'
      });
    }

    if (wage.status === 'LOCKED') {
      await session.abortTransaction();
      throw createError({
        statusCode: 403,
        message: 'Cannot delete locked wage'
      });
    }

    await deleteWageLedger(wage._id as mongoose.Types.ObjectId, user.firm_id, session);
    await Advance.deleteMany({ wage_id: wage._id }).session(session);
    await wage.deleteOne({ session });

    await session.commitTransaction();
    return { message: 'Wage deleted' };
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
