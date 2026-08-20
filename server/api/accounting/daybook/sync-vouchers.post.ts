import { defineEventHandler, readBody, createError } from 'h3';
import mongoose from 'mongoose';
import Party from '../../../models/Party';
import Bill from '../../../models/Bill';
import GstinCache from '../../../models/GstinCache';
import { lookupGstinWithCache } from '../../../utils/gstin-cache';
import { extractGstDetails } from '../../../utils/accounting/gst-address-helper';
import { requireAuthSession } from '../../../utils/auth';
import { connectDB } from '../../../plugins/mongodb';

export default defineEventHandler(async (event) => {
  const user = await requireAuthSession(event);
  const body = await readBody(event) || {};
  const { vouchers } = body;

  if (!Array.isArray(vouchers) || vouchers.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No vouchers provided for verification.' });
  }

  await connectDB();

  const firmIdObj = new mongoose.Types.ObjectId(String(user.firm_id));

  // 1. Extract Unique GSTINs, PANs, and Voucher Numbers
  const uniqueGstins = Array.from(
    new Set(
      vouchers
        .map((v: any) => String(v.gstin || '').trim().toUpperCase())
        .filter((g: string) => g && g !== 'UNREGISTERED' && g.length === 15)
    )
  );

  const uniquePans = Array.from(
    new Set(
      uniqueGstins.map((g) => g.substring(2, 12)).filter((p) => p && p.length === 10)
    )
  );

  const voucherNumbers = Array.from(
    new Set(
      vouchers
        .map((v: any) => String(v.voucherNumber || '').trim())
        .filter(Boolean)
    )
  );

  // 2. Query Existing Parties in this Firm
  const existingParties = await Party.find({
    firmId: firmIdObj,
    $or: [
      { gstin: { $in: uniqueGstins } },
      { pan: { $in: uniquePans } },
      { 'gstLocations.gstin': { $in: uniqueGstins } }
    ]
  }).lean();

  const partyByGstinMap = new Map<string, any>();
  const partyByPanMap = new Map<string, any>();

  existingParties.forEach((p: any) => {
    if (p.gstin && p.gstin !== 'UNREGISTERED') {
      partyByGstinMap.set(p.gstin.toUpperCase(), p);
    }
    if (Array.isArray(p.gstLocations)) {
      p.gstLocations.forEach((loc: any) => {
        if (loc.gstin) {
          partyByGstinMap.set(loc.gstin.toUpperCase(), p);
        }
      });
    }
    if (p.pan) {
      partyByPanMap.set(p.pan.toUpperCase(), p);
    }
  });

  // 3. Query MongoDB GSTIN Cache
  const cachedGstinDocs = await GstinCache.find({
    gstin: { $in: uniqueGstins }
  }).lean();

  const gstinCacheMap = new Map<string, any>();
  cachedGstinDocs.forEach((c: any) => {
    gstinCacheMap.set(c.gstin.toUpperCase(), c);
  });

  // 4. Query Existing Bills in this Firm
  const existingBills = await Bill.find({
    firmId: firmIdObj,
    bno: { $in: voucherNumbers },
    btype: 'SALES',
    status: { $ne: 'CANCELLED' }
  })
    .select('_id bno bdate netTotal status partyName partyGstin')
    .lean();

  const existingBillMap = new Map<string, any>();
  existingBills.forEach((b: any) => {
    if (b.bno) {
      existingBillMap.set(String(b.bno).trim().toUpperCase(), b);
    }
  });

  // 5. Resolve Missing GSTINs via RapidAPI (Throttled: 1 request every 1.1s to respect rate limit)
  const gstinsToFetch = uniqueGstins.filter((g) => {
    const cached = gstinCacheMap.get(g);
    const isFreshCache = cached && new Date(cached.expiresAt) > new Date();
    return !isFreshCache;
  });

  const resolvedGstMap = new Map<string, any>();

  for (let i = 0; i < gstinsToFetch.length; i++) {
    const gstin = gstinsToFetch[i];
    if (!gstin) continue;
    try {
      if (i > 0) {
        await new Promise((resolve) => setTimeout(resolve, 1100));
      }
      const res = await lookupGstinWithCache(gstin);
      if (res?.data) {
        resolvedGstMap.set(gstin, res.data);
      }
    } catch (err: any) {
      console.warn(`[DAYBOOK_SYNC] RapidAPI lookup failed for ${gstin}:`, err.message);
    }
  }

  // 6. Build Master Party Verification Map
  const partiesResult: Record<string, any> = {};

  uniqueGstins.forEach((gstin) => {
    const pan = gstin.substring(2, 12);
    const existingParty = partyByGstinMap.get(gstin) || partyByPanMap.get(pan);

    // Get GSTIN details from fresh fetch or cache
    let rawGstData = resolvedGstMap.get(gstin);
    if (!rawGstData) {
      const cached = gstinCacheMap.get(gstin);
      rawGstData = cached?.rawData?.data || cached?.rawData?.result || cached?.rawData;
    }

    let gstDetails = rawGstData ? extractGstDetails(rawGstData) : null;

    const verifiedName = gstDetails?.tradeName || gstDetails?.legalName || existingParty?.name || '';
    const legalName = gstDetails?.legalName || '';
    const tradeName = gstDetails?.tradeName || '';

    partiesResult[gstin] = {
      partyExists: !!existingParty,
      partyId: existingParty?._id?.toString() || null,
      partyNameInDb: existingParty?.name || null,
      verifiedName: verifiedName || null,
      tradeName,
      legalName,
      gstStatus: gstDetails?.status || (existingParty ? 'ACTIVE' : 'UNKNOWN'),
      state: gstDetails?.state || existingParty?.state || '',
      address: gstDetails?.address || existingParty?.address || '',
      isGstVerified: !!(gstDetails?.tradeName || gstDetails?.legalName)
    };
  });

  // 7. Build Master Bill Verification Map
  const billsResult: Record<string, any> = {};
  voucherNumbers.forEach((vNo) => {
    const norm = vNo.trim().toUpperCase();
    const existing = existingBillMap.get(norm);
    if (existing) {
      billsResult[vNo] = {
        billExists: true,
        billId: existing._id.toString(),
        bno: existing.bno,
        bdate: existing.bdate,
        netTotal: existing.netTotal,
        status: existing.status
      };
    } else {
      billsResult[vNo] = {
        billExists: false,
        billId: null
      };
    }
  });

  // 8. Calculate Overall Stats
  const existingBillsCount = Object.values(billsResult).filter((b: any) => b.billExists).length;
  const newBillsCount = voucherNumbers.length - existingBillsCount;
  const existingPartiesCount = Object.values(partiesResult).filter((p: any) => p.partyExists).length;
  const newPartiesCount = uniqueGstins.length - existingPartiesCount;

  return {
    success: true,
    parties: partiesResult,
    bills: billsResult,
    stats: {
      totalVouchers: voucherNumbers.length,
      existingBillsCount,
      newBillsCount,
      totalGstins: uniqueGstins.length,
      existingPartiesCount,
      newPartiesCount
    }
  };
});
