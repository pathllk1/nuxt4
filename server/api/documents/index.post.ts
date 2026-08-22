import { defineEventHandler, readMultipartFormData, createError } from 'h3';
import { getSql, connectPostgres } from '../../utils/pg.config';
import { requireAuthSession } from '../../utils/auth';
import { uploadToBackblazeB2 } from '../../utils/b2';

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
    const session = await requireAuthSession(event);
    const firmId = String(session.firm_id);
    const userId = String(session._id);

    const parts = await readMultipartFormData(event);
    if (!parts || parts.length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'No form data supplied'
      });
    }

    let fileBuffer: Buffer | null = null;
    let originalFileName = '';
    let fileType = '';
    let fileSize = 0;
    const fields: Record<string, string> = {};

    for (const part of parts) {
      if (part.name === 'file' && part.filename) {
        fileBuffer = part.data;
        originalFileName = part.filename;
        fileType = part.type || '';
        fileSize = part.data.length;

        // 500 KB limit validation
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

    if (!fields.name || !fields.referenceNumber || !fields.originalExpiryDate) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Document Name, Reference Number, and Original Expiry Date are required'
      });
    }

    let fileUrl: string | null = null;
    if (fileBuffer && fileBuffer.length > 0) {
      const isB2Configured = Boolean(process.env.B2_APPLICATION_KEY_ID && process.env.B2_APPLICATION_KEY && process.env.B2_BUCKET_ID);
      if (isB2Configured) {
        try {
          const uploadResult = await uploadToBackblazeB2(fileBuffer, originalFileName);
          fileUrl = uploadResult.fileUrl;
        } catch (b2Err: any) {
          console.warn('[DOCUMENTS_POST] B2 upload failed, falling back to base64:', b2Err.message);
          const base64Str = fileBuffer.toString('base64');
          fileUrl = `data:${fileType || 'application/octet-stream'};base64,${base64Str}`;
        }
      } else {
        // Store as Data URL fallback if external B2 is not configured
        const base64Str = fileBuffer.toString('base64');
        fileUrl = `data:${fileType || 'application/octet-stream'};base64,${base64Str}`;
      }
    }

    const name = fields.name;
    const referenceNumber = fields.referenceNumber;
    const description = fields.description || null;
    const startDate = fields.startDate || null;
    const originalExpiryDate = fields.originalExpiryDate;
    const closedDate = fields.closedDate || null;
    const extendedExpiryDate = fields.extendedExpiryDate || null;
    const value = parseFloat(fields.value || '0');
    const status = fields.status || 'Active';

    const [newDoc] = await sql`
      INSERT INTO documents (
        firm_id, user_id, name, reference_number, description,
        start_date, original_expiry_date, closed_date, extended_expiry_date,
        value, status, file_url, file_name, file_size, file_type
      ) VALUES (
        ${firmId}, ${userId}, ${name}, ${referenceNumber}, ${description},
        ${startDate}, ${originalExpiryDate}, ${closedDate}, ${extendedExpiryDate},
        ${value}, ${status}, ${fileUrl}, ${originalFileName || null}, ${fileSize || null}, ${fileType || null}
      ) RETURNING *
    `;

    return {
      success: true,
      data: newDoc
    };
  } catch (err: any) {
    console.error('[DOCUMENTS_POST] Error:', err);
    throw createError({
      statusCode: err.statusCode || 500,
      statusMessage: err.message || 'Failed to create document'
    });
  }
});
