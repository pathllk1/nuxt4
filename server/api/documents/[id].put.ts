import { defineEventHandler, readMultipartFormData, createError, getRouterParam } from 'h3';
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

    // Verify existence
    const [existingDoc] = await sql`
      SELECT * FROM documents WHERE id = ${id} AND firm_id = ${firmId}
    `;
    if (!existingDoc) {
      throw createError({ statusCode: 404, statusMessage: 'Document not found' });
    }

    const parts = await readMultipartFormData(event);
    let fileBuffer: Buffer | null = null;
    let originalFileName = existingDoc.file_name;
    let fileType = existingDoc.file_type;
    let fileSize = existingDoc.file_size;
    let fileUrl = existingDoc.file_url;
    const fields: Record<string, string> = {};

    if (parts && parts.length > 0) {
      for (const part of parts) {
        if (part.name === 'file' && part.filename) {
          fileBuffer = part.data;
          originalFileName = part.filename;
          fileType = part.type || '';
          fileSize = part.data.length;

          if (fileSize > 500 * 1024) {
            throw createError({
              statusCode: 400,
              statusMessage: 'File size exceeds maximum permitted limit of 500 KB'
            });
          }
        } else if (part.name) {
          fields[part.name] = part.data.toString('utf-8');
        }
      }
    }

    if (fileBuffer && fileBuffer.length > 0) {
      const base64Str = fileBuffer.toString('base64');
      fileUrl = `data:${fileType || 'application/octet-stream'};base64,${base64Str}`;
    }

    const name = fields.name !== undefined ? fields.name : existingDoc.name;
    const referenceNumber = fields.referenceNumber !== undefined ? fields.referenceNumber : existingDoc.reference_number;
    const description = fields.description !== undefined ? (fields.description || null) : existingDoc.description;
    const startDate = fields.startDate !== undefined ? (fields.startDate || null) : existingDoc.start_date;
    const originalExpiryDate = fields.originalExpiryDate !== undefined ? fields.originalExpiryDate : existingDoc.original_expiry_date;
    const closedDate = fields.closedDate !== undefined ? (fields.closedDate || null) : existingDoc.closed_date;
    const extendedExpiryDate = fields.extendedExpiryDate !== undefined ? (fields.extendedExpiryDate || null) : existingDoc.extended_expiry_date;
    const value = fields.value !== undefined ? parseFloat(fields.value || '0') : existingDoc.value;
    const status = fields.status !== undefined ? fields.status : existingDoc.status;

    const [updatedDoc] = await sql`
      UPDATE documents SET
        name = ${name},
        reference_number = ${referenceNumber},
        description = ${description},
        start_date = ${startDate},
        original_expiry_date = ${originalExpiryDate},
        closed_date = ${closedDate},
        extended_expiry_date = ${extendedExpiryDate},
        value = ${value},
        status = ${status},
        file_url = ${fileUrl},
        file_name = ${originalFileName},
        file_size = ${fileSize},
        file_type = ${fileType},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id} AND firm_id = ${firmId}
      RETURNING *
    `;

    return {
      success: true,
      data: updatedDoc
    };
  } catch (err: any) {
    console.error('[DOCUMENTS_PUT] Error:', err);
    throw createError({
      statusCode: err.statusCode || 500,
      statusMessage: err.message || 'Failed to update document'
    });
  }
});
