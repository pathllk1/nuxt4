import mongoose from 'mongoose';
import Wage from '../../models/Wage';
import Advance from '../../models/Advance';
import { getWageDisbursedAmount, postWageLedger, postWageDisbursement, toCurrency } from '../../utils/wages-ledger-helper';
import { requireAuthSession } from '../../utils/auth';
import { requireWageRole } from '../../utils/wage-authz';

// Bug #3: explicit allowlist instead of Object.assign(wage, body).
// Anything not in this list (firm_id, created_by, status, voucher_group_id,
// posted_by, posted_date, etc.) can never be overwritten by the client.
const EDITABLE_FIELDS = [
  'project',
  'site',
  'gross_salary',
  'wage_days',
  'epf_deduction',
  'esic_deduction',
  'other_deduction',
  'other_benefit',
  'advance_deduction',
  'paid_date',
  'cheque_no',
  'bank_account_id',
  'payment_mode',
  'remarks',
] as const;

function calculateNetSalary(gross: number, epf: number, esic: number, otherDeduction: number, otherBenefit: number, advanceDeduction: number = 0) {
  return gross - ((epf ?? 0) + (esic ?? 0) + (otherDeduction ?? 0) + (advanceDeduction ?? 0)) + (otherBenefit ?? 0);
}

function calculatePerDayWage(gross: number, wageDays: number) {
  return wageDays > 0 ? parseFloat((gross / wageDays).toFixed(2)) : 0;
}

export default defineEventHandler(async (event) => {
  const user = await requireAuthSession(event);
  await requireWageRole(event, user, ['Owner', 'Admin', 'Manager']);

  const id = getRouterParam(event, 'id');
  const body = await readBody(event);

  // Bug #13: validate the incoming values BEFORE they're ever applied to the
  // document, and return 400 (not a 500 surfaced from ledger posting).
  const grossSalary = body.gross_salary !== undefined ? Number(body.gross_salary) : undefined;
  const wageDays = body.wage_days !== undefined ? Number(body.wage_days) : undefined;

  if (grossSalary !== undefined && (!Number.isFinite(grossSalary) || grossSalary <= 0)) {
    throw createError({ statusCode: 400, message: 'gross_salary must be a positive number' });
  }
  if (wageDays !== undefined && (!Number.isFinite(wageDays) || wageDays <= 0)) {
    throw createError({ statusCode: 400, message: 'wage_days must be a positive number' });
  }
  for (const field of ['epf_deduction', 'esic_deduction', 'other_deduction', 'other_benefit', 'advance_deduction'] as const) {
    if (body[field] !== undefined && (!Number.isFinite(Number(body[field])) || Number(body[field]) < 0)) {
      throw createError({ statusCode: 400, message: `${field} must be a non-negative number` });
    }
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const wage = await Wage.findOne({ _id: id, firm_id: user.firm_id }).session(session);
    if (!wage) {
      throw createError({
        statusCode: 404,
        message: 'Wage record not found'
      });
    }

    if (wage.status === 'LOCKED') {
      throw createError({
        statusCode: 403,
        message: 'Wage is locked'
      });
    }

    const effectiveGross = grossSalary ?? wage.gross_salary;
    const effectiveEpf = body.epf_deduction ?? wage.epf_deduction;
    const effectiveEsic = body.esic_deduction ?? wage.esic_deduction;
    const effectiveOtherDed = body.other_deduction ?? wage.other_deduction;
    const effectiveOtherBen = body.other_benefit ?? wage.other_benefit;
    const effectiveAdvance = body.advance_deduction ?? wage.advance_deduction;

    const totalDeductions = (effectiveEpf || 0) + (effectiveEsic || 0) + (effectiveOtherDed || 0) + (effectiveAdvance || 0);
    if (totalDeductions > effectiveGross) {
      throw createError({
        statusCode: 400,
        message: `Total deductions (${totalDeductions}) cannot exceed gross salary (${effectiveGross})`
      });
    }

    // Bug #14: clean up old advance repayments tied to this wage before
    // recreating — otherwise stale repayment records accumulate on every edit.
    await Advance.deleteMany({ wage_id: wage._id, type: 'REPAYMENT' }).session(session);

    // Bug #3: apply only allowlisted fields
    for (const field of EDITABLE_FIELDS) {
      if (body[field] !== undefined) {
        (wage as any)[field] = body[field];
      }
    }

    wage.p_day_wage = calculatePerDayWage(wage.gross_salary, wage.wage_days);
    wage.net_salary = calculateNetSalary(wage.gross_salary, wage.epf_deduction, wage.esic_deduction, wage.other_deduction, wage.other_benefit, wage.advance_deduction);
    wage.updated_by = user._id as any;

    // Check existing actual disbursements from GL to decouple Accrual from Payment
    const disbursedAmount = await getWageDisbursedAmount(wage._id as mongoose.Types.ObjectId, user.firm_id, session);
    wage.paid_amount = disbursedAmount;
    wage.balance_due = Math.max(0, toCurrency(wage.net_salary - disbursedAmount));

    if (disbursedAmount === 0) {
      wage.payment_status = 'UNPAID';
    } else if (Math.abs(disbursedAmount - wage.net_salary) <= 0.01) {
      wage.payment_status = 'PAID';
      wage.balance_due = 0;
    } else if (disbursedAmount < wage.net_salary) {
      wage.payment_status = 'PARTIALLY_PAID';
      wage.balance_due = toCurrency(wage.net_salary - disbursedAmount);
    } else {
      // Overpaid scenario: net salary was reduced below what was already disbursed
      wage.payment_status = 'OVERPAID';
      wage.balance_due = 0;
      const excessAmount = toCurrency(disbursedAmount - wage.net_salary);

      // Clean up previous overpayment advance records for idempotency
      await Advance.deleteMany({
        wage_id: wage._id,
        type: 'ADVANCE',
        remarks: { $regex: /Excess wage adjustment/ }
      }).session(session);

      if (excessAmount > 0) {
        await Advance.create([{
          firm_id: user.firm_id,
          master_roll_id: wage.master_roll_id,
          type: 'ADVANCE',
          amount: excessAmount,
          date: wage.paid_date || new Date().toISOString().split('T')[0],
          payment_mode: wage.payment_mode === 'CASH' ? 'CASH' : 'BANK',
          bank_account_id: wage.bank_account_id || null,
          wage_id: wage._id,
          remarks: `Excess wage adjustment for ${wage.salary_month} (Overpaid by ${excessAmount})`,
          created_by: user._id,
          updated_by: user._id,
        }], { session });
      }
    }

    // Repost/update Accrual JV in ledger (in-place modification via UnifiedPostingService.updateVoucher)
    const voucherId = await postWageLedger(wage, session);
    wage.voucher_group_id = voucherId;
    wage.status = 'POSTED';

    // If this wage was previously unpaid and payment details were supplied for the first time on edit:
    if (wage.paid_amount === 0 && wage.paid_date && wage.net_salary > 0) {
      await postWageDisbursement(wage, session);
    }

    // Bug #18: schema has optimisticConcurrency enabled, so a concurrent
    // update to this same wage between our findOne and this save will throw
    // a VersionError instead of silently clobbering the other write.
    await wage.save({ session });

    if (wage.advance_deduction > 0) {
      // Bug (report B6): validate against the employee's actual outstanding
      // advance balance before recording a repayment — previously any
      // non-negative advance_deduction was accepted unconditionally, even if
      // the employee had no outstanding advance to repay.
      const existingAdvances = await Advance.find({
        firm_id: user.firm_id,
        master_roll_id: wage.master_roll_id,
      }).session(session).lean();

      const outstandingBalance = existingAdvances.reduce((bal, a: any) => {
        if (a.type === 'ADVANCE') return bal + (a.amount || 0);
        if (a.type === 'REPAYMENT') return bal - (a.amount || 0);
        return bal;
      }, 0);

      if (wage.advance_deduction > outstandingBalance) {
        throw createError({
          statusCode: 400,
          message: `Advance deduction (${wage.advance_deduction}) exceeds outstanding advance balance (${outstandingBalance}) for this employee`
        });
      }

      await Advance.create([{
        firm_id: user.firm_id,
        master_roll_id: wage.master_roll_id,
        type: 'REPAYMENT',
        amount: wage.advance_deduction,
        date: wage.paid_date || new Date().toISOString().split('T')[0],
        payment_mode: 'WAGE_DEDUCTION',
        wage_id: wage._id,
        remarks: `Repayment from wages - ${wage.salary_month}`,
        created_by: user._id,
        updated_by: user._id
      }], { session });
    }

    await session.commitTransaction();
    return wage;
  } catch (err: any) {
    await session.abortTransaction();

    if (err.name === 'VersionError') {
      throw createError({
        statusCode: 409,
        message: 'This wage was modified by another request. Please reload and try again.'
      });
    }
    if (err.statusCode) {
      throw err;
    }
    // Validation-type failures from postWageLedger should surface as 400s,
    // not 500s (Bug #13).
    if (/validation failed/i.test(err.message || '')) {
      throw createError({ statusCode: 400, message: err.message });
    }
    throw createError({
      statusCode: 500,
      message: err.message
    });
  } finally {
    session.endSession();
  }
});