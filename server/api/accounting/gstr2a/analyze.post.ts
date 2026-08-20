import { defineEventHandler, readBody, createError } from 'h3';
import mongoose from 'mongoose';
import Party from '../../../models/Party';
import Bill from '../../../models/Bill';
import GstinCache from '../../../models/GstinCache';
import { parseGstr2aCsv, type Gstr2aParsedInvoice } from '../../../utils/accounting/gstr2a-parser';
import { lookupGstinWithCache } from '../../../utils/gstin-cache';
import { extractGstDetails, GST_STATE_CODE_MAP } from '../../../utils/accounting/gst-address-helper';
import { requireAuthSession } from '../../../utils/auth';
import { connectDB } from '../../../plugins/mongodb';

export default defineEventHandler(async (event) => {
  const user = await requireAuthSession(event);
  const body = await readBody(event) || {};
  const { csvText, invoices: providedInvoices, firmGstin } = body;
  const normFirmGstin = firmGstin ? String(firmGstin).trim().toUpperCase() : undefined;

  await connectDB();

  const firmIdObj = new mongoose.Types.ObjectId(String(user.firm_id));

  // 1. Parse CSV or use provided parsed invoices
  let parsedInvoices: Gstr2aParsedInvoice[] = [];
  let skippedSummaryRows = 0;
  let parseErrors: string[] = [];

  if (csvText) {
    const parseResult = parseGstr2aCsv(csvText);
    if (parseResult.errors?.length && !parseResult.invoices?.length) {
      throw createError({ statusCode: 400, statusMessage: parseResult.errors[0] || 'Parsing failed' });
    }
    parsedInvoices = parseResult.invoices;
    skippedSummaryRows = parseResult.skippedSummaryRows;
    parseErrors = parseResult.errors;
  } else if (Array.isArray(providedInvoices) && providedInvoices.length > 0) {
    parsedInvoices = providedInvoices;
  } else {
    throw createError({ statusCode: 400, statusMessage: 'No CSV content or invoice data provided.' });
  }

  if (!parsedInvoices.length) {
    throw createError({ statusCode: 400, statusMessage: 'No valid invoices found in the uploaded file.' });
  }

  // 2. Extract Unique GSTINs, Invoice Numbers, and POS Distribution
  const uniqueGstins = Array.from(new Set(parsedInvoices.map(i => i.gstin).filter(Boolean)));
  const invoiceNumbers = Array.from(new Set(parsedInvoices.map(i => i.invoiceNo).filter(Boolean)));

  const posCounts = new Map<string, number>();
  parsedInvoices.forEach(i => {
    const pos = (i.placeOfSupply || '').trim();
    if (pos) {
      posCounts.set(pos, (posCounts.get(pos) || 0) + 1);
    }
  });

  let primaryPos = '';
  let maxPosCount = 0;
  posCounts.forEach((count, pos) => {
    if (count > maxPosCount) {
      maxPosCount = count;
      primaryPos = pos;
    }
  });

  // 3. Batch Query Existing Parties in this Firm (by GSTIN, PAN, or secondary locations)
  const uniquePans = Array.from(new Set(uniqueGstins.map(g => g.substring(2, 12)).filter(p => p && p.length === 10)));

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

  existingParties.forEach(p => {
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

  // 4. Batch Query MongoDB GSTIN Cache
  const cachedGstinDocs = await GstinCache.find({
    gstin: { $in: uniqueGstins }
  }).lean();

  const gstinCacheMap = new Map<string, any>();
  cachedGstinDocs.forEach(c => {
    gstinCacheMap.set(c.gstin.toUpperCase(), c);
  });

  // 5. Query Existing Purchase Bills in this Firm (Scoped to Firm GSTIN if provided)
  const billFilter: any = {
    firmId: firmIdObj,
    btype: { $in: ['PURCHASE', 'DEBIT_NOTE'] },
    status: { $ne: 'CANCELLED' },
    supplierBillNo: { $in: invoiceNumbers }
  };
  if (normFirmGstin) {
    billFilter.$or = [
      { firmGstin: normFirmGstin },
      { firmGstin: { $exists: false } },
      { firmGstin: null },
      { firmGstin: '' }
    ];
  }

  const existingBills = await Bill.find(billFilter)
    .select('_id bno supplierBillNo partyId partyGstin firmGstin netTotal bdate status btype')
    .lean();

  // Create a composite lookup for existing bills: "SUPPLIERBILLNO_GSTIN" and "SUPPLIERBILLNO_PARTYID"
  const existingBillMap = new Map<string, any>();
  existingBills.forEach(b => {
    if (b.supplierBillNo) {
      const normSuppNo = b.supplierBillNo.trim().toUpperCase();
      if (b.partyGstin) {
        existingBillMap.set(`${normSuppNo}_${b.partyGstin.toUpperCase()}`, b);
      }
      if (b.partyId) {
        existingBillMap.set(`${normSuppNo}_${b.partyId.toString()}`, b);
      }
      // General fallback by bill number
      existingBillMap.set(normSuppNo, b);
    }
  });

  // 6. Resolve Missing GSTINs via RapidAPI (Throttled: 1 request every 1.1s to respect Basic plan rate limit)
  const gstinsToFetch = uniqueGstins.filter((g) => {
    // Only fetch if NOT in party master and NOT in fresh GstinCache
    const hasParty = partyByGstinMap.has(g);
    const cached = gstinCacheMap.get(g);
    const isFreshCache = cached && new Date(cached.expiresAt) > new Date();
    return !hasParty && !isFreshCache;
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
      console.warn(`[GSTR2A_ANALYZE] RapidAPI lookup failed for ${gstin}:`, err.message);
    }
  }

  // 7. Enrich each parsed invoice with Party details & Bill duplicate status
  let newBillsCount = 0;
  let existingBillsCount = 0;
  let itcRiskCount = 0;
  let creditNotesCount = 0;
  const newPartiesSet = new Set<string>();
  const existingPartiesSet = new Set<string>();

  const enrichedInvoices = parsedInvoices.map((inv) => {
    const normGstin = inv.gstin.toUpperCase();
    const pan = normGstin.substring(2, 12);
    const existingParty = partyByGstinMap.get(normGstin) || partyByPanMap.get(pan);

    let partyStatus: 'EXISTING_PARTY' | 'NEW_PARTY' = 'NEW_PARTY';
    let partyId: string | null = null;
    let partyName = '';
    let partyState = '';
    let partyStateCode = inv.supplierStateCode || normGstin.substring(0, 2);
    let partyAddress = '';
    let partyPin = '';
    let partyPan = pan;
    let isNewLocation = false;

    if (existingParty) {
      partyStatus = 'EXISTING_PARTY';
      partyId = existingParty._id.toString();
      partyName = existingParty.name;
      partyState = existingParty.state || GST_STATE_CODE_MAP[partyStateCode] || '';
      partyStateCode = existingParty.stateCode || partyStateCode;
      partyAddress = existingParty.address || '';
      partyPin = existingParty.pin || '';
      partyPan = existingParty.pan || partyPan;
      
      const hasGstinLocation = existingParty.gstin === normGstin ||
        (Array.isArray(existingParty.gstLocations) && existingParty.gstLocations.some((l: any) => l.gstin === normGstin));
      if (!hasGstinLocation) {
        isNewLocation = true;
      }
      existingPartiesSet.add(normGstin);
    } else {
      partyStatus = 'NEW_PARTY';
      newPartiesSet.add(normGstin);

      // Check RapidAPI fresh resolved data or MongoDB GstinCache
      const freshData = resolvedGstMap.get(normGstin);
      const cacheDoc = gstinCacheMap.get(normGstin);
      const rawData = freshData || cacheDoc?.rawData;
      
      if (rawData) {
        const details = extractGstDetails(rawData, normGstin);
        partyName = details.displayName;
        partyAddress = details.address || inv.placeOfSupply || '';
        partyPin = details.pincode || '';
        partyState = details.state || inv.placeOfSupply || '';
        partyPan = details.pan || partyPan;
      } else {
        partyName = `Vendor (${normGstin})`;
        partyAddress = inv.placeOfSupply || '';
        partyState = inv.placeOfSupply || '';
      }
    }

    // Check Bill Duplicate Status
    const normInvNo = inv.invoiceNo.trim().toUpperCase();
    const matchedBill = existingBillMap.get(`${normInvNo}_${normGstin}`) ||
                       (partyId ? existingBillMap.get(`${normInvNo}_${partyId}`) : null) ||
                       existingBillMap.get(normInvNo);

    let billStatus: 'NEW_BILL' | 'ALREADY_EXISTS' = 'NEW_BILL';
    let existingBillNo: string | undefined;
    let existingBillId: string | undefined;

    if (matchedBill) {
      billStatus = 'ALREADY_EXISTS';
      existingBillNo = matchedBill.bno;
      existingBillId = matchedBill._id.toString();
      existingBillsCount++;
    } else {
      billStatus = 'NEW_BILL';
      newBillsCount++;
    }

    // Rule 37A Compliance: Check if supplier has not filed GSTR-3B
    const itcRisk = inv.gstr3bFilingStatus === 'N';
    if (itcRisk) {
      itcRiskCount++;
    }

    const docType = inv.docType || (inv.invoiceType === 'C' ? 'CREDIT_NOTE' : 'INVOICE');
    if (docType === 'CREDIT_NOTE') {
      creditNotesCount++;
    }

    return {
      ...inv,
      docType,
      itcRisk,
      partyStatus,
      isNewLocation,
      partyId,
      partyName,
      partyGstin: normGstin,
      partyState,
      partyStateCode,
      partyAddress,
      partyPin,
      partyPan,
      billStatus,
      existingBillNo,
      existingBillId,
      selected: billStatus === 'NEW_BILL' // Pre-select all new bills
    };
  });

  const totals = enrichedInvoices.reduce(
    (acc, inv) => {
      acc.taxable += inv.grossTotal;
      acc.cgst += inv.cgst;
      acc.sgst += inv.sgst;
      acc.igst += inv.igst;
      acc.cess += inv.cess || 0;
      acc.value += inv.netTotal;
      return acc;
    },
    { taxable: 0, cgst: 0, sgst: 0, igst: 0, cess: 0, value: 0 }
  );

  return {
    success: true,
    data: {
      invoices: enrichedInvoices,
      summary: {
        totalInvoices: enrichedInvoices.length,
        totalTaxable: Number(totals.taxable.toFixed(2)),
        totalCgst: Number(totals.cgst.toFixed(2)),
        totalSgst: Number(totals.sgst.toFixed(2)),
        totalIgst: Number(totals.igst.toFixed(2)),
        totalCess: Number(totals.cess.toFixed(2)),
        totalValue: Number(totals.value.toFixed(2)),
        newBillsCount,
        existingBillsCount,
        itcRiskCount,
        creditNotesCount,
        newPartiesCount: newPartiesSet.size,
        existingPartiesCount: existingPartiesSet.size,
        primaryPos,
        posBreakdown: Object.fromEntries(posCounts),
        skippedSummaryRows,
        errors: parseErrors
      }
    }
  };
});
