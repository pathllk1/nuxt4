import { defineEventHandler, readBody, createError } from 'h3';
import { requireAuthSession } from '../../utils/auth';
import { getB2UploadCredentials } from '../../utils/b2';

export default defineEventHandler(async (event) => {
  try {
    const session = await requireAuthSession(event);
    const firmId = String(session.firm_id);
    const userId = String(session._id);
    const body = await readBody(event);

    const filename = String(body.filename || 'attachment').trim();
    const accountId = String(body.accountId || 'default').trim();

    // Isolated outgoing prefix for user & account
    const b2Prefix = `mail-attachments/${firmId}/${userId}/${accountId}/outgoing`;

    const credentials = await getB2UploadCredentials(filename, b2Prefix);

    return {
      success: true,
      data: credentials
    };
  } catch (err: any) {
    console.error('[MailUploadUrl] Error generating B2 upload URL:', err.message);
    throw createError({
      statusCode: err.statusCode || 500,
      statusMessage: err.statusMessage || err.message || 'Failed to generate cloud upload URL'
    });
  }
});
