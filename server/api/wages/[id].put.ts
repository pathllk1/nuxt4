import mongoose from 'mongoose';
import Wage from '../../models/Wage';
import Advance from '../../models/Advance';
import { deleteWageLedger, postWageLedger } from '../../utils/wages-ledger-helper';
import { requireAuthSession } from '../../utils/auth';

function calculateNetSalary(gross: number, epf: number, esic: number, otherDeduction: number, otherBenefit: number, advanceDeduction: number = 0) {
  return gross - ((epf ?? 0) + (esic ?? 0) + (otherDeduction ?? 0) + (advanceDeduction ?? 0)) + (otherBenefit ?? 0);
}

function calculatePerDayWage(gross: number, wageDays: number) {
  return wageDays > 0 ? parseFloat((gross / wageDays).toFixed(2)) : 0;
}

export default defineEventHandler(async (event) => {
  const user = await requireAuthSession(event);
  const id = getRouterParam(event, 'id');
  const body = await readBody(event);

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const wage = await Wage.findOne({ _id: id, firm_id: user.firm_id }).session(session);
    if (!wage) {
      await session.abortTransaction();
      throw createError({
        statusCode: 404,
        message: 'Wage record not found'
      });
    }

    if (wage.status === 'LOCKED') {
      await session.abortTransaction();
      throw createError({
        statusCode: 403,
        message: 'Wage is locked'
      });
    }

    // Cleanup old ledger
    await deleteWageLedger(wage._id as mongoose.Types.ObjectId, user.firm_id, session);

    // Update fields
    Object.assign(wage, body);
    wage.p_day_wage = calculatePerDayWage(wage.gross_salary, wage.wage_days);
    wage.net_salary = calculateNetSalary(wage.gross_salary, wage.epf_deduction, wage.esic_deduction, wage.other_deduction, wage.other_benefit, wage.advance_deduction);
    wage.updated_by = user._id as any;

    // Repost to ledger
    const voucherId = await postWageLedger(wage, session);
    wage.voucher_group_id = voucherId;
    wage.status = 'POSTED';
    await wage.save({ session });

    // Sync Advance Repayment
    await Advance.deleteMany({ wage_id: wage._id, type: 'REPAYMENT' }).session(session);
    if (wage.advance_deduction > 0) {
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
    throw createError({
      statusCode: 500,
      message: err.message
    });
  } finally {
    session.endSession();
  }
});
