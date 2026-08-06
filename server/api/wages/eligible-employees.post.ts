import MasterRoll from '../../models/MasterRoll';
import Wage from '../../models/Wage';
import Advance from '../../models/Advance';
import { requireAuthSession } from '../../utils/auth';
import { requireWageRole } from '../../utils/wage-authz';

const MONTH_REGEX = /^\d{4}-\d{2}$/;

function getMonthEndDate(yearMonth: string) {
  const parts = yearMonth.split('-');
  const year = parts[0] || '2026';
  const month = parts[1] || '01';
  const nextMonth = parseInt(month) === 12 ? '01' : String(parseInt(month) + 1).padStart(2, '0');
  const nextYear  = parseInt(month) === 12 ? String(parseInt(year) + 1) : year;
  const lastDay   = new Date(parseInt(nextYear), parseInt(nextMonth) - 1, 0).getDate();
  return `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
}

function getMonthStartDate(yearMonth: string) {
  return `${yearMonth}-01`;
}

function formatDateString(val: any): string | null {
  if (!val) return null;
  if (val instanceof Date) {
    const s = val.toISOString().split('T')[0];
    return s || null;
  }
  if (typeof val === 'string') {
    const s = val.split('T')[0];
    return s || null;
  }
  return null;
}

function isEmployeeEligible(employee: any, yearMonth: string) {
  const monthStart = getMonthStartDate(yearMonth);
  const monthEnd   = getMonthEndDate(yearMonth);

  const doj = formatDateString(employee.date_of_joining);
  if (doj && doj > monthEnd) return false;

  const doe = formatDateString(employee.date_of_exit);
  if (doe && doe < monthStart) return false;

  return true;
}

export default defineEventHandler(async (event) => {
  const user = await requireAuthSession(event);
  await requireWageRole(event, user, ['Owner', 'Admin', 'Manager']);

  const { month } = await readBody(event);

  if (!month || !MONTH_REGEX.test(month)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid month format. Use YYYY-MM'
    });
  }

  // Bug #15: user.firm_id is already an ObjectId (requireAuthSession constructs
  // it that way) — the previous $in: [user.firm_id, firmIdObj] was matching the
  // same ObjectId against itself twice.
  const employees = await MasterRoll.find({ firm_id: user.firm_id, status: 'Active' })
    .select('employee_name aadhar bank account_no p_day_wage project site date_of_joining date_of_exit')
    .sort({ employee_name: 1 })
    .lean();

  const paidDocs = await Wage.find({ firm_id: user.firm_id, salary_month: month })
    .select('master_roll_id')
    .lean();

  const paidSet = new Set(paidDocs.map(d => d.master_roll_id ? d.master_roll_id.toString() : ''));

  // Fetch all advances for active employees to compute their outstanding balance
  const activeEmpIds = employees.map(e => e._id);
  const advances = await Advance.find({
    firm_id: user.firm_id,
    master_roll_id: { $in: activeEmpIds }
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

  // Bug (N+1 note, mentioned alongside #15): the previous per-employee
  // Wage.findOne lookup for "last wage" ran one query per eligible employee.
  // Batched into a single query + in-memory grouping instead.
  const eligibleCandidates = employees.filter(
    (emp) => isEmployeeEligible(emp, month) && !paidSet.has(emp._id.toString())
  );
  const candidateIds = eligibleCandidates.map(e => e._id);

  const lastWages = await Wage.find({
    master_roll_id: { $in: candidateIds },
    firm_id: user.firm_id,
  })
    .sort({ salary_month: -1 })
    .lean();

  const lastWageByEmployee: Record<string, any> = {};
  for (const w of lastWages) {
    const empId = w.master_roll_id.toString();
    // First one encountered per employee is the most recent, since sorted desc.
    if (!lastWageByEmployee[empId]) {
      lastWageByEmployee[empId] = w;
    }
  }

  const eligibleEmployees = eligibleCandidates.map((emp) => {
    const lastWage = lastWageByEmployee[emp._id.toString()];
    return {
      master_roll_id:   emp._id,
      employee_name:    emp.employee_name,
      aadhar:           emp.aadhar,
      bank:             emp.bank,
      account_no:       emp.account_no,
      p_day_wage:       emp.p_day_wage         ?? 0,
      last_p_day_wage:  lastWage?.p_day_wage   ?? (emp.p_day_wage ?? 0),
      project:          emp.project            ?? '',
      site:             emp.site               ?? '',
      last_wage_days:   lastWage?.wage_days     ?? 26,
      last_gross_salary: lastWage?.gross_salary ?? (emp.p_day_wage ?? 0) * 26,
      date_of_joining:  emp.date_of_joining,
      date_of_exit:     emp.date_of_exit,
      advance_balance:  advanceBalances[emp._id.toString()] || 0,
    };
  });

  return {
    success: true,
    message: 'Eligible employees retrieved',
    data: eligibleEmployees
  };
});