import { defineEventHandler, createError, getRouterParam } from 'h3';
import { getSql, connectPostgres } from '../../utils/pg.config';
import { requireAuthSession } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  let sql = getSql();
  if (!sql) {
    sql = await connectPostgres();
  }

  if (!sql) {
    throw createError({
      statusCode: 530,
      statusMessage: 'PostgreSQL database connection not ready'
    });
  }

  try {
    const id = getRouterParam(event, 'id');
    if (!id) {
      throw createError({ statusCode: 400, statusMessage: 'Document ID is required' });
    }

    const session = await requireAuthSession(event);
    const firmId = String(session.firm_id);

    const result = await sql`
      DELETE FROM documents
      WHERE id = ${id} AND firm_id = ${firmId}
      RETURNING id
    `;

    if (result.length === 0) {
      throw createError({ statusCode: 404, statusMessage: 'Document not found' });
    }

    return {
      success: true,
      message: 'Document deleted successfully'
    };
  } catch (err: any) {
    console.error('[DOCUMENTS_DELETE] Error:', err);
    throw createError({
      statusCode: err.statusCode || 500,
      statusMessage: err.message || 'Failed to delete document'
    });
  }
});
