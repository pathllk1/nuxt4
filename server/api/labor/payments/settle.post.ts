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
    const { period_id, paid_amount, payment_date, payment_mode = 'CASH', bank_account_id, adjustment_reason } = body;

    const numPaidAmount = Number(paid_amount);
    if (!period_id || numPaidAmount < 0 || !payment_date) {
      throw createError({ statusCode: 400, statusMessage: 'Valid period ID, payout amount, and payment date are required' });
    }

    if (payment_mode !== 'CASH' && !bank_account_id) {
      throw createError({ statusCode: 400, statusMessage: 'Bank account selection is required for non-cash payments' });
    }

    // Fetch Period & Leader
    const [period] = await sql`
      SELECT p.*, l.name as leader_name
      FROM labor_periods p
      JOIN labor_leaders l ON p.leader_id = l.id
      WHERE p.id = ${period_id}
    `;

    if (!period) throw createError({ statusCode: 404, statusMessage: 'Work period not found' });
    if (period.status === 'Settled') throw createError({ statusCode: 400, statusMessage: 'This work period is already settled' });

    // Calculate totals from PostgreSQL
    const [wagesRow] = await sql`
      SELECT COALESCE(SUM(total_wages), 0) as sum_wages FROM labor_workers WHERE period_id = ${period_id}
    `;
    const [expensesRow] = await sql`
      SELECT COALESCE(SUM(amount), 0) as sum_expenses FROM labor_expenses WHERE period_id = ${period_id}
    `;
    const [advancesRow] = await sql`
      SELECT COALESCE(SUM(amount), 0) as sum_advances FROM labor_advances WHERE period_id = ${period_id}
    `;

    const totalWages = Number(wagesRow?.sum_wages || 0);
    const totalExpenses = Number(expensesRow?.sum_expenses || 0);
    const totalAdvances = Number(advancesRow?.sum_advances || 0);
    const netPayable = totalWages + totalExpenses - totalAdvances;

    // 1. Post Settlement to MongoDB Ledger
    const voucherGroupId = await laborLedgerHelper.postLaborSettlement({
      firm_id: period.firm_id,
      total_wages: totalWages,
      total_expenses: totalExpenses,
      total_advances: totalAdvances,
      net_payable: netPayable,
      paid_amount: numPaidAmount,
      adjustment_reason: adjustment_reason,
      payment_date: payment_date,
      bank_account_id: payment_mode === 'CASH' ? null : bank_account_id,
      payment_mode: payment_mode,
      leader_name: period.leader_name,
      created_by: String(session._id),
    });

    // 2. Insert into PostgreSQL labor_settlements & update labor_periods status
    let settlement: any = null;
    await sql.begin(async (tx) => {
      [settlement] = await tx`
        INSERT INTO labor_settlements (
          period_id, total_wages, total_expenses, total_advances, net_payable, paid_amount, payment_date, paid_from_bank_account_id, ledger_voucher_group_id, adjustment_reason
        ) VALUES (
          ${period_id}, ${totalWages}, ${totalExpenses}, ${totalAdvances}, ${netPayable}, ${numPaidAmount}, ${payment_date}, ${payment_mode === 'CASH' ? null : bank_account_id}, ${voucherGroupId}, ${adjustment_reason || null}
        )
        RETURNING *
      `;

      await tx`
        UPDATE labor_periods SET status = 'Settled', updated_at = CURRENT_TIMESTAMP WHERE id = ${period_id}
      `;
    });

    return { success: true, data: settlement };
  } catch (error: any) {
    console.error('Record labor settlement error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Error settling labor period'
    });
  }
});
