import { defineEventHandler, getQuery, createError, setHeader } from 'h3';
import { downloadFromBackblazeB2 } from '../../utils/b2';

export default defineEventHandler(async (event) => {
  const user = event.context.user;
  if (!user || (!user.id && !user._id)) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized: Session required' });
  }

  const query = getQuery(event);
  const target = (query.path || query.url) as string;

  if (!target) {
    throw createError({ statusCode: 400, statusMessage: 'Attachment path or url is required' });
  }

  const result = await downloadFromBackblazeB2(target);
  if (!result) {
    throw createError({ statusCode: 404, statusMessage: 'Attachment not found or expired' });
  }

  // Set proper caching and content type headers
  setHeader(event, 'Content-Type', result.contentType);
  setHeader(event, 'Cache-Control', 'public, max-age=31536000, immutable');
  setHeader(event, 'X-Content-Type-Options', 'nosniff');

  return result.buffer;
});
