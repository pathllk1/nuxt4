import mongoose from 'mongoose';
import Wage, { IWage } from '../models/Wage';
import MasterRoll from '../models/MasterRoll';
import Advance from '../models/Advance';
import WageJob from '../models/WageJob';
import { postWageLedger } from './wages-ledger-helper';

const BATCH_SIZE = 5;

export async function processWageJob(jobId: mongoose.Types.ObjectId, firmId: mongoose.Types.ObjectId, userId: mongoose.Types.ObjectId, salaryMonth: string, wagesData: any[]) {
  const session = await mongoose.startSession();
  
  try {
    await WageJob.findByIdAndUpdate(jobId, {
      status: 'PROCESSING',
      started_at: new Date(),
      total_wages: wagesData.length,
    });

    const results = [];
    let processedCount = 0;
    let failedCount = 0;

    for (let i = 0; i < wagesData.length; i += BATCH_SIZE) {
      const batch = wagesData.slice(i, i + BATCH_SIZE);
      
      session.startTransaction();

      try {
        for (const wage of batch) {
          try {
            if (!wage.master_roll_id || wage.gross_salary === undefined || !wage.wage_days) {
              results.push({
                master_roll_id: wage.master_roll_id,
                success: false,
                message: 'Missing required fields',
              });
              failedCount++;
              continue;
            }

            const existing = await Wage.findOne({
              firm_id: firmId,
              master_roll_id: wage.master_roll_id,
              salary_month: salaryMonth,
            }).session(session).lean();

            if (existing) {
              results.push({
                master_roll_id: wage.master_roll_id,
                success: false,
                message: 'Wage already exists for this employee in this month',
              });
              failedCount++;
              continue;
            }

            const employee = await MasterRoll.findOne({
              _id: wage.master_roll_id,
              firm_id: firmId,
            }).session(session).select('project site').lean();

            if (!employee) {
              results.push({
                master_roll_id: wage.master_roll_id,
                success: false,
                message: 'Employee not found',
              });
              failedCount++;
              continue;
            }

            const netSalary = wage.gross_salary -
              ((wage.epf_deduction || 0) +
               (wage.esic_deduction || 0) +
               (wage.other_deduction || 0) +
               (wage.advance_deduction || 0)) +
              (wage.other_benefit || 0);

            const doc = await Wage.create([{
              firm_id: firmId,
              master_roll_id: wage.master_roll_id,
              p_day_wage: wage.gross_salary / wage.wage_days,
              wage_days: wage.wage_days,
              project: employee.project ?? null,
              site: employee.site ?? null,
              gross_salary: wage.gross_salary,
              epf_deduction: wage.epf_deduction ?? 0,
              esic_deduction: wage.esic_deduction ?? 0,
              other_deduction: wage.other_deduction ?? 0,
              other_benefit: wage.other_benefit ?? 0,
              advance_deduction: wage.advance_deduction ?? 0,
              net_salary: netSalary,
              salary_month: salaryMonth,
              paid_date: wage.paid_date ?? null,
              cheque_no: wage.cheque_no ?? null,
              bank_account_id: wage.bank_account_id ?? null,
              payment_mode: wage.payment_mode ?? null,
              status: 'DRAFT',
              created_by: userId,
              updated_by: userId,
            } as any], { session });

            const wageDoc = doc[0] as IWage;

            if ((wage.advance_deduction || 0) > 0) {
              await Advance.create([{
                firm_id: firmId,
                master_roll_id: wage.master_roll_id,
                type: 'REPAYMENT',
                amount: wage.advance_deduction,
                date: wage.paid_date || new Date().toISOString().split('T')[0],
                payment_mode: 'WAGE_DEDUCTION',
                wage_id: wageDoc._id,
                remarks: `Repayment from wages - ${salaryMonth}`,
                created_by: userId,
                updated_by: userId,
              } as any], { session });
            }

            try {
              const voucherId = await postWageLedger(wageDoc, session);
              wageDoc.voucher_group_id = voucherId;
              wageDoc.status = 'POSTED';
              wageDoc.posted_date = new Date();
              wageDoc.posted_by = userId;
              await wageDoc.save({ session });

              results.push({
                master_roll_id: wage.master_roll_id,
                wage_id: wageDoc._id,
                voucher_id: voucherId,
                success: true,
              });
              processedCount++;
            } catch (ledgerError: any) {
              throw new Error(`Ledger posting failed: ${ledgerError.message}`);
            }

          } catch (error: any) {
            results.push({
              master_roll_id: wage.master_roll_id,
              success: false,
              message: error.message,
            });
            failedCount++;
          }
        }

        await session.commitTransaction();

      } catch (batchError: any) {
        await session.abortTransaction();
        console.error(`Batch ${i / BATCH_SIZE + 1} failed:`, batchError.message);
      }

      const progressPercentage = Math.round(((i + BATCH_SIZE) / wagesData.length) * 100);
      await WageJob.findByIdAndUpdate(jobId, {
        processed_wages: Math.min(processedCount + failedCount, wagesData.length),
        failed_wages: failedCount,
        progress_percentage: Math.min(progressPercentage, 100),
      });
    }

    const job = await WageJob.findById(jobId);
    if (job) {
      job.status = 'COMPLETED';
      job.completed_at = new Date();
      job.processed_wages = processedCount;
      job.failed_wages = failedCount;
      job.progress_percentage = 100;
      job.results = results;
      job.duration_ms = new Date().getTime() - job.createdAt.getTime();
      await job.save();
    }

  } catch (error: any) {
    console.error(`❌ Job ${jobId} failed:`, error.message);
    await WageJob.findByIdAndUpdate(jobId, {
      status: 'FAILED',
      completed_at: new Date(),
      error_message: error.message,
    });
  } finally {
    await session.endSession();
  }
}
