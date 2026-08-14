import { defineEventHandler, createError, getQuery } from 'h3';
import { lookupGstinWithCache } from '../../../utils/gstin-cache';

export default defineEventHandler(async (event) => {
  // Standard auth — any authenticated user can lookup a public GSTIN
  // (auth is enforced by the global middleware/hooks already)

  const query = getQuery(event);
  const gstin = String(query.gstin || '').trim();
  const forceRefresh = query.refresh === 'true' || query.refresh === '1';

  if (!gstin) {
    throw createError({ statusCode: 400, statusMessage: 'GSTIN is required' });
  }

  if (gstin.length !== 15) {
    throw createError({ statusCode: 400, statusMessage: 'GSTIN must be exactly 15 characters' });
  }

  try {
    const result = await lookupGstinWithCache(gstin, forceRefresh);
    return result;
  } catch (error: any) {
    console.error('[GST_LOOKUP] Error:', error.message);
    throw createError({
      statusCode: error.message?.includes('not configured') ? 500 : 502,
      statusMessage: error.message || 'Failed to reach GST lookup service',
    });
  }
});
