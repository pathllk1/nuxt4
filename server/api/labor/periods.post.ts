import { defineEventHandler, readBody, createError } from 'h3';
import { requireAuthSession } from '../../utils/auth';
import { getSql, connectPostgres } from '../../utils/pg.config';

export default defineEventHandler(async (event) => {
  try {
    const session = await requireAuthSession(event);
    let sql = getSql();
    if (!sql) sql = await connectPostgres();
    if (!sql) throw createError({ statusCode: 503, statusMessage: 'PostgreSQL database connection not ready' });

    const body = await readBody(event);
    const firmId = body.firm_id || session.firm_id;
    const { leader_id, start_date, end_date } = body;

    if (!leader_id || !start_date || !end_date) {
      throw createError({ statusCode: 400, statusMessage: 'Leader ID, start date, and end date are required' });
    }

    const [period] = await sql`
      INSERT INTO labor_periods (firm_id, leader_id, start_date, end_date)
      VALUES (${firmId}, ${leader_id}, ${start_date}, ${end_date})
      RETURNING *
    `;

    return { success: true, data: period };
  } catch (error: any) {
    console.error('Create labor period error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Error creating labor period'
    });
  }
});
