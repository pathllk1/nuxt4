import { defineEventHandler, createError, getRouterParam } from 'h3';
import { requireAuthSession } from '../../../utils/auth';
import { MailCouchbaseService } from '../../../utils/mail-couchbase.service';

export default defineEventHandler(async (event) => {
  try {
    const session = await requireAuthSession(event);
    const firmId = String(session.firm_id);
    const userId = String(session._id);
    const accountId = getRouterParam(event, 'id');

    if (!accountId) {
      throw createError({ statusCode: 400, statusMessage: 'Account ID required' });
    }

    const existing = await MailCouchbaseService.getAccountById(accountId);
    if (!existing) {
      throw createError({ statusCode: 404, statusMessage: 'Account not found' });
    }

    if (String(existing.firmId) !== firmId || String(existing.userId) !== userId) {
      throw createError({ statusCode: 403, statusMessage: 'Forbidden: You cannot delete another user\'s mail account' });
    }

    await MailCouchbaseService.deleteAccount(accountId, firmId, userId);

    return { success: true, message: 'Mail account disconnected successfully' };
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || 'Error deleting mail account'
    });
  }
});
