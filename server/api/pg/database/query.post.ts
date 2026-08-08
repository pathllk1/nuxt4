import { defineEventHandler, createError, readBody } from 'h3';
import { requireSuperAdmin } from '~~/server/utils/admin-guard';
import { getSql } from '~~/server/utils/pg.config';

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event);

  try {
    const { query } = await readBody(event);
    if (!query) {
      throw createError({ statusCode: 400, statusMessage: 'Query string is required' });
    }

    const sql = getSql();
    if (!sql) {
      throw createError({ statusCode: 503, statusMessage: 'PostgreSQL connection not ready' });
    }

    const startTime = process.hrtime();
    const result = await sql.unsafe(query);
    const diff = process.hrtime(startTime);
    const executionTimeMs = (diff[0] * 1000 + diff[1] / 1000000).toFixed(2);

    return {
      success: true,
      data: Array.isArray(result) ? result : [result],
      count: Array.isArray(result) ? result.length : 1,
      executionTimeMs
    };
  } catch (error: any) {
    throw createError({
      statusCode: 400,
      statusMessage: error.message || 'SQL execution failed'
    });
  }
});
