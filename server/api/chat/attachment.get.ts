import { defineEventHandler, getQuery, createError, setHeader } from 'h3';
import { downloadFromBackblazeB2 } from '../../utils/b2';

export default defineEventHandler(async (event) => {
  const user = event.context.user;
  if (!user || (!user.id && !user._id)) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized: Session required' });
  }

  const query = getQuery(event);
  let target = (query.path || query.url) as string;

  if (!target || typeof target !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Attachment path is required' });
  }

  target = target.trim();

  // If full URL is provided (e.g. stored B2 URL from message payload), safely extract object path
  if (target.startsWith('http://') || target.startsWith('https://')) {
    try {
      const parsed = new URL(target);
      // Security: Only allow genuine Backblaze B2 hostnames
      if (!parsed.hostname.endsWith('.backblazeb2.com') && !parsed.hostname.endsWith('.backblaze.com')) {
        throw createError({ statusCode: 400, statusMessage: 'Invalid attachment source host' });
      }
      // Extract key after /file/<bucket-name>/
      const fileMatch = parsed.pathname.match(/\/file\/[^/]+\/(.+)$/);
      if (fileMatch && fileMatch[1]) {
        target = decodeURIComponent(fileMatch[1]);
      } else {
        target = decodeURIComponent(parsed.pathname.replace(/^\/+/, ''));
      }
    } catch (urlErr: any) {
      if (urlErr.statusCode) throw urlErr;
      throw createError({ statusCode: 400, statusMessage: 'Malformed attachment URL' });
    }
  }

  // Security: Disallow directory traversal or remaining protocol schemes
  if (target.includes('..') || /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(target) || target.startsWith('//')) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid attachment path format' });
  }

  const currentUserId = (user.id || user._id).toString();
  const isSuperadmin = user.role === 'superadmin';

  // Security: If this is a chat attachment (chat/attachments/{chatId}/...), verify participant access
  const cleanTarget = target.replace(/^\/+/, '');
  if (cleanTarget.startsWith('chat/attachments/')) {
    const segments = cleanTarget.split('/');
    // chatId may be URL-encoded (e.g. userA%3AuserB) or plain (userA:userB)
    const rawChatId = segments[2] ? decodeURIComponent(segments[2]) : '';
    if (rawChatId) {
      const participants = rawChatId.split(':');
      if (!isSuperadmin && !participants.includes(currentUserId)) {
        throw createError({
          statusCode: 403,
          statusMessage: 'Forbidden: You are not an authorized participant in this conversation'
        });
      }
    }
  }

  const result = await downloadFromBackblazeB2(cleanTarget);
  if (!result) {
    throw createError({ statusCode: 404, statusMessage: 'Attachment not found or expired' });
  }

  // Set proper caching and content type headers
  setHeader(event, 'Content-Type', result.contentType);
  setHeader(event, 'Cache-Control', 'public, max-age=31536000, immutable');
  setHeader(event, 'X-Content-Type-Options', 'nosniff');

  return result.buffer;
});
