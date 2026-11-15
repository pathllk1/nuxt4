import { defineEventHandler, createError, setResponseHeader, getQuery } from 'h3';
import { requireAuthSession } from '../../../../../utils/auth';
import { MailCouchbaseService } from '../../../../../utils/mail-couchbase.service';
import { assertMessageAccess } from '../../../../../utils/mail-auth';
import { generateMailPdfBuffer } from '../../../../../utils/mail-pdf.utils';

function buildSafeContentDisposition(dispositionType: 'attachment' | 'inline', rawFilename: string): string {
  // 1. Strict printable ASCII fallback (RFC 2616 token / quoted-string, char codes 0x20-0x7E)
  const asciiFallback = (rawFilename || 'email')
    .replace(/[^\x20-\x7E]/g, '') // Strip all non-ASCII bytes
    .replace(/["\\/:*?<>|]/g, '_') // Strip filesystem and header quote delimiters
    .replace(/\s+/g, '_')
    .slice(0, 80)
    .trim() || 'email';

  // 2. RFC 5987 / RFC 6266 UTF-8 encoded filename for modern browsers (100% ASCII-safe string)
  const utf8Encoded = encodeURIComponent(rawFilename || 'email')
    .replace(/['()]/g, escape)
    .replace(/\*/g, '%2A');

  return `${dispositionType}; filename="${asciiFallback}"; filename*=UTF-8''${utf8Encoded}`;
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

    const rawFilename = `${(message.subject || 'email').trim()}${isThread ? '_thread' : ''}.pdf`;

    setResponseHeader(event, 'Content-Type', 'application/pdf');
    setResponseHeader(event, 'Content-Disposition', buildSafeContentDisposition('attachment', rawFilename));
    return pdfBuffer;
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || 'Error generating email PDF'
    });
  }
});
