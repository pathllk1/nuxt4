import Wage from '../../models/Wage';
import { requireAuthSession } from '../../utils/auth';
import { requireWageRole } from '../../utils/wage-authz';
import mongoose from 'mongoose';

export default defineEventHandler(async (event) => {
  const user = await requireAuthSession(event);
  await requireWageRole(event, user, ['Owner', 'Admin', 'Manager']);

  const firmId = typeof user.firm_id === 'string' 
    ? new mongoose.Types.ObjectId(user.firm_id) 
    : user.firm_id;

  // Aggregate processed wage periods for this firm
  const periods = await Wage.aggregate([
    {
      $match: {
        firm_id: firmId,
        salary_month: { $exists: true, $nin: [null, ''] }
      }
    },
    {
      $group: {
        _id: '$salary_month',
        employeeCount: { $sum: 1 },
        totalGross: { $sum: '$gross_salary' },
        totalNet: { $sum: '$net_salary' },
        postedCount: {
          $sum: {
            $cond: [{ $eq: ['$status', 'POSTED'] }, 1, 0]
          }
        },
        draftCount: {
          $sum: {
            $cond: [{ $eq: ['$status', 'DRAFT'] }, 1, 0]
          }
        },
        lastUpdated: { $max: '$updatedAt' }
      }
    },
    {
      $project: {
        _id: 0,
        month: '$_id',
        employeeCount: 1,
        totalGross: 1,
        totalNet: 1,
        postedCount: 1,
        draftCount: 1,
        lastUpdated: 1
      }
    },
    {
      $sort: { month: -1 }
    }
  ]);

  const latestMonth = periods.length > 0 ? periods[0].month : null;

  return {
    success: true,
    data: {
      periods,
      latestMonth,
      totalPeriods: periods.length
    }
  };
});
