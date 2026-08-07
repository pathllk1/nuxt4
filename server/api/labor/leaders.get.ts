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

    const leaders = await sql`
      SELECT * FROM labor_leaders 
      WHERE firm_id = ${firmId} 
      ORDER BY name ASC
    `;

    return { success: true, data: leaders };
  } catch (error: any) {
    console.error('Fetch labor leaders error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Error fetching labor leaders'
    });
  }
});
