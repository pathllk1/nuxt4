import { defineEventHandler, readBody, createError } from 'h3';
import { requireAuthSession } from '../../../utils/auth';
import { getSql, connectPostgres } from '../../../utils/pg.config';

export default defineEventHandler(async (event) => {
  try {
    const session = await requireAuthSession(event);
    let sql = getSql();
    if (!sql) sql = await connectPostgres();
    if (!sql) throw createError({ statusCode: 503, statusMessage: 'PostgreSQL database connection not ready' });

    const id = event.context.params?.id;
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Period ID is required' });

    const firmId = String(session.firm_id);
    const [period] = await sql`SELECT * FROM labor_periods WHERE id = ${id} AND firm_id = ${firmId}`;
    if (!period) throw createError({ statusCode: 404, statusMessage: 'Work period not found' });

    if (period.status === 'Settled') {
      throw createError({ statusCode: 400, statusMessage: 'Cannot edit a settled work period. Please reopen the period first.' });
    }

    const body = await readBody(event);
    const { start_date, end_date, leader_id } = body;

    const newStartDate = start_date || period.start_date;
    const newEndDate = end_date || period.end_date;
    const newLeaderId = leader_id || period.leader_id;

    if (new Date(newStartDate) > new Date(newEndDate)) {
      throw createError({ statusCode: 400, statusMessage: 'Start date cannot be after end date' });
    }

    // If changing the leader, ensure no advances or ledger vouchers are tied to the old leader
    if (newLeaderId !== period.leader_id) {
      const [leader] = await sql`SELECT id, name FROM labor_leaders WHERE id = ${newLeaderId} AND firm_id = ${firmId}`;
      if (!leader) throw createError({ statusCode: 404, statusMessage: 'New labor leader not found' });

      const [advancesCount] = await sql`
        SELECT COUNT(*)::int as count FROM labor_advances WHERE period_id = ${id}
      `;
      if (advancesCount && advancesCount.count > 0) {
        throw createError({
          statusCode: 400,
          statusMessage: `Cannot change leader because ${advancesCount.count} advance(s) are already recorded in this period. Please revoke them first to prevent accounting ledger discrepancies.`
        });
      }
    }

    const [updatedPeriod] = await sql`
      UPDATE labor_periods
      SET start_date = ${newStartDate},
          end_date = ${newEndDate},
          leader_id = ${newLeaderId},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id} AND firm_id = ${firmId}
      RETURNING *
    `;

    return {
      success: true,
      message: 'Work period updated successfully',
      data: updatedPeriod
    };
  } catch (error: any) {
    console.error('Update labor period error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Error updating labor period'
    });
  }
});
