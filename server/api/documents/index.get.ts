import { defineEventHandler, getQuery, createError } from 'h3';
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
      statusMessage: 'PostgreSQL connection not available'
    });
  }

  try {
    const session = await requireAuthSession(event);
    const firmId = String(session.firm_id);

    const query = getQuery(event);
    const search = query.search ? String(query.search).trim() : '';
    const sort = query.sort ? String(query.sort).trim() : 'expiry_date';
    const order = query.order && String(query.order).toLowerCase() === 'desc' ? 'DESC' : 'ASC';

    // Fetch documents for active firm
    let documents;
    if (search) {
      const searchPattern = `%${search}%`;
      if (sort === 'name') {
        documents = await sql`
          SELECT * FROM documents
          WHERE firm_id = ${firmId}
            AND (
              LOWER(name) LIKE LOWER(${searchPattern}) OR
              LOWER(reference_number) LIKE LOWER(${searchPattern}) OR
              LOWER(description) LIKE LOWER(${searchPattern})
            )
          ORDER BY name ${order === 'DESC' ? sql`DESC` : sql`ASC`}, created_at DESC
        `;
      } else if (sort === 'value') {
        documents = await sql`
          SELECT * FROM documents
          WHERE firm_id = ${firmId}
            AND (
              LOWER(name) LIKE LOWER(${searchPattern}) OR
              LOWER(reference_number) LIKE LOWER(${searchPattern}) OR
              LOWER(description) LIKE LOWER(${searchPattern})
            )
          ORDER BY value ${order === 'DESC' ? sql`DESC` : sql`ASC`}, created_at DESC
        `;
      } else if (sort === 'reference_number') {
        documents = await sql`
          SELECT * FROM documents
          WHERE firm_id = ${firmId}
            AND (
              LOWER(name) LIKE LOWER(${searchPattern}) OR
              LOWER(reference_number) LIKE LOWER(${searchPattern}) OR
              LOWER(description) LIKE LOWER(${searchPattern})
            )
          ORDER BY reference_number ${order === 'DESC' ? sql`DESC` : sql`ASC`}, created_at DESC
        `;
      } else {
        // Default sort by expiry date: COALESCE(extended_expiry_date, original_expiry_date)
        documents = await sql`
          SELECT * FROM documents
          WHERE firm_id = ${firmId}
            AND (
              LOWER(name) LIKE LOWER(${searchPattern}) OR
              LOWER(reference_number) LIKE LOWER(${searchPattern}) OR
              LOWER(description) LIKE LOWER(${searchPattern})
            )
          ORDER BY COALESCE(extended_expiry_date, original_expiry_date) ${order === 'DESC' ? sql`DESC` : sql`ASC`}, created_at DESC
        `;
      }
    } else {
      if (sort === 'name') {
        documents = await sql`
          SELECT * FROM documents
          WHERE firm_id = ${firmId}
          ORDER BY name ${order === 'DESC' ? sql`DESC` : sql`ASC`}, created_at DESC
        `;
      } else if (sort === 'value') {
        documents = await sql`
          SELECT * FROM documents
          WHERE firm_id = ${firmId}
          ORDER BY value ${order === 'DESC' ? sql`DESC` : sql`ASC`}, created_at DESC
        `;
      } else if (sort === 'reference_number') {
        documents = await sql`
          SELECT * FROM documents
          WHERE firm_id = ${firmId}
          ORDER BY reference_number ${order === 'DESC' ? sql`DESC` : sql`ASC`}, created_at DESC
        `;
      } else {
        documents = await sql`
          SELECT * FROM documents
          WHERE firm_id = ${firmId}
          ORDER BY COALESCE(extended_expiry_date, original_expiry_date) ${order === 'DESC' ? sql`DESC` : sql`ASC`}, created_at DESC
        `;
      }
    }

    // Compute dynamic status
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const resolvedDocs = documents.map((doc: any) => {
      let computedStatus = doc.status;
      if (doc.status !== 'Closed') {
        const expiryDateStr = doc.extended_expiry_date || doc.original_expiry_date;
        if (expiryDateStr) {
          const expiry = new Date(expiryDateStr);
          expiry.setHours(0, 0, 0, 0);
          if (today > expiry) {
            computedStatus = 'Expired';
          }
        }
      }

      return {
        ...doc,
        computed_status: computedStatus
      };
    });

    return {
      success: true,
      data: resolvedDocs
    };
  } catch (err: any) {
    console.error('[DOCUMENTS_GET] Error:', err);
    throw createError({
      statusCode: err.statusCode || 500,
      statusMessage: err.message || 'Error retrieving documents'
    });
  }
});
