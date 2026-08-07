import { defineEventHandler, createError } from 'h3';
import { requireAuthSession } from '../../../../utils/auth';
import { getSql, connectPostgres } from '../../../../utils/pg.config';
import BankAccount from '../../../../models/BankAccount';

export default defineEventHandler(async (event) => {
  try {
    const session = await requireAuthSession(event);
    let sql = getSql();
    if (!sql) sql = await connectPostgres();
    if (!sql) throw createError({ statusCode: 503, statusMessage: 'PostgreSQL database connection not ready' });

    const id = event.context.params?.id;
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Period ID is required' });

    // 1. Fetch Period & Leader Header
    const [period] = await sql`
      SELECT 
        p.*,
        l.name as leader_name,
        l.phone as leader_phone,
        l.bank_name as leader_bank_name,
        l.account_number as leader_account_number,
        l.ifsc_code as leader_ifsc_code
      FROM labor_periods p
      JOIN labor_leaders l ON p.leader_id = l.id
      WHERE p.id = ${id}
    `;

    if (!period) {
      throw createError({ statusCode: 404, statusMessage: 'Work period not found' });
    }

    // 2. Fetch Workers
    const workers = await sql`
      SELECT * FROM labor_workers 
      WHERE period_id = ${id}
      ORDER BY created_at ASC
    `;

    // 3. Fetch Attendance Logs
    const workerIds = workers.map((w: any) => w.id);
    let attendanceLogs: any[] = [];
    if (workerIds.length > 0) {
      attendanceLogs = await sql`
        SELECT * FROM labor_attendance
        WHERE worker_id = ANY(${workerIds})
      `;
    }

    // Format Attendance Map: worker_id -> dateStr -> day_value
    const attendanceMap: Record<string, Record<string, number>> = {};
    attendanceLogs.forEach((log: any) => {
      if (!attendanceMap[log.worker_id]) {
        attendanceMap[log.worker_id] = {};
      }
      const dateStr = log.attendance_date instanceof Date
        ? log.attendance_date.toISOString().split('T')[0]
        : String(log.attendance_date).split('T')[0];
      const targetObj = attendanceMap[log.worker_id];
      if (targetObj && dateStr) {
        targetObj[dateStr] = Number(log.day_value);
      }
    });

    // 4. Fetch Expenses
    const expenses = await sql`
      SELECT * FROM labor_expenses
      WHERE period_id = ${id}
      ORDER BY created_at ASC
    `;

    // 5. Fetch Advances
    const advances = await sql`
      SELECT * FROM labor_advances
      WHERE period_id = ${id}
      ORDER BY payment_date ASC
    `;

    // 6. Fetch Settlement (if settled)
    const [settlement] = await sql`
      SELECT * FROM labor_settlements
      WHERE period_id = ${id}
      LIMIT 1
    `;

    // 7. Fetch Bank Accounts from MongoDB for payment options
    const bankAccounts = await BankAccount.find({ firm_id: session.firm_id }).sort({ account_name: 1 }).lean();

    return {
      success: true,
      data: {
        period,
        workers,
        attendance: attendanceMap,
        expenses,
        advances,
        settlement: settlement || null,
        bankAccounts: bankAccounts || []
      }
    };
  } catch (error: any) {
    console.error('Fetch labor period details error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Error fetching labor period details'
    });
  }
});
