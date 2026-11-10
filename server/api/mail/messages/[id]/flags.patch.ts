import { defineEventHandler, readBody, createError } from 'h3';
import { requireAuthSession } from '../../../../utils/auth';
import { MailCouchbaseService } from '../../../../utils/mail-couchbase.service';

export default defineEventHandler(async (event) => {
  try {
    await requireAuthSession(event);
    const id = event.context.params?.id;
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Message ID is required' });

    const body = await readBody(event);
    const ok = await MailCouchbaseService.updateMessageFlags(id, {
      isRead: body.isRead,
      isFlagged: body.isFlagged,
      categories: body.categories,
      folderId: body.folderId
    });

    if (!ok) {
      throw createError({ statusCode: 500, statusMessage: 'Failed to update message flags in Couchbase' });
    }

    return { success: true };
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || 'Error updating message flags'
    });
  }
});

