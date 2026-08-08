import { defineEventHandler, createError, getQuery } from 'h3';
import { requireSuperAdmin } from '../../../utils/admin-guard';

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event);

  const query = getQuery(event);
  const gstin = String(query.gstin || '').trim();

  if (!gstin) {
    throw createError({ statusCode: 400, statusMessage: 'GSTIN is required' });
  }

  const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
  if (!RAPIDAPI_KEY) {
    throw createError({ statusCode: 500, statusMessage: 'GST lookup service is not configured (RAPIDAPI_KEY missing).' });
  }

  try {
    const apiResponse = await fetch(
      `https://powerful-gstin-tool.p.rapidapi.com/v1/gstin/${gstin}/details`,
      { 
        method: 'GET', 
        headers: { 
          'x-rapidapi-key': RAPIDAPI_KEY, 
          'x-rapidapi-host': 'powerful-gstin-tool.p.rapidapi.com' 
        } 
      }
    );

    if (!apiResponse.ok) {
      const errBody = await apiResponse.text();
      console.error(`[GST_LOOKUP] RapidAPI returned ${apiResponse.status}:`, errBody);
      throw createError({ statusCode: 502, statusMessage: `GST lookup service returned an error (${apiResponse.status}).` });
    }

    const raw: any = await apiResponse.json();
    const businessData = raw?.data || raw?.result || raw;

    return {
      success: true,
      data: businessData
    };
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Failed to reach GST lookup service'
    });
  }
});
