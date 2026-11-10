import { defineEventHandler, createError } from 'h3';
import { requireAuthSession } from '../../utils/auth';
import { MailCouchbaseService } from '../../utils/mail-couchbase.service';

export default defineEventHandler(async (event) => {
  try {
    const session = await requireAuthSession(event);
    const firmId = String(session.firm_id);
    const userId = String(session._id);

    const accounts = await MailCouchbaseService.getAccounts(firmId, userId);
    return { success: true, data: accounts };
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || 'Error fetching mail accounts'
    });
  }
});

