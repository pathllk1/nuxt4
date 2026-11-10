import { defineEventHandler, getQuery, createError } from 'h3';
import { requireAuthSession } from '../../utils/auth';
import { MailCouchbaseService } from '../../utils/mail-couchbase.service';
import { assertAccountAccess } from '../../utils/mail-auth';

export default defineEventHandler(async (event) => {
  try {
    const session = await requireAuthSession(event);
    const firmId = String(session.firm_id);
    const query = getQuery(event);
    const accountId = String(query.accountId || '');

    if (!accountId) {
      throw createError({ statusCode: 400, statusMessage: 'accountId query parameter is required' });
    }

    // Strict User Isolation: verify that the requesting user owns this account
    await assertAccountAccess(accountId, session);

    const folders = await MailCouchbaseService.getFolders(accountId, firmId);
    return { success: true, data: folders };
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || 'Error fetching mail folders'
    });
  }
});

