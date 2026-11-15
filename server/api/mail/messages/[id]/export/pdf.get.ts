import { defineEventHandler, createError, setResponseHeader, getQuery } from 'h3';
import { requireAuthSession } from '../../../../../utils/auth';
import { MailCouchbaseService } from '../../../../../utils/mail-couchbase.service';
import { assertMessageAccess } from '../../../../../utils/mail-auth';
import { generateMailPdfBuffer } from '../../../../../utils/mail-pdf.utils';

function sanitizeFilename(name: string): string {
  return (name || 'email')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 80);
}

export default defineEventHandler(async (event) => {
  try {
    const session = await requireAuthSession(event);
    const firmId = String(session.firm_id);
    const userId = String(session._id);
    const id = event.context.params?.id;
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Message ID is required' });

    // Verify user ownership & access
    const message = await assertMessageAccess(id, session);

    const query = getQuery(event);
    const isThread = String(query.thread) === 'true';

    let threadMessages = [message];
    if (isThread && message.threadId) {
      threadMessages = await MailCouchbaseService.getThreadMessages(message.accountId, message.threadId, firmId, userId);
      if (threadMessages.length === 0) threadMessages = [message];
    }

    const pdfBuffer = await generateMailPdfBuffer({
      message,
      thread: threadMessages,
      isThread
    });

    const filename = `${sanitizeFilename(message.subject || 'email')}${isThread ? '_thread' : ''}.pdf`;

    setResponseHeader(event, 'Content-Type', 'application/pdf');
    setResponseHeader(event, 'Content-Disposition', `attachment; filename="${filename}"`);
    return pdfBuffer;
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || 'Error generating email PDF'
    });
  }
});
