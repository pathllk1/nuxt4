import Wage from '../../../models/Wage';
import { requireAuthSession } from '../../../utils/auth';

export default defineEventHandler(async (event) => {
  const user = await requireAuthSession(event);
  const masterRollId = getRouterParam(event, 'masterRollId');

  try {
    const wages = await Wage.find({ 
      firm_id: user.firm_id, 
      master_roll_id: masterRollId 
    })
    .populate('master_roll_id', 'employee_name aadhar bank account_no project site')
    .sort({ salary_month: -1 })
    .lean();

    return { success: true, data: wages };
  } catch (err: any) {
    throw createError({
      statusCode: 500,
      message: err.message
    });
  }
});
