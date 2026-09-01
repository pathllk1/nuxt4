/**
 * GST Accelerator API & CBIC Compliance Service
 * Connects directly to GST Accelerator Live API (https://gstaccelerator.in/docs)
 * Backed by Nitro Storage (Upstash Redis) caching.
 */
import fs from 'node:fs';
import path from 'node:path';

export interface GstinValidationResult {
  gstin: string;
  isValid: boolean;
  stateCode: string;
  stateName: string;
  pan: string;
  entityType?: string;
  checksumValid: boolean;
  message?: string;
  source: 'GST_ACCELERATOR_API' | 'REDIS_CACHE' | 'LOCAL_CHECKSUM_ONLY';
}

export interface HsnVerificationItem {
  hsn: string;
  description?: string;
  gstRate: number; // Applied in DayBook
  cbicRate?: number; // Official legal rate from CBIC
  cgstRate?: number;
  sgstRate?: number;
  igstRate?: number;
  cessRate?: number;
  notificationRef?: string;
  conditionApplied?: string | null;
  conditionWarning?: string | null;
  isMatched: boolean;
  isVerified: boolean;
  variancePct: number;
  needsReview: boolean;
  source: 'GST_ACCELERATOR_API' | 'REDIS_CACHE' | 'UNVERIFIED';
}

// Indian State Codes (01 to 38 + 97/99)
export const GST_STATE_MAP: Record<string, string> = {
  '01': 'Jammu and Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '25': 'Daman and Diu',
  '26': 'Dadra and Nagar Haveli',
  '27': 'Maharashtra',
  '28': 'Andhra Pradesh (Old)',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman and Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh (New)',
  '38': 'Ladakh',
  '97': 'Other Territory',
  '99': 'Centre Jurisdiction'
};

/**
 * Standard Indian GSTIN Mod-36 Checksum Verification
 */
export function validateGstinChecksum(gstin: string): boolean {
  if (!gstin || typeof gstin !== 'string') return false;
  const clean = gstin.trim().toUpperCase();
  if (clean.length !== 15) return false;

  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const charVal = chars.indexOf(clean[i] || '');
    if (charVal === -1) return false;
    const factor = charVal * ((i % 2 === 0) ? 1 : 2);
    sum += Math.floor(factor / 36) + (factor % 36);
  }
  const checkCode = (36 - (sum % 36)) % 36;
  return chars[checkCode] === clean[14];
}

/**
 * Helper to dynamically load .env key without restarting dev server
 */
function getLiveApiKey(): string {
  let key = process.env.GST_ACCELERATOR_API_KEY || process.env.NUXT_GST_ACCELERATOR_API_KEY || '';
  try {
    const config = useRuntimeConfig();
    if (config?.gstAcceleratorApiKey) {
      key = config.gstAcceleratorApiKey as string;
    }
  } catch (_) {}

  if (!key) {
    try {
      const envPath = path.resolve(process.cwd(), '.env');
      if (fs.existsSync(envPath)) {
        const text = fs.readFileSync(envPath, 'utf8');
        const m = text.match(/^GST_ACCELERATOR_API_KEY\s*=\s*(.*)$/m);
        if (m && m[1]) {
          key = m[1].trim().replace(/^['"]|['"]$/g, '');
        }
      }
    } catch (_) {}
  }
  return key;
}

/**
 * Helper to dynamically load base URL
 */
function getLiveBaseUrl(): string {
  let url = process.env.GST_ACCELERATOR_BASE_URL || 'https://gstaccelerator.in';
  try {
    const config = useRuntimeConfig();
    if (config?.gstAcceleratorBaseUrl) {
      url = config.gstAcceleratorBaseUrl as string;
    }
  } catch (_) {}

  if (!url || url === 'https://gstaccelerator.in') {
    try {
      const envPath = path.resolve(process.cwd(), '.env');
      if (fs.existsSync(envPath)) {
        const text = fs.readFileSync(envPath, 'utf8');
        const m = text.match(/^GST_ACCELERATOR_BASE_URL\s*=\s*(.*)$/m);
        if (m && m[1]) {
          url = m[1].trim().replace(/^['"]|['"]$/g, '');
        }
      }
    } catch (_) {}
  }
  return url;
}

/**
 * GST Accelerator Service - Redis Cache + Live API Only
 */
export class GstAcceleratorService {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = getLiveApiKey();
    this.baseUrl = getLiveBaseUrl();
  }

  isLiveApiConfigured(): boolean {
    // Re-check dynamically in case user just added the key
    if (!this.apiKey) {
      this.apiKey = getLiveApiKey();
    }
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  /**
   * Validate a GSTIN (checking Redis cache first, then GST Accelerator API)
   */
  async validateGstin(gstin: string): Promise<GstinValidationResult> {
    const clean = (gstin || '').trim().toUpperCase();
    if (!clean || clean.length !== 15) {
      return {
        gstin: clean,
        isValid: false,
        stateCode: '',
        stateName: 'Invalid Length',
        pan: '',
        checksumValid: false,
        message: 'GSTIN must be exactly 15 characters',
        source: 'LOCAL_CHECKSUM_ONLY'
      };
    }

    const stateCode = clean.slice(0, 2);
    const pan = clean.slice(2, 12);
    const stateName = GST_STATE_MAP[stateCode] || 'Unknown State';
    const checksumValid = validateGstinChecksum(clean);

    const cacheKey = `gst:gstin:${clean}`;
    try {
      const storage = useStorage('cache');
      const cached = await storage.getItem<GstinValidationResult>(cacheKey);
      if (cached) {
        return { ...cached, source: 'REDIS_CACHE' };
      }
    } catch (_) {}

    // Check API Key
    if (!this.apiKey) {
      this.apiKey = getLiveApiKey();
    }

    if (this.apiKey) {
      try {
        const response = await fetch(`${this.baseUrl}/api/v1/gstin/${clean}/validate`, {
          headers: { 'X-API-Key': this.apiKey }
        });
        if (response.ok) {
          const res: any = await response.json();
          const result: GstinValidationResult = {
            gstin: clean,
            isValid: Boolean(res.valid ?? res.is_valid ?? true),
            stateCode: res.state_code || stateCode,
            stateName: res.state_name || stateName,
            pan: res.pan || pan,
            entityType: res.entity_type || res.entity_type_code,
            checksumValid: Boolean(res.checksum_valid ?? checksumValid),
            message: res.error_reason || 'Verified via GST Accelerator API',
            source: 'GST_ACCELERATOR_API'
          };
          try {
            const storage = useStorage('cache');
            await storage.setItem(cacheKey, result, { ttl: 60 * 60 * 24 * 30 });
          } catch (_) {}
          return result;
        }
      } catch (err: any) {
        // API call error
      }
    }

    // Mathematical checksum if no API key configured
    return {
      gstin: clean,
      isValid: checksumValid && Boolean(GST_STATE_MAP[stateCode]),
      stateCode,
      stateName,
      pan,
      checksumValid,
      message: this.apiKey ? 'GSTIN verification failed at remote API' : 'Mod-36 Checksum (Live API key not set)',
      source: 'LOCAL_CHECKSUM_ONLY'
    };
  }

  /**
   * Bulk verify HSN codes strictly via Redis cache or GST Accelerator API
   */
  async verifyHsnBulk(hsnList: { hsn: string; gstRate: number }[]): Promise<HsnVerificationItem[]> {
    if (!hsnList || hsnList.length === 0) return [];

    const results: HsnVerificationItem[] = [];
    const missingInCache: { hsn: string; gstRate: number }[] = [];

    // 1. Check Redis storage cache first
    for (const item of hsnList) {
      const cleanHsn = (item.hsn || '').trim();
      const cacheKey = `gst:hsn:${cleanHsn}`;
      let cached: any = null;
      try {
        const storage = useStorage('cache');
        cached = await storage.getItem(cacheKey);
      } catch (_) {}

      if (cached) {
        const cbicRate = cached.gst_rate ?? cached.tax_rates?.igst ?? (cached.tax_rates?.cgst ? cached.tax_rates.cgst * 2 : undefined);
        const isMatched = cbicRate !== undefined && Math.abs(cbicRate - item.gstRate) < 0.01;
        results.push({
          hsn: cleanHsn,
          description: cached.hsn_description || cached.description,
          gstRate: item.gstRate,
          cbicRate,
          notificationRef: cached.notification_ref || cached.source,
          conditionApplied: cached.condition_text || cached.condition_applied,
          conditionWarning: cached.condition_warning,
          isMatched,
          isVerified: true,
          variancePct: cbicRate !== undefined ? cbicRate - item.gstRate : 0,
          needsReview: !isMatched,
          source: 'REDIS_CACHE'
        });
      } else {
        missingInCache.push(item);
      }
    }

    if (missingInCache.length === 0) {
      return results;
    }

    // Check API Key
    if (!this.apiKey) {
      this.apiKey = getLiveApiKey();
    }

    // 2. Query GST Accelerator API for each missing HSN
    for (const item of missingInCache) {
      const cleanHsn = item.hsn.trim();
      let matchedEntry: any = null;

      if (this.apiKey) {
        try {
          const response = await fetch(`${this.baseUrl}/api/v1/hsn/${encodeURIComponent(cleanHsn)}`, {
            headers: { 'X-API-Key': this.apiKey }
          });

          if (response.ok) {
            const apiRes: any = await response.json();
            if (Array.isArray(apiRes) && apiRes.length > 0) {
              matchedEntry = apiRes.find(e => e.tax_rates && e.tax_rates.igst !== null) ||
                             apiRes.find(e => e.gst_rate !== null && e.gst_rate !== undefined) ||
                             apiRes[0];
            }
          }
        } catch (err: any) {
          // If 404 or fetch error
        }
      }

      if (matchedEntry) {
        const cbicRate = matchedEntry.gst_rate ?? matchedEntry.tax_rates?.igst ?? (matchedEntry.tax_rates?.cgst ? matchedEntry.tax_rates.cgst * 2 : undefined);
        const isMatched = cbicRate !== undefined && Math.abs(cbicRate - item.gstRate) < 0.01;

        const resItem: HsnVerificationItem = {
          hsn: cleanHsn,
          description: matchedEntry.hsn_description || matchedEntry.description,
          gstRate: item.gstRate,
          cbicRate,
          cgstRate: matchedEntry.tax_rates?.cgst ?? matchedEntry.cgst,
          sgstRate: matchedEntry.tax_rates?.sgst ?? matchedEntry.sgst,
          igstRate: matchedEntry.tax_rates?.igst ?? matchedEntry.igst,
          cessRate: matchedEntry.tax_rates?.cess ?? 0,
          notificationRef: matchedEntry.notification_ref || matchedEntry.source,
          conditionApplied: matchedEntry.condition_text || matchedEntry.condition_applied,
          conditionWarning: matchedEntry.condition_warning,
          isMatched,
          isVerified: cbicRate !== undefined,
          variancePct: cbicRate !== undefined ? cbicRate - item.gstRate : 0,
          needsReview: !isMatched || Boolean(matchedEntry.needs_review),
          source: 'GST_ACCELERATOR_API'
        };
        results.push(resItem);

        // Cache in Redis for 30 days
        try {
          const storage = useStorage('cache');
          await storage.setItem(`gst:hsn:${cleanHsn}`, matchedEntry, { ttl: 60 * 60 * 24 * 30 });
        } catch (_) {}
      } else {
        results.push({
          hsn: cleanHsn,
          description: undefined,
          gstRate: item.gstRate,
          cbicRate: undefined,
          notificationRef: undefined,
          conditionApplied: null,
          conditionWarning: this.apiKey
            ? 'HSN not found in live CBIC directory'
            : 'Unverified: GST_ACCELERATOR_API_KEY missing in .env',
          isMatched: false,
          isVerified: false,
          variancePct: 0,
          needsReview: true,
          source: 'UNVERIFIED'
        });
      }
    }

    return results;
  }

  /**
   * Search HSN description strictly via GST Accelerator API
   */
  async autocomplete(query: string): Promise<{ hsn_code: string; hsn_description: string }[]> {
    if (!query || query.trim().length < 2) return [];
    if (!this.apiKey) this.apiKey = getLiveApiKey();
    if (!this.apiKey) return [];

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/autocomplete?q=${encodeURIComponent(query.trim())}`, {
        headers: { 'X-API-Key': this.apiKey }
      });
      if (response.ok) {
        const res: any = await response.json();
        if (Array.isArray(res)) return res;
      }
    } catch (_) {}

    return [];
  }
}
