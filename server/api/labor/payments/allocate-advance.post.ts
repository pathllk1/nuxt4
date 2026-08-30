import { defineEventHandler, readBody, createError } from 'h3';
import { requireAuthSession } from '../../../utils/auth';
import { getSql, connectPostgres } from '../../../utils/pg.config';

export default defineEventHandler(async (event) => {
  try {
    const session = await requireAuthSession(event);
    let sql = getSql();
    if (!sql) sql = await connectPostgres();
    if (!sql) throw createError({ statusCode: 503, statusMessage: 'PostgreSQL database connection not ready' });

    const body = await readBody(event);
    const { period_id, amount, payment_date = new Date().toISOString().split('T')[0] } = body;

    const numAmount = Number(amount);
    if (!period_id || !numAmount || numAmount <= 0) {
      throw createError({ statusCode: 400, statusMessage: 'Valid period ID and allocation amount are required' });
    }

    // Fetch Period
    const [period] = await sql`
      SELECT p.*, l.name as leader_name
      FROM labor_periods p
      JOIN labor_leaders l ON p.leader_id = l.id
      WHERE p.id = ${period_id} AND p.firm_id = ${String(session.firm_id)}
    `;

    if (!period) throw createError({ statusCode: 404, statusMessage: 'Work period not found' });
    if (period.status === 'Settled') throw createError({ statusCode: 400, statusMessage: 'Cannot allocate advances to a settled work period' });

    // Insert into PostgreSQL labor_advances
    const [advance] = await sql`
      INSERT INTO labor_advances (
        firm_id, period_id, amount, payment_date, paid_from_bank_account_id, ledger_voucher_group_id
      )
      VALUES (
        ${period.firm_id}, ${period_id}, ${numAmount}, ${payment_date}, NULL, 'ALLOCATED_FROM_LEDGER'
      )
      RETURNING *
    `;

    return { 
      success: true, 
      message: `₹${numAmount.toLocaleString('en-IN')} allocated from General Ledger Advance to this work period`,
      data: advance 
    };
  } catch (error: any) {
    console.error('Allocate labor advance error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Error allocating labor advance'
    });
  }
});
