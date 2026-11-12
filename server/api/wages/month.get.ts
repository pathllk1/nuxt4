import Wage from '../../models/Wage';
import Advance from '../../models/Advance';
import { requireAuthSession } from '../../utils/auth';
import { requireWageRole } from '../../utils/wage-authz';

export default defineEventHandler(async (event) => {
  const user = await requireAuthSession(event);
  // Bug (report B7): Staff removed — this endpoint populates Aadhar and bank
  // account details, which shouldn't be visible at Staff grade. If Staff
  // genuinely need to see wage records without the PII, the better fix is a
  // separate populate string rather than widening the role list back out.
  await requireWageRole(event, user, ['Owner', 'Admin', 'Manager']);

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
    .populate('master_roll_id', 'employee_name aadhar bank account_no project site date_of_joining date_of_exit')
    .sort({ createdAt: -1 })
    .lean();

  // Aggregate current advance balances for all employees in this batch
  const masterRollIds = wages
    .map(w => (w.master_roll_id as any)?._id || w.master_roll_id)
    .filter(Boolean);

  const advances = await Advance.find({
    firm_id: user.firm_id,
    master_roll_id: { $in: masterRollIds }
  }).lean();

  const advanceBalances: Record<string, number> = {};
  advances.forEach((a: any) => {
    if (!a.master_roll_id) return;
    const empId = a.master_roll_id.toString();
    if (!advanceBalances[empId]) advanceBalances[empId] = 0;
    if (a.type === 'ADVANCE') {
      advanceBalances[empId] += (a.amount || 0);
    } else if (a.type === 'REPAYMENT') {
      advanceBalances[empId] -= (a.amount || 0);
    }
  });

  const enrichedWages = wages.map((w: any) => {
    const empId = (w.master_roll_id?._id || w.master_roll_id)?.toString();
    return {
      ...w,
      advance_balance: advanceBalances[empId] || 0
    };
  });

  return { success: true, data: enrichedWages };
});