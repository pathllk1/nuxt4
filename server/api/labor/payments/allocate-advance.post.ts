import { defineEventHandler, readBody, createError } from 'h3';
import { requireAuthSession } from '../../../utils/auth';
import { getSql, connectPostgres } from '../../../utils/pg.config';

export default defineEventHandler(async (event) => {
  const session = await requireAuthSession(event);
  let sql = getSql();
  if (!sql) sql = await connectPostgres();
  if (!sql) throw createError({ statusCode: 503, statusMessage: 'PostgreSQL database connection is unavailable.' });

  const body = (await readBody(event)) || {};
  const { advance_id, period_id } = body;

  if (!advance_id) {
    throw createError({ statusCode: 400, statusMessage: 'Advance ID is required.' });
  }

  // 1. Locate advance record
  const [advance] = await sql`
    SELECT id, firm_id, leader_id, period_id, amount
    FROM labor_advances
    WHERE id = ${advance_id} AND firm_id = ${String(session.firm_id)}
  `;
  if (!advance) {
    throw createError({ statusCode: 404, statusMessage: 'Labor advance not found in current firm.' });
  }

  // 2. Action: Allocate to an Open Period
  if (period_id) {
    const [period] = await sql`
      SELECT id, firm_id, leader_id, status
      FROM labor_periods
      WHERE id = ${period_id} AND firm_id = ${String(session.firm_id)}
    `;
    if (!period) {
      throw createError({ statusCode: 404, statusMessage: 'Target work period not found in current firm.' });
    }
    if (period.status === 'Settled') {
      throw createError({ statusCode: 409, statusMessage: 'Cannot allocate advances to a settled work period.' });
    }

    // Verify leader match if advance.leader_id is already assigned
    if (advance.leader_id && String(advance.leader_id) !== String(period.leader_id)) {
      throw createError({ statusCode: 400, statusMessage: 'This advance belongs to a different labor leader.' });
    }

    await sql`
      UPDATE labor_advances
      SET period_id = ${period_id},
          leader_id = ${period.leader_id}
      WHERE id = ${advance_id} AND firm_id = ${String(session.firm_id)}
    `;

    return {
      success: true,
      message: 'Advance allocated to work period successfully.',
      data: { advance_id, period_id }
    };
  }

  // 3. Action: De-allocate back to General Unallocated status
  if (advance.period_id) {
    const [currentPeriod] = await sql`
      SELECT id, status FROM labor_periods
      WHERE id = ${advance.period_id} AND firm_id = ${String(session.firm_id)}
    `;
    if (currentPeriod?.status === 'Settled') {
      throw createError({ statusCode: 409, statusMessage: 'Cannot de-allocate an advance from a settled work period.' });
    }

    await sql`
      UPDATE labor_advances
      SET period_id = NULL
      WHERE id = ${advance_id} AND firm_id = ${String(session.firm_id)}
    `;

    return {
      success: true,
      message: 'Advance returned to unallocated status.',
      data: { advance_id, period_id: null }
    };
  }

  return {
    success: true,
    message: 'Advance is already unallocated.',
    data: { advance_id, period_id: null }
  };
});
