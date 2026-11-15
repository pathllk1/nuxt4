import { defineEventHandler, createError, setResponseHeader } from 'h3';
import { requireAuthSession } from '../../../../../utils/auth';
import { assertMessageAccess } from '../../../../../utils/mail-auth';

function sanitizeFilename(name: string): string {
  return (name || 'email')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 80);
}

export default defineEventHandler(async (event) => {
  try {
    const session = await requireAuthSession(event);
    const id = event.context.params?.id;
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Message ID is required' });

    // Verify user ownership & access
    const message = await assertMessageAccess(id, session);

    const boundary = `----=_Part_BProSuite_${Date.now()}`;
    const dateStr = new Date(message.timestamp || message.date).toUTCString();
    const fromStr = message.from?.name
      ? `"${message.from.name}" <${message.from.address}>`
      : message.from?.address || 'unknown@domain.com';

    const toStr = (message.to || [])
      .map((t: any) => (t.name ? `"${t.name}" <${t.address}>` : t.address))
      .join(', ');

    const ccStr = (message.cc || [])
      .map((t: any) => (t.name ? `"${t.name}" <${t.address}>` : t.address))
      .join(', ');

    const subject = message.subject || '(No Subject)';
    const bodyText = message.bodyText || message.snippet || '';
    const bodyHtml = message.bodyHtml || `<div>${(message.bodyText || '').replace(/\n/g, '<br>')}</div>`;

    let eml = '';
    eml += `From: ${fromStr}\r\n`;
    eml += `To: ${toStr}\r\n`;
    if (ccStr) eml += `Cc: ${ccStr}\r\n`;
    eml += `Subject: ${subject}\r\n`;
    eml += `Date: ${dateStr}\r\n`;
    eml += `Message-ID: ${message.messageId || `<${message.id}@businesspro-suite.com>`}\r\n`;
    eml += `MIME-Version: 1.0\r\n`;
    eml += `X-Mailer: BusinessPro Suite Enterprise Webmail\r\n`;
    eml += `Content-Type: multipart/alternative; boundary="${boundary}"\r\n`;
    eml += `\r\n`;

    eml += `--${boundary}\r\n`;
    eml += `Content-Type: text/plain; charset="utf-8"\r\n`;
    eml += `Content-Transfer-Encoding: 7bit\r\n`;
    eml += `\r\n`;
    eml += `${bodyText}\r\n`;
    eml += `\r\n`;

    eml += `--${boundary}\r\n`;
    eml += `Content-Type: text/html; charset="utf-8"\r\n`;
    eml += `Content-Transfer-Encoding: 7bit\r\n`;
    eml += `\r\n`;
    eml += `${bodyHtml}\r\n`;
    eml += `\r\n`;

    eml += `--${boundary}--\r\n`;

    const filename = `${sanitizeFilename(subject)}.eml`;
    setResponseHeader(event, 'Content-Type', 'message/rfc822');
    setResponseHeader(event, 'Content-Disposition', `attachment; filename="${filename}"`);
    return eml;
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || 'Error generating EML file'
    });
  }
});
