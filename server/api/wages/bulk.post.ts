import mongoose from 'mongoose';
import Wage from '../../models/Wage';
import WageJob from '../../models/WageJob';
import Advance from '../../models/Advance';
import { postWageLedger } from '../../utils/wages-ledger-helper';
import { processWageJob } from '../../utils/wage-job-processor';
import { requireAuthSession } from '../../utils/auth';
import { requireWageRole } from '../../utils/wage-authz';

export default defineEventHandler(async (event) => {
  const user = await requireAuthSession(event);
  await requireWageRole(event, user, ['Owner', 'Admin', 'Manager']);

  const body = await readBody(event);
  const { month, wages } = body;

  if (!month || !wages || !Array.isArray(wages)) {
    throw createError({
      statusCode: 400,
      message: 'Month and wages array are required'
    });
  }

  // Bug #16: validate wage_days is a positive number for every item up front
  const invalid = wages.find((w: any) => !w.wage_days || Number(w.wage_days) <= 0);
  if (invalid) {
    throw createError({
      statusCode: 400,
      message: 'Every wage entry must have wage_days greater than 0'
    });
  }

  if (wages.length > 5) {
    // Bug #4: persist the wages payload on the job document itself so it
    // survives a server restart/crash, instead of only living in memory.
    const job = new WageJob({
      firm_id: user.firm_id,
      user_id: user._id,
      salary_month: month,
      total_wages: wages.length,
      status: 'PENDING',
      wages_data: wages,
      created_by: user._id,
      updated_by: user._id
    });
    await job.save();

    // Async background execution — processor now reads wages_data from the job itself
    processWageJob(job._id as any);

    return {
      success: true,
      jobId: job._id,
      message: 'Wage generation job started'
    };
  }

  // Direct inline creation for small batches
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const results = [];
    for (const item of wages) {
      const netSalary = item.gross_salary -
        ((item.epf_deduction || 0) +
         (item.esic_deduction || 0) +
         (item.other_deduction || 0) +
         (item.advance_deduction || 0)) +
        (item.other_benefit || 0);

      const doc = new Wage({
        firm_id: user.firm_id,
        master_roll_id: item.master_roll_id,
        p_day_wage: item.gross_salary / item.wage_days,
        wage_days: item.wage_days,
        gross_salary: item.gross_salary,
        epf_deduction: item.epf_deduction || 0,
        esic_deduction: item.esic_deduction || 0,
        other_deduction: item.other_deduction || 0,
        other_benefit: item.other_benefit || 0,
        advance_deduction: item.advance_deduction || 0,
        net_salary: netSalary,
        salary_month: month,
        paid_date: item.paid_date || null,
        cheque_no: item.cheque_no || null,
        bank_account_id: item.bank_account_id || null,
        payment_mode: item.payment_mode || null,
        status: 'POSTED',
        created_by: user._id,
        updated_by: user._id
      });

      await doc.save({ session });

      if (item.advance_deduction > 0) {
        await Advance.create([{
          firm_id: user.firm_id,
          master_roll_id: item.master_roll_id,
          type: 'REPAYMENT',
          amount: item.advance_deduction,
          date: item.paid_date || new Date().toISOString().split('T')[0],
          payment_mode: 'WAGE_DEDUCTION',
          wage_id: doc._id,
          remarks: `Repayment from wages - ${month}`,
          created_by: user._id,
          updated_by: user._id
        }], { session });
      }

      const voucherId = await postWageLedger(doc as any, session);
      doc.voucher_group_id = voucherId;
      await doc.save({ session });

      results.push(doc);
    }

    await session.commitTransaction();
    return { success: true, data: results };
  } catch (err: any) {
    await session.abortTransaction();

    // Bug (report B4): distinguish validation-type failures from real server
    // errors instead of always returning 500 with the raw message.
    if (err.statusCode) {
      throw err;
    }
    if (/validation failed|cannot exceed gross salary/i.test(err.message || '')) {
      throw createError({ statusCode: 400, message: err.message });
    }
    throw createError({
      statusCode: 500,
      message: 'Failed to create wages. Please try again or contact support.'
    });
  } finally {
    session.endSession();
  }
});