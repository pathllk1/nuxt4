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

    const firmId = String(session.firm_id);
    const [period] = await sql`SELECT status FROM labor_periods WHERE id = ${id} AND firm_id = ${firmId}`;
    if (!period) throw createError({ statusCode: 404, statusMessage: 'Work period not found' });

    if (period.status === 'Settled') {
      throw createError({ statusCode: 400, statusMessage: 'Cannot delete a settled work period' });
    }

    await sql`DELETE FROM labor_periods WHERE id = ${id} AND firm_id = ${firmId}`;

    return { success: true, message: 'Work period deleted successfully' };
  } catch (error: any) {
    console.error('Delete labor period error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Error deleting labor period'
    });
  }
});
