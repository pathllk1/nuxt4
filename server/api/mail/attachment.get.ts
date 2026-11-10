import { defineEventHandler, getQuery, createError, setHeader } from 'h3';
import { requireAuthSession } from '../../utils/auth';
import { downloadFromBackblazeB2 } from '../../utils/b2';
import { MailCouchbaseService } from '../../utils/mail-couchbase.service';

export default defineEventHandler(async (event) => {
  try {
    const session = await requireAuthSession(event);
    const firmId = String(session.firm_id);
    const query = getQuery(event);

    let targetB2Path: string | null = null;
    let fileName = 'attachment';
    let contentType = 'application/octet-stream';

    // Mode 1: Access via messageId + attachmentId
    if (query.messageId && query.attachmentId) {
      const messageId = String(query.messageId).trim();
      const attachmentId = String(query.attachmentId).trim();

      const msg = await MailCouchbaseService.getMessage(messageId);
      if (!msg) {
        throw createError({ statusCode: 404, statusMessage: 'Message not found' });
      }

      // Security check: tenant isolation
      if (String(msg.firmId) !== firmId) {
        throw createError({ statusCode: 403, statusMessage: 'Unauthorized access to message attachment' });
      }

      const att = msg.attachments?.find(a => a.id === attachmentId || a.filename === attachmentId);
      if (!att || !att.b2Key) {
        throw createError({ statusCode: 404, statusMessage: 'Attachment not found or not stored in cloud storage' });
      }

      targetB2Path = att.b2Key;
      fileName = att.filename || fileName;
      contentType = att.contentType || contentType;
    }
    // Mode 2: Direct path with strict firm prefix enforcement
    else if (query.path) {
      let rawPath = String(query.path).trim();

      // Disallow directory traversal or external URL schemes
      if (rawPath.includes('..') || /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(rawPath) || rawPath.startsWith('//')) {
        throw createError({ statusCode: 400, statusMessage: 'Invalid attachment path format' });
      }

      const cleanPath = rawPath.replace(/^\/+/, '');
      const expectedFirmPrefix = `mail-attachments/${firmId}/`;

      if (!cleanPath.startsWith(expectedFirmPrefix)) {
        throw createError({ statusCode: 403, statusMessage: 'Forbidden: Cannot access attachments outside your firm scope' });
      }

      targetB2Path = cleanPath;
      const parts = cleanPath.split('/');
      fileName = parts[parts.length - 1] || fileName;
    } else {
      throw createError({ statusCode: 400, statusMessage: 'Either (messageId and attachmentId) or path query parameter is required' });
    }

    if (!targetB2Path) {
      throw createError({ statusCode: 404, statusMessage: 'Attachment path could not be resolved' });
    }

    // Download from Backblaze B2 using server master credentials
    const downloaded = await downloadFromBackblazeB2(targetB2Path);
    if (!downloaded || !downloaded.buffer) {
      throw createError({ statusCode: 404, statusMessage: 'Attachment file not found in storage bucket' });
    }

    const finalContentType = downloaded.contentType || contentType;
    const isInline = query.inline === 'true' || query.inline === '1';
    const disposition = isInline
      ? `inline; filename="${encodeURIComponent(fileName)}"`
      : `attachment; filename="${encodeURIComponent(fileName)}"`;

    setHeader(event, 'Content-Type', finalContentType);
    setHeader(event, 'Content-Disposition', disposition);
    setHeader(event, 'Content-Length', downloaded.buffer.length);
    setHeader(event, 'Cache-Control', 'private, max-age=86400');

    return downloaded.buffer;
  } catch (err: any) {
    if (err.statusCode) throw err;
    throw createError({
      statusCode: 500,
      statusMessage: err.message || 'Failed to retrieve email attachment'
    });
  }
});

