import { defineEventHandler, createError } from 'h3';
import { requireAuthSession } from '../../../utils/auth';
import { MailCouchbaseService } from '../../../utils/mail-couchbase.service';
import { assertMessageAccess } from '../../../utils/mail-auth';

export default defineEventHandler(async (event) => {
  try {
    const session = await requireAuthSession(event);
    const firmId = String(session.firm_id);
    const userId = String(session._id);
    const id = event.context.params?.id;
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Message ID is required' });

    // Strict User Isolation: verify that the requesting user owns this message
    const message = await assertMessageAccess(id, session);

    // If message is part of a thread, retrieve only messages belonging to this user & firm
    let threadMessages = [message];
    if (message.threadId) {
      threadMessages = await MailCouchbaseService.getThreadMessages(message.accountId, message.threadId, firmId, userId);
      if (threadMessages.length === 0) threadMessages = [message];
    }

    return {
      success: true,
      data: message,
      thread: threadMessages
    };
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || 'Error fetching message details'
    });
  }
});

