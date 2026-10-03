import { defineEventHandler, readBody, createError } from 'h3';
import { requireAuthSession } from '../../../utils/auth';
import { getSql, connectPostgres } from '../../../utils/pg.config';
import { laborLedgerHelper } from '../../../utils/labor-ledger-helper';

export default defineEventHandler(async (event) => {
  try {
    const session = await requireAuthSession(event);
    let sql = getSql();
    if (!sql) sql = await connectPostgres();
    if (!sql) throw createError({ statusCode: 503, statusMessage: 'PostgreSQL database connection not ready' });

    const body = await readBody(event);
    const {
      period_id, amount, payment_date, payment_mode = 'CASH', bank_account_id,
      tds_mode = 'NONE', tds_rate = 1, tds_amount = 0, gross_amount = amount
    } = body;

    const numAmount = Number(amount);
    if (!period_id || !numAmount || numAmount <= 0 || !payment_date) {
      throw createError({ statusCode: 400, statusMessage: 'Valid period ID, payment amount, and payment date are required' });
    }

    if (payment_mode !== 'CASH' && !bank_account_id) {
      throw createError({ statusCode: 400, statusMessage: 'Bank account selection is required for non-cash payments' });
    }

    // Fetch Period & Leader
    const [period] = await sql`
      SELECT p.*, l.name as leader_name
      FROM labor_periods p
      JOIN labor_leaders l ON p.leader_id = l.id
      WHERE p.id = ${period_id} AND p.firm_id = ${String(session.firm_id)}
    `;

    if (!period) throw createError({ statusCode: 404, statusMessage: 'Work period not found' });
    if (period.status === 'Settled') throw createError({ statusCode: 400, statusMessage: 'Cannot add advances to a settled work period' });

    const numTdsAmount = Number(tds_amount) || 0;
    const numGrossAmount = Number(gross_amount) || numAmount;

    // 1. Post to MongoDB Ledger
    const voucherGroupId = await laborLedgerHelper.postLaborAdvance({
      firm_id: period.firm_id,
      amount: numAmount,
      payment_date: payment_date,
      bank_account_id: payment_mode === 'CASH' ? null : bank_account_id,
      payment_mode: payment_mode,
      leader_name: period.leader_name,
      created_by: String(session._id),
      tds_mode,
      tds_rate: Number(tds_rate) || 1,
      tds_amount: numTdsAmount,
      gross_amount: numGrossAmount
    });

    // Ensure schema has newly added columns before inserting
    try {
      await sql`
        ALTER TABLE labor_advances 
        ADD COLUMN IF NOT EXISTS paid_from_bank_account_id VARCHAR(24),
        ADD COLUMN IF NOT EXISTS ledger_voucher_group_id VARCHAR(100),
        ADD COLUMN IF NOT EXISTS tds_mode VARCHAR(20),
        ADD COLUMN IF NOT EXISTS tds_rate DECIMAL(5, 2),
        ADD COLUMN IF NOT EXISTS tds_amount DECIMAL(12, 2),
        ADD COLUMN IF NOT EXISTS gross_amount DECIMAL(12, 2);
      `;
    } catch (_) {}

    // 2. Insert into PostgreSQL labor_advances
    const [advance] = await sql`
      INSERT INTO labor_advances (
        firm_id, period_id, amount, payment_date, paid_from_bank_account_id, ledger_voucher_group_id,
        tds_mode, tds_rate, tds_amount, gross_amount
      )
      VALUES (
        ${period.firm_id}, ${period_id}, ${numAmount}, ${payment_date},
        ${payment_mode === 'CASH' ? null : bank_account_id}, ${voucherGroupId},
        ${tds_mode}, ${Number(tds_rate) || 1}, ${numTdsAmount}, ${numGrossAmount}
      )
      RETURNING *
    `;

    return { success: true, data: advance };
  } catch (error: any) {
    console.error('Record labor advance error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Error recording labor advance'
    });
  }
});
