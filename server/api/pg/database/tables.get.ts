import { defineEventHandler, createError } from 'h3';
import { requireSuperAdmin } from '~~/server/utils/admin-guard';
import { getSql } from '~~/server/utils/pg.config';

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event);

  try {
    const sql = getSql();
    if (!sql) {
      throw createError({ statusCode: 503, statusMessage: 'PostgreSQL connection not ready' });
    }

    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name ASC
    `;

    return {
      success: true,
      tables: tables.map((t: any) => t.table_name)
    };
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || 'Failed to fetch PostgreSQL tables'
    });
  }
});
