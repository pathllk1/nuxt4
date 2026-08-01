import Wage from '../../models/Wage';
import { requireAuthSession } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  const user = await requireAuthSession(event);
  const query = getQuery(event);
  const month = query.month as string;

  if (!month) {
    throw createError({
      statusCode: 400,
      message: 'Month query parameter is required'
    });
  }

  const wages = await Wage.find({
    firm_id: user.firm_id,
    salary_month: month
  })
    .populate('master_roll_id', 'employee_name aadhar bank account_no project site')
    .sort({ createdAt: -1 })
    .lean();

  return { success: true, data: wages };
});
