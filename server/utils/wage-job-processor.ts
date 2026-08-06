import mongoose from 'mongoose';
import Wage from '../models/Wage';
import type { IWage } from '../models/Wage';
import MasterRoll from '../models/MasterRoll';
import Advance from '../models/Advance';
import WageJob from '../models/WageJob';
import { postWageLedger } from './wages-ledger-helper';

const PROGRESS_UPDATE_EVERY = 5; // update job progress every N wages processed

/**
 * Processes a previously-created WageJob.
 *
 * NOTE (Bug #4 fix): wages data now lives on job.wages_data instead of being
 * passed in memory, so a server restart mid-job can still be inspected/retried.
 *
 * NOTE (Bug #1 fix): each wage is created and posted to the ledger inside its
 * OWN transaction. Previously all wages in a batch shared one transaction,
 * committed even if postWageLedger() failed for one member of the batch,
 * leaving orphaned DRAFT wages with no ledger entries. Per-wage transactions
 * guarantee a wage document only persists if its ledger entries also posted.
 */
export async function processWageJob(jobId: mongoose.Types.ObjectId) {
  const job = await WageJob.findById(jobId);
  if (!job) {
    console.error(`Wage job ${jobId} not found`);
    return;
  }

  const firmId = job.firm_id;
  const userId = job.user_id;
  const salaryMonth = job.salary_month;
  const wagesData: any[] = job.wages_data || [];

  try {
    await WageJob.findByIdAndUpdate(jobId, {
      status: 'PROCESSING',
      started_at: new Date(),
      total_wages: wagesData.length,
    });

    const results: any[] = [];
    let processedCount = 0; // successful only
    let failedCount = 0;

    for (let i = 0; i < wagesData.length; i++) {
      const wage = wagesData[i];
      let session: mongoose.ClientSession | undefined;

      try {
        // --- Field validation (Bug #16: wage_days must be a positive number) ---
        if (
          !wage.master_roll_id ||
          wage.gross_salary === undefined ||
          !wage.wage_days ||
          Number(wage.wage_days) <= 0
        ) {
          throw new Error('Missing required fields or invalid wage_days');
        }

        // --- Bug #19: validate/cast master_roll_id to ObjectId before querying ---
        if (!mongoose.isValidObjectId(wage.master_roll_id)) {
          throw new Error('Invalid master_roll_id');
        }
        const masterRollObjectId = new mongoose.Types.ObjectId(wage.master_roll_id);

        // --- Idempotency Check (Bug C.2 fix): Check if wage already exists for this employee/month ---
        const existing = await Wage.findOne({
          firm_id: firmId,
          master_roll_id: masterRollObjectId,
          salary_month: salaryMonth,
        }).lean();

        if (existing) {
          results.push({
            master_roll_id: wage.master_roll_id,
            wage_id: existing._id,
            voucher_id: existing.voucher_group_id,
            success: true,
            message: 'Wage already created',
          });
          processedCount++;
          continue;
        }

        session = await mongoose.startSession();
        session.startTransaction();

        const employee = await MasterRoll.findOne({
          _id: masterRollObjectId,
          firm_id: firmId,
        }).session(session).select('project site').lean();

        if (!employee) {
          throw new Error('Employee not found');
        }

        const wageDays = Number(wage.wage_days);
        // Bug #5: guard against divide-by-zero / invalid wage_days
        const perDayWage = wageDays > 0 ? wage.gross_salary / wageDays : 0;

        const netSalary = wage.gross_salary -
          ((wage.epf_deduction || 0) +
           (wage.esic_deduction || 0) +
           (wage.other_deduction || 0) +
           (wage.advance_deduction || 0)) +
          (wage.other_benefit || 0);

        const doc = await Wage.create([{
          firm_id: firmId,
          master_roll_id: masterRollObjectId,
          p_day_wage: perDayWage,
          wage_days: wageDays,
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
            master_roll_id: masterRollObjectId,
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

        // If this throws, the whole transaction (wage + advance) is aborted below —
        // no orphaned DRAFT wage can be left behind (Bug #1 fix).
        const voucherId = await postWageLedger(wageDoc, session);
        wageDoc.voucher_group_id = voucherId;
        wageDoc.status = 'POSTED';
        wageDoc.posted_date = new Date();
        wageDoc.posted_by = userId;
        await wageDoc.save({ session });

        await session.commitTransaction();

        results.push({
          master_roll_id: wage.master_roll_id,
          wage_id: wageDoc._id,
          voucher_id: voucherId,
          success: true,
        });
        processedCount++;

      } catch (error: any) {
        if (session) {
          try {
            await session.abortTransaction();
          } catch {
            // transaction may not have started if validation failed before startTransaction
          }
        }
        results.push({
          master_roll_id: wage?.master_roll_id,
          success: false,
          message: error.message,
        });
        failedCount++;
      } finally {
        if (session) {
          await session.endSession();
        }
      }

      // Bug #10: use actual attempted count (i + 1), not a batch-size stride.
      // Bug #9: processed_wages tracks SUCCESSFUL wages only, consistently with completion.
      if ((i + 1) % PROGRESS_UPDATE_EVERY === 0 || i === wagesData.length - 1) {
        const progressPercentage = Math.round(((i + 1) / wagesData.length) * 100);
        await WageJob.findByIdAndUpdate(jobId, {
          processed_wages: processedCount,
          failed_wages: failedCount,
          progress_percentage: Math.min(progressPercentage, 100),
        });
      }
    }

    // Bug #17: guard the final save so a failure here doesn't leave the job
    // stuck at PROCESSING forever.
    try {
      const finalJob = await WageJob.findById(jobId);
      if (finalJob) {
        finalJob.status = 'COMPLETED';
        finalJob.completed_at = new Date();
        finalJob.processed_wages = processedCount;
        finalJob.failed_wages = failedCount;
        finalJob.progress_percentage = 100;
        finalJob.results = results;
        finalJob.duration_ms = new Date().getTime() - finalJob.createdAt.getTime();
        await finalJob.save();
      }
    } catch (saveError: any) {
      console.error(`❌ Job ${jobId} failed to save final state:`, saveError.message);
      await WageJob.findByIdAndUpdate(jobId, {
        status: 'FAILED',
        completed_at: new Date(),
        error_message: `Completed processing but failed to persist final state: ${saveError.message}`,
      }).catch(() => {
        // last resort — nothing more we can do here
      });
    }

  } catch (error: any) {
    console.error(`❌ Job ${jobId} failed:`, error.message);
    await WageJob.findByIdAndUpdate(jobId, {
      status: 'FAILED',
      completed_at: new Date(),
      error_message: error.message,
    });
  }
}