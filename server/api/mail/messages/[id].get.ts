import { defineEventHandler, createError } from 'h3';
import { requireAuthSession } from '../../../utils/auth';
import { MailCouchbaseService } from '../../../utils/mail-couchbase.service';

export default defineEventHandler(async (event) => {
  try {
    await requireAuthSession(event);
    const id = event.context.params?.id;
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Message ID is required' });

    const message = await MailCouchbaseService.getMessage(id);
    if (!message) {
      throw createError({ statusCode: 404, statusMessage: 'Email message not found' });
    }

    // If message is part of a thread, also retrieve all messages in thread
    let threadMessages = [message];
    if (message.threadId) {
      threadMessages = await MailCouchbaseService.getThreadMessages(message.accountId, message.threadId);
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

