import { defineEventHandler, getQuery, createError } from 'h3';
import { requireAuthSession } from '../../../utils/auth';
import { MailCouchbaseService } from '../../../utils/mail-couchbase.service';

export default defineEventHandler(async (event) => {
  try {
    const session = await requireAuthSession(event);
    const firmId = String(session.firm_id);
    const userId = String(session._id);
    const query = getQuery(event);
    const q = String(query.q || '').trim();

    if (!q) return { success: true, data: [] };

    const contacts = await MailCouchbaseService.getContacts(firmId, userId, q, 15);
    return {
      success: true,
      data: contacts.map(c => ({
        name: c.name,
        email: c.email,
        company: c.company,
        avatarUrl: c.avatarUrl,
        frequencyScore: c.interactionStats?.frequencyScore || 0
      }))
    };
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || 'Error auto-suggesting contacts'
    });
  }
});

