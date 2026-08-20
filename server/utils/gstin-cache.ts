import GstinCache, { CACHE_TTL_DAYS } from '../models/GstinCache';
import { extractGstDetails } from './accounting/gst-address-helper';

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[0-9A-Z]{1}Z[0-9A-Z]{1}$/;

interface GstinLookupResult {
  success: boolean;
  data: any;
  cached: boolean;
  stale?: boolean;
}

/**
 * Extract denormalized fields from raw RapidAPI response for quick reference.
 */
function extractDenormalized(rawData: any) {
  const details = extractGstDetails(rawData);
  return {
    tradeName: details.tradeName,
    legalName: details.legalName,
    status: details.status,
    state: details.state,
  };
}

/**
 * Cache-first GSTIN lookup with RapidAPI fallback.
 * 
 * Flow:
 * 1. Validate GSTIN format
 * 2. Check MongoDB cache
 * 3. If fresh cache hit → return cached data
 * 4. If cache miss or stale → call RapidAPI
 * 5. On RapidAPI success → upsert cache, return fresh data
 * 6. On RapidAPI failure + stale cache → return stale data
 * 7. On RapidAPI failure + no cache → throw error
 */
export async function lookupGstinWithCache(
  gstin: string,
  forceRefresh: boolean = false
): Promise<GstinLookupResult> {
  const normalizedGstin = gstin.trim().toUpperCase();

  // 1. Validate format
  if (!normalizedGstin || normalizedGstin.length !== 15) {
    throw new Error('GSTIN must be exactly 15 characters');
  }
  if (!GSTIN_REGEX.test(normalizedGstin)) {
    throw new Error('Invalid GSTIN format');
  }

  // 2. Check cache (skip if force refresh)
  if (!forceRefresh) {
    try {
      const cached = await GstinCache.findOne({ gstin: normalizedGstin });

      if (cached) {
        const now = new Date();
        const isFresh = cached.expiresAt > now;

        if (isFresh) {
          // 3. Fresh cache hit — serve immediately
          console.log(`[GST_CACHE] Cache HIT (fresh) for ${normalizedGstin}`);
          await GstinCache.updateOne(
            { _id: cached._id },
            { $inc: { fetchCount: 1 }, $set: { lastAccessedAt: now } }
          );

          const businessData = cached.rawData?.data || cached.rawData?.result || cached.rawData;
          return { success: true, data: businessData, cached: true };
        }

        // Cache exists but is stale — try RapidAPI, fall back to stale
        console.log(`[GST_CACHE] Cache STALE for ${normalizedGstin}, attempting refresh...`);
        try {
          const freshResult = await fetchFromRapidApi(normalizedGstin);
          await upsertCache(normalizedGstin, freshResult);
          const businessData = freshResult?.data || freshResult?.result || freshResult;
          return { success: true, data: businessData, cached: false };
        } catch (apiErr) {
          // RapidAPI failed — serve stale cache
          console.warn(`[GST_CACHE] RapidAPI failed, serving stale cache for ${normalizedGstin}`);
          await GstinCache.updateOne(
            { _id: cached._id },
            { $inc: { fetchCount: 1 }, $set: { lastAccessedAt: now } }
          );
          const businessData = cached.rawData?.data || cached.rawData?.result || cached.rawData;
          return { success: true, data: businessData, cached: true, stale: true };
        }
      }
    } catch (dbErr) {
      console.warn(`[GST_CACHE] MongoDB cache check failed, falling through to RapidAPI:`, dbErr);
      // Continue to RapidAPI if cache lookup itself fails
    }
  }

  // 4. Cache miss (or force refresh) — call RapidAPI
  console.log(`[GST_CACHE] Cache MISS for ${normalizedGstin}, fetching from RapidAPI...`);
  const freshResult = await fetchFromRapidApi(normalizedGstin);

  // 5. Cache the result
  await upsertCache(normalizedGstin, freshResult).catch((err) => {
    console.error(`[GST_CACHE] Failed to cache result for ${normalizedGstin}:`, err);
    // Don't fail the request if caching fails
  });

  const businessData = freshResult?.data || freshResult?.result || freshResult;
  return { success: true, data: businessData, cached: false };
}

/**
 * Fetch GSTIN details from RapidAPI with automatic retry on 429 rate limit.
 */
async function fetchFromRapidApi(gstin: string, retries: number = 2): Promise<any> {
  const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
  if (!RAPIDAPI_KEY) {
    throw new Error('GST lookup service is not configured (RAPIDAPI_KEY missing).');
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    const apiResponse = await fetch(
      `https://powerful-gstin-tool.p.rapidapi.com/v1/gstin/${gstin}/details`,
      {
        method: 'GET',
        headers: {
          'x-rapidapi-key': RAPIDAPI_KEY,
          'x-rapidapi-host': 'powerful-gstin-tool.p.rapidapi.com',
        },
      }
    );

    if (apiResponse.status === 429) {
      if (attempt < retries) {
        const delayMs = 1200 * (attempt + 1);
        console.warn(`[GST_CACHE] Rate limited (429) on ${gstin}. Backing off for ${delayMs}ms (attempt ${attempt + 1}/${retries})...`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }
    }

    if (!apiResponse.ok) {
      const errBody = await apiResponse.text();
      console.error(`[GST_CACHE] RapidAPI returned ${apiResponse.status}:`, errBody);
      throw new Error(`GST lookup service returned an error (${apiResponse.status}).`);
    }

    const raw = await apiResponse.json();
    return raw;
  }
}

/**
 * Upsert the GSTIN cache entry in MongoDB.
 */
async function upsertCache(gstin: string, rawData: any): Promise<void> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + CACHE_TTL_DAYS * 24 * 60 * 60 * 1000);
  const denormalized = extractDenormalized(rawData);

  await GstinCache.findOneAndUpdate(
    { gstin },
    {
      $set: {
        rawData,
        ...denormalized,
        source: 'rapidapi',
        fetchedAt: now,
        expiresAt,
        lastAccessedAt: now,
      },
      $inc: { fetchCount: 1 },
    },
    { upsert: true, returnDocument: 'after' }
  );

  console.log(`[GST_CACHE] Cached/updated ${gstin} (expires ${expiresAt.toISOString()})`);
}
