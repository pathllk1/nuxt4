import { defineEventHandler, getQuery, createError } from 'h3';
import { requireAuthSession } from '../../utils/auth';
import { getSql, connectPostgres } from '../../utils/pg.config';

export default defineEventHandler(async (event) => {
  try {
    const session = await requireAuthSession(event);
    let sql = getSql();
    if (!sql) sql = await connectPostgres();
    if (!sql) throw createError({ statusCode: 503, statusMessage: 'PostgreSQL database connection not ready' });

    const query = getQuery(event);
    const firmId = (query.firm_id as string) || session.firm_id;
    const status = query.status ? String(query.status) : null;
    const leaderName = query.leader_name ? String(query.leader_name).trim() : null;
    const leaderId = query.leader_id ? String(query.leader_id) : null;

    const periods = await sql`
      SELECT 
        p.*,
        l.name as leader_name,
        l.phone as leader_phone,
        l.bank_name as leader_bank_name,
        l.account_number as leader_account_number,
        l.ifsc_code as leader_ifsc_code
      FROM labor_periods p
      JOIN labor_leaders l ON p.leader_id = l.id
      WHERE p.firm_id = ${firmId}
        ${status ? sql`AND p.status = ${status}` : sql``}
        ${leaderName ? sql`AND l.name = ${leaderName}` : sql``}
        ${leaderId ? sql`AND p.leader_id = ${leaderId}` : sql``}
      ORDER BY p.start_date DESC
    `;

    return { success: true, data: periods };
  } catch (error: any) {
    console.error('Fetch labor periods error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Error fetching labor periods'
    });
  }
});
