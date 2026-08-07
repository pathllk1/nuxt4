import { defineEventHandler, createError } from 'h3';
import { requireAuthSession } from '../../../utils/auth';
import { getSql, connectPostgres } from '../../../utils/pg.config';

export default defineEventHandler(async (event) => {
  try {
    await requireAuthSession(event);
    let sql = getSql();
    if (!sql) sql = await connectPostgres();
    if (!sql) throw createError({ statusCode: 503, statusMessage: 'PostgreSQL database connection not ready' });

    const id = event.context.params?.id;
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Leader ID is required' });

    // Check if leader has associated work periods
    const periods = await sql`
      SELECT id FROM labor_periods WHERE leader_id = ${id} LIMIT 1
    `;

    if (periods.length > 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Cannot delete leader with existing work periods. Please delete associated work periods first.'
      });
    }

    await sql`DELETE FROM labor_leaders WHERE id = ${id}`;

    return { success: true, message: 'Labor leader deleted successfully' };
  } catch (error: any) {
    console.error('Delete labor leader error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Error deleting labor leader'
    });
  }
});
