import { defineEventHandler, createError, getQuery } from 'h3';
import { requireSuperAdmin } from '~~/server/utils/admin-guard';
import { getSql } from '~~/server/utils/pg.config';

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event);

  const table = event.context.params?.table;
  if (!table) {
    throw createError({ statusCode: 400, statusMessage: 'Table name is required' });
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(table)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid table name' });
  }

  const queryParams = getQuery(event);
  const limit = parseInt(String(queryParams.limit || 100));
  const skip = parseInt(String(queryParams.skip || 0));

  try {
    const sql = getSql();
    if (!sql) {
      throw createError({ statusCode: 503, statusMessage: 'PostgreSQL connection not ready' });
    }

    const data = await sql.unsafe(`
      SELECT * FROM "${table}"
      LIMIT ${limit} OFFSET ${skip}
    `);

    const countResult = await sql.unsafe(`SELECT COUNT(*) as total FROM "${table}"`);
    const total = countResult && countResult[0] ? parseInt(String(countResult[0].total)) : 0;

    return {
      success: true,
      data,
      total
    };
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || `Failed to fetch data from table ${table}`
    });
  }
});
