import mongoose from 'mongoose';
import Advance from '../../models/Advance';
import { requireAuthSession } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  const user = await requireAuthSession(event);

  try {
    const balances = await Advance.aggregate([
      { $match: { firm_id: new mongoose.Types.ObjectId(user.firm_id as string) } },
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
      },
      {
        $lookup: {
          from: 'masterrolls',
          localField: '_id',
          foreignField: '_id',
          as: 'employee'
        }
      },
      { $unwind: '$employee' },
      {
        $project: {
          master_roll_id: '$_id',
          employee_name: '$employee.employee_name',
          project: '$employee.project',
          site: '$employee.site',
          totalAdvance: 1,
          totalRecovery: 1,
          balance: 1
        }
      },
      { $sort: { employee_name: 1 } }
    ]);

    return { success: true, data: balances };
  } catch (err: any) {
    throw createError({
      statusCode: 500,
      message: err.message
    });
  }
});
