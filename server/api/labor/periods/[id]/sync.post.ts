import { defineEventHandler, readBody, createError } from 'h3';
import { requireAuthSession } from '../../../../utils/auth';
import { getSql, connectPostgres } from '../../../../utils/pg.config';

export default defineEventHandler(async (event) => {
  try {
    await requireAuthSession(event);
    let sql = getSql();
    if (!sql) sql = await connectPostgres();
    if (!sql) throw createError({ statusCode: 503, statusMessage: 'PostgreSQL database connection not ready' });

    const periodId = event.context.params?.id;
    if (!periodId) throw createError({ statusCode: 400, statusMessage: 'Period ID is required' });

    const [period] = await sql`SELECT status FROM labor_periods WHERE id = ${periodId}`;
    if (!period) throw createError({ statusCode: 404, statusMessage: 'Work period not found' });

    if (period.status === 'Settled') {
      throw createError({ statusCode: 400, statusMessage: 'Cannot modify a settled work period' });
    }

    const body = await readBody(event);
    const { workers = [], expenses = [] } = body;

    // Transactional sync
    await sql.begin(async (tx) => {
      // 1. Process Workers & Attendance
      const existingWorkers = await tx`SELECT id FROM labor_workers WHERE period_id = ${periodId}`;
      const existingWorkerIds = new Set(existingWorkers.map((w: any) => w.id));
      const payloadWorkerIds = new Set(workers.map((w: any) => w.id).filter(Boolean));

      // Remove deleted workers
      const toDeleteWorkerIds = Array.from(existingWorkerIds).filter((id) => !payloadWorkerIds.has(id));
      if (toDeleteWorkerIds.length > 0) {
        await tx`DELETE FROM labor_workers WHERE id = ANY(${toDeleteWorkerIds})`;
      }

      // Upsert Workers & Attendance
      for (const w of workers) {
        let workerId = w.id;
        const dailyWage = Number(w.daily_wage) || 0;

        if (workerId && existingWorkerIds.has(workerId)) {
          await tx`
            UPDATE labor_workers 
            SET labor_name = ${w.labor_name}, daily_wage = ${dailyWage}
            WHERE id = ${workerId}
          `;
        } else {
          const [newWorker] = await tx`
            INSERT INTO labor_workers (period_id, labor_name, daily_wage)
            VALUES (${periodId}, ${w.labor_name}, ${dailyWage})
            RETURNING id
          `;
          if (!newWorker) throw new Error('Failed to insert worker record');
          workerId = newWorker.id;
        }

        // Attendance sync for this worker
        const attendanceMap = w.attendance || {};
        let totalPresentDays = 0;

        for (const [dateStr, dayVal] of Object.entries(attendanceMap)) {
          const numVal = Number(dayVal) || 0;
          totalPresentDays += numVal;

          await tx`
            INSERT INTO labor_attendance (worker_id, attendance_date, day_value)
            VALUES (${workerId}, ${dateStr}, ${numVal})
            ON CONFLICT (worker_id, attendance_date) 
            DO UPDATE SET day_value = EXCLUDED.day_value
          `;
        }

        const totalWages = totalPresentDays * dailyWage;
        await tx`
          UPDATE labor_workers 
          SET total_present_days = ${totalPresentDays}, total_wages = ${totalWages}
          WHERE id = ${workerId}
        `;
      }

      // 2. Process Expenses
      await tx`DELETE FROM labor_expenses WHERE period_id = ${periodId}`;
      for (const exp of expenses) {
        if (exp.description && Number(exp.amount) > 0) {
          await tx`
            INSERT INTO labor_expenses (period_id, description, amount)
            VALUES (${periodId}, ${exp.description.trim()}, ${Number(exp.amount)})
          `;
        }
      }
    });

    return { success: true, message: 'Labor sheet synced successfully' };
  } catch (error: any) {
    console.error('Sync labor period error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Error syncing labor period'
    });
  }
});
