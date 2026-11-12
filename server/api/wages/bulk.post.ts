import mongoose from 'mongoose';
import Wage from '../../models/Wage';
import Advance from '../../models/Advance';
import MasterRoll from '../../models/MasterRoll';
import { postWageLedger } from '../../utils/wages-ledger-helper';
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

  if (wages.length > 100) {
    throw createError({
      statusCode: 400,
      message: 'Batch size limit exceeded. Please process payroll in batches of 100 employees or fewer.'
    });
  }

  // Bug #16 & Bug #13: validate all items up front before entering transaction
  for (let idx = 0; idx < wages.length; idx++) {
    const w = wages[idx];
    if (!w.master_roll_id || !mongoose.isValidObjectId(w.master_roll_id)) {
      throw createError({ statusCode: 400, message: `Entry #${idx + 1}: Invalid or missing master_roll_id` });
    }
    if (!w.wage_days || Number(w.wage_days) <= 0) {
      throw createError({ statusCode: 400, message: `Entry #${idx + 1}: wage_days must be greater than 0` });
    }
    if (w.gross_salary === undefined || w.gross_salary === null || Number(w.gross_salary) <= 0) {
      throw createError({ statusCode: 400, message: `Entry #${idx + 1}: gross_salary must be a positive number` });
    }
    if (w.paid_date && !w.bank_account_id && w.payment_mode !== 'CASH') {
      throw createError({ statusCode: 400, message: `Entry #${idx + 1}: Bank account is required for paid wage via non-cash mode` });
    }
  }

  // Process ALL wages inline — Vercel serverless functions terminate execution
  // once the response is sent, so fire-and-forget background jobs get killed.
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const results = [];
    for (const item of wages) {
      const netSalary = item.gross_salary -
        ((item.epf_deduction || 0) +
         (item.esic_deduction || 0) +
         (item.professional_tax || 0) +
         (item.other_deduction || 0) +
         (item.advance_deduction || 0)) +
        (item.other_benefit || 0);

      let site = item.site || null;
      let project = item.project || null;
      if (!site || !project) {
        const emp = await MasterRoll.findById(item.master_roll_id).session(session).select('project site').lean();
        if (emp) {
          if (!site) site = emp.site || null;
          if (!project) project = emp.project || null;
        }
      }

      const doc = new Wage({
        firm_id: user.firm_id,
        master_roll_id: item.master_roll_id,
        project,
        site,
        p_day_wage: item.gross_salary / item.wage_days,
        wage_days: item.wage_days,
        gross_salary: item.gross_salary,
        epf_deduction: item.epf_deduction || 0,
        esic_deduction: item.esic_deduction || 0,
        professional_tax: item.professional_tax || 0,
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

      let repaymentDoc: any = null;
      if (item.advance_deduction > 0) {
        // Aggregate current live balance within the session transaction
        const balResult = await Advance.aggregate([
          {
            $match: {
              firm_id: user.firm_id,
              master_roll_id: new mongoose.Types.ObjectId(item.master_roll_id)
            }
          },
          {
            $group: {
              _id: '$master_roll_id',
              balance: {
                $sum: {
                  $cond: [{ $eq: ['$type', 'ADVANCE'] }, '$amount', { $subtract: [0, '$amount'] }]
                }
              }
            }
          }
        ]).session(session);

        const liveBalance = balResult.length > 0 ? (balResult[0].balance || 0) : 0;

        if (item.advance_deduction > liveBalance) {
          throw createError({
            statusCode: 400,
            message: `Advance deduction (₹${item.advance_deduction}) exceeds outstanding balance (₹${liveBalance.toFixed(2)}) for employee ID ${item.master_roll_id}`
          });
        }

        const repDocs = await Advance.create([{
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
        repaymentDoc = repDocs[0];
      }

      const voucherId = await postWageLedger(doc as any, session);
      doc.voucher_group_id = voucherId;
      await doc.save({ session });

      if (repaymentDoc) {
        repaymentDoc.voucher_group_id = voucherId;
        await repaymentDoc.save({ session });
      }

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
    console.error('❌ [wages/bulk] Unhandled error:', err.message, err.stack);
    throw createError({
      statusCode: 500,
      message: `Failed to create wages: ${err.message}`
    });
  } finally {
    session.endSession();
  }
});