import { defineEventHandler, getQuery, createError } from 'h3';
import { requireAuthSession } from '../../utils/auth';
import { MailCouchbaseService } from '../../utils/mail-couchbase.service';
import { assertAccountAccess } from '../../utils/mail-auth';

export default defineEventHandler(async (event) => {
  try {
    const session = await requireAuthSession(event);
    const firmId = String(session.firm_id);
    const userId = String(session._id);
    const query = getQuery(event);

    const accountId = String(query.accountId || '');
    if (!accountId) {
      throw createError({ statusCode: 400, statusMessage: 'accountId query parameter is required' });
    }

    // Strict User Isolation: verify that the requesting user owns this account
    await assertAccountAccess(accountId, session);

    const folderId = query.folderId ? String(query.folderId) : undefined;
    const tab = (query.tab === 'other' ? 'other' : query.tab === 'focused' ? 'focused' : undefined) as ('focused' | 'other' | undefined);
    const filter = (query.filter as any) || 'all';
    const search = query.search ? String(query.search) : undefined;
    const limit = query.limit ? Number(query.limit) : 50;
    const offset = query.offset ? Number(query.offset) : 0;

    const result = await MailCouchbaseService.getMessages({
      firmId,
      userId,
      accountId,
      folderId,
      tab,
      filter,
      search,
      limit,
      offset
    });

    return {
      success: true,
      data: result.messages,
      total: result.total,
      limit,
      offset
    };
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || 'Error querying mail messages'
    });
  }
});

