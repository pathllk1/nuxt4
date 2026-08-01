import mongoose from 'mongoose';
import Advance from '../../../models/Advance';
import { requireAuthSession } from '../../../utils/auth';

export default defineEventHandler(async (event) => {
  const user = await requireAuthSession(event);
  const masterRollId = getRouterParam(event, 'masterRollId');

  try {
    const balResult = await Advance.aggregate([
      {
        $match: {
          firm_id: new mongoose.Types.ObjectId(user.firm_id as string),
          master_roll_id: new mongoose.Types.ObjectId(masterRollId)
        }
      },
      {
        $group: {
          _id: '$master_roll_id',
          totalAdvance: {
            $sum: { $cond: [{ $eq: ['$type', 'ADVANCE'] }, '$amount', 0] }
          },
          totalRecovery: {
            $sum: { $cond: [{ $eq: ['$type', 'REPAYMENT'] }, '$amount', 0] }
          },
          balance: {
            $sum: { $cond: [{ $eq: ['$type', 'ADVANCE'] }, '$amount', { $subtract: [0, '$amount'] }] }
          }
        }
      }
    ]);

    const data = balResult.length > 0 ? balResult[0] : { totalAdvance: 0, totalRecovery: 0, balance: 0 };
    return { success: true, data };
  } catch (err: any) {
    throw createError({
      statusCode: 500,
      message: err.message
    });
  }
});
