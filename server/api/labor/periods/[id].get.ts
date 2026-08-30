import { defineEventHandler, createError } from 'h3';
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
      WHERE p.id = ${id} AND p.firm_id = ${String(session.firm_id)}
    `;

    if (!period) {
      throw createError({ statusCode: 404, statusMessage: 'Work period not found' });
    }

    return { success: true, data: period };
  } catch (error: any) {
    console.error('Fetch labor period error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Error fetching labor period'
    });
  }
});
