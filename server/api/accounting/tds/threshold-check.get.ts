import { defineEventHandler, getQuery, createError } from 'h3';
import mongoose from 'mongoose';
import Ledger from '../../../models/Ledger';
import Party from '../../../models/Party';
import ChartOfAccounts from '../../../models/ChartOfAccounts';
import { requireAuthSession } from '../../../utils/auth';
import { getSql, connectPostgres } from '../../../utils/pg.config';
import { TdsCalculator } from '../../../utils/accounting/tds-calculator';

export default defineEventHandler(async (event) => {
  try {
    const session = await requireAuthSession(event);
    const firmIdObj = new mongoose.Types.ObjectId(String(session.firm_id));
    const query = getQuery(event);

    const accountHead = query.accountHead ? String(query.accountHead).trim() : '';
    const leaderId = query.leaderId ? String(query.leaderId).trim() : '';
    const partyId = query.partyId ? String(query.partyId).trim() : '';

    if (!accountHead && !partyId && !leaderId) {
      throw createError({ statusCode: 400, statusMessage: 'accountHead, partyId, or leaderId is required' });
    }

    // Strict Calendar Round-Trip Validation (F-03)
    const paymentDate = String(query.paymentDate || new Date().toISOString().split('T')[0]).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(paymentDate)) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid paymentDate format. Expected YYYY-MM-DD.' });
    }
    const [yStr, mStr, dStr] = paymentDate.split('-');
    const y = Number(yStr);
    const m = Number(mStr);
    const d = Number(dStr);
    const pDate = new Date(Date.UTC(y, m - 1, d));
    if (pDate.getUTCFullYear() !== y || pDate.getUTCMonth() !== m - 1 || pDate.getUTCDate() !== d) {
      throw createError({ statusCode: 400, statusMessage: `Calendar date "${paymentDate}" does not exist.` });
    }

    // Strict Numeric Amount Parsing (F-03: rejects alphanumeric prefixes/suffixes like "1000abc")
    const amountStr = query.amount !== undefined ? String(query.amount).trim() : '0';
    if (!/^\d+(\.\d+)?$/.test(amountStr)) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid amount. Must be a strictly formatted non-negative number.' });
    }
    const currentAmount = Number(amountStr);

    // Strict Custom Rate Bounds (F-03: Section 194C statutory bounds: 0% to 20%)
    let customRate: number | null = null;
    if (query.rate !== undefined && query.rate !== null && query.rate !== '') {
      const rateStr = String(query.rate).trim();
      if (!/^\d+(\.\d+)?$/.test(rateStr)) {
        throw createError({ statusCode: 400, statusMessage: 'Invalid rate parameter. Must be a strictly formatted number.' });
      }
      customRate = Number(rateStr);
      if (!Number.isFinite(customRate) || customRate < 0 || customRate > 20) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Invalid rate parameter for Section 194C. Must be a valid statutory rate between 0% and 20%.'
        });
      }
    }

    // Resolve Canonical Deductee Identity with Strict Firm Scoping (F-03)
    let detectedPan = '';
    let partyName = accountHead;
    let resolvedPartyId: mongoose.Types.ObjectId | null = null;
    let resolvedAccountHead: string | null = null;

    if (partyId) {
      if (!mongoose.Types.ObjectId.isValid(partyId)) {
        throw createError({ statusCode: 400, statusMessage: `Invalid partyId format: "${partyId}"` });
      }
      resolvedPartyId = new mongoose.Types.ObjectId(partyId);
      // STRICT: Firm-scoped lookup prevents cross-tenant party leakage (F-03)
      const pDoc = await Party.findOne({
        _id: resolvedPartyId,
        $or: [{ firmId: firmIdObj }, { firm_id: firmIdObj }]
      }).lean();
      if (!pDoc) {
        throw createError({ statusCode: 404, statusMessage: `Party "${partyId}" not found in current firm.` });
      }
      if (pDoc.pan) detectedPan = pDoc.pan;
      if (pDoc.name) partyName = pDoc.name;
      resolvedAccountHead = pDoc.name;
    } else if (leaderId) {
      // Resolve PostgreSQL labor_leaders for this leaderId strictly within current firm
      try {
        let sql = getSql();
        if (!sql) sql = await connectPostgres();
        if (sql) {
          const [leader] = await sql`
            SELECT id, name, pan FROM labor_leaders WHERE id = ${leaderId} AND firm_id = ${String(firmIdObj)} LIMIT 1
          `;
          if (leader) {
            partyName = leader.name;
            resolvedAccountHead = leader.name;
            if (leader.pan) detectedPan = leader.pan;
          }
        }
      } catch (err: any) {
        console.warn('[TDS Threshold] Postgres leader lookup warning:', err.message);
      }

      // STRICT: Fail closed if leader cannot be resolved (F-03)
      if (!resolvedAccountHead) {
        throw createError({
          statusCode: 404,
          statusMessage: `Labor leader "${leaderId}" could not be verified in current firm or labor database is unavailable.`
        });
      }
    } else if (accountHead) {
      resolvedAccountHead = accountHead;
    }

    // STRICT INVARIANT (F-03): A specific deductee must be established to avoid firm-wide fallback
    if (!resolvedPartyId && !resolvedAccountHead) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Could not resolve a valid firm-scoped deductee identity.'
      });
    }

    // 1. Determine Financial Year boundaries (April 1 to March 31)
    const fyStartYear = m >= 4 ? y : y - 1;
    const fyStartDate = `${fyStartYear}-04-01`;
    const fyEndDate = `${fyStartYear + 1}-03-31`;
    const fyString = `${fyStartYear}-${String(fyStartYear + 1).slice(-2)}`;

    // 2. Query Prior YTD Payments in General Ledger for this Financial Year
    // Capped at paymentDate, strictly scoped to deductee, and restricted to 194C-eligible commercial/contractor transactions (F-04)
    const matchFilter: any = {
      $or: [{ firmId: firmIdObj }, { firm_id: firmIdObj }],
      transactionDate: { $gte: fyStartDate, $lte: paymentDate },
      debitAmount: { $gt: 0 },
      isReversed: { $ne: true }, // Compatible with both legacy (null) and indexed (false) active rows (F-07)
      refType: { $ne: 'REVERSAL' },
      accountType: { $nin: ['DUTIES_AND_TAXES', 'TAX', 'GST', 'ROUND_OFF', 'CAPITAL', 'BANK', 'CASH'] }
    };

    if (resolvedPartyId) {
      matchFilter.partyId = resolvedPartyId;
    } else if (resolvedAccountHead) {
      matchFilter.accountHead = resolvedAccountHead;
    }

    const priorEntries = await Ledger.find(matchFilter, 'debitAmount transactionDate narration voucherGroupId accountHead partyId').lean();
    const priorYtd = priorEntries.reduce((sum: number, e: any) => sum + (Number(e.debitAmount) || 0), 0);

    // Compute how much prior payment has ALREADY suffered TDS for THIS deductee and section 194C (F-04)
    const vgIds = Array.from(new Set(priorEntries.map(e => e.voucherGroupId).filter((id): id is string => Boolean(id))));
    let priorAlreadyTaxedAmount = 0;
    if (vgIds.length > 0) {
      const priorTdsLegs = await Ledger.find({
        $and: [
          { $or: [{ firmId: firmIdObj }, { firm_id: firmIdObj }] },
          { voucherGroupId: { $in: vgIds } },
          { creditAmount: { $gt: 0 } },
          { isReversed: { $ne: true } },
          {
            $or: [
              { 'statutory.tdsSection': '194C' },
              { 'statutory.isTds': true, 'statutory.tdsSection': { $in: ['194C', null] } },
              { accountHead: { $regex: /\b(194c|contractor|subcontractor)\b/i } },
              { accountHead: { $regex: /\btds payable\b/i } }
            ]
          },
          {
            accountHead: {
              $not: /\b(gst|cgst|sgst|igst|cess|tcs|194j|194i|194h|194a|borne by company)\b/i
            }
          }
        ]
      }, 'voucherGroupId statutory accountHead creditAmount narration').lean();

      const tdsLegsByVg = new Map<string, any[]>();
      for (const tLeg of priorTdsLegs) {
        const vgId = tLeg.voucherGroupId ? String(tLeg.voucherGroupId) : '';
        if (vgId) {
          if (!tdsLegsByVg.has(vgId)) tdsLegsByVg.set(vgId, []);
          tdsLegsByVg.get(vgId)!.push(tLeg);
        }
      }

      for (const entry of priorEntries) {
        const vg = entry.voucherGroupId;
        if (!vg) continue;
        const matchingTdsList = tdsLegsByVg.get(vg);
        if (!matchingTdsList || matchingTdsList.length === 0) continue;

        // Deductee-specific tax matching on exact statutory identity (F-04)
        const matchedTdsLeg = matchingTdsList.find((tLeg: any) => {
          if (tLeg.statutory) {
            if (resolvedPartyId && tLeg.statutory.deducteeId && String(tLeg.statutory.deducteeId) === String(resolvedPartyId)) return true;
            if (detectedPan && tLeg.statutory.pan && tLeg.statutory.pan.toUpperCase() === detectedPan.toUpperCase()) return true;
            if (resolvedAccountHead && tLeg.statutory.deducteeName && tLeg.statutory.deducteeName.trim().toLowerCase() === resolvedAccountHead.trim().toLowerCase()) return true;
          }
          // Legacy check: exact whole-name regex in narration (prevent substring misattribution)
          if (partyName) {
            const escaped = partyName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            if (new RegExp(`\\b${escaped}\\b`, 'i').test(tLeg.narration || '')) return true;
          }
          return false;
        });

        if (matchedTdsLeg) {
          // If statutory taxableAmount is recorded, use it; otherwise compute or clamp to debit (F-04)
          const statutoryTaxable = Number(matchedTdsLeg.statutory?.taxableAmount) || 0;
          const legRate = Number(matchedTdsLeg.statutory?.rate) || 0;
          const creditAmt = Number(matchedTdsLeg.creditAmount) || 0;
          let calculatedBase = 0;

          if (statutoryTaxable > 0) {
            calculatedBase = statutoryTaxable;
          } else if (legRate > 0) {
            calculatedBase = Math.round((creditAmt / (legRate / 100)) * 100) / 100;
          } else {
            calculatedBase = Number(entry.debitAmount) || 0;
          }

          priorAlreadyTaxedAmount += Math.min(Number(entry.debitAmount) || 0, calculatedBase);
        }
      }
    }

    // 3. Look up PAN across Party, COA, and PostgreSQL Labor Leaders (if not yet detected)
    // Check Party
    if (!detectedPan && partyId && mongoose.Types.ObjectId.isValid(partyId)) {
      const pDoc = await Party.findOne({
        _id: new mongoose.Types.ObjectId(partyId),
        $or: [{ firmId: firmIdObj }, { firm_id: firmIdObj }]
      }).lean();
      if (pDoc?.pan) detectedPan = pDoc.pan;
      if (pDoc?.name && !partyName) partyName = pDoc.name;
    } else if (!detectedPan && accountHead) {
      const pDoc = await Party.findOne({
        $or: [{ firmId: firmIdObj }, { firm_id: firmIdObj }],
        name: { $regex: new RegExp(`^${accountHead.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
      }).lean();
      if (pDoc?.pan) detectedPan = pDoc.pan;
    }

    // Check ChartOfAccounts
    if (!detectedPan && accountHead) {
      const coaDoc = await ChartOfAccounts.findOne({
        $or: [{ firm_id: firmIdObj }, { firmId: firmIdObj }],
        account_name: accountHead
      }).lean();
      if (coaDoc?.pan) detectedPan = coaDoc.pan;
    }

    // Check PostgreSQL labor_leaders
    if (!detectedPan && (leaderId || accountHead)) {
      try {
        let sql = getSql();
        if (!sql) sql = await connectPostgres();
        if (sql) {
          let rows: any[] = [];
          if (leaderId) {
            rows = await sql`SELECT name, pan FROM labor_leaders WHERE id = ${leaderId} AND firm_id = ${String(session.firm_id)} LIMIT 1`;
          } else {
            rows = await sql`SELECT name, pan FROM labor_leaders WHERE name ILIKE ${accountHead} AND firm_id = ${String(session.firm_id)} LIMIT 1`;
          }
          if (rows.length > 0 && rows[0]?.pan) {
            detectedPan = rows[0].pan;
          }
        }
      } catch (pgErr) {
        console.warn('TDS PAN lookup in PostgreSQL notice:', pgErr);
      }
    }

    // 4. PAN Validation & Entity Classification
    const panResult = TdsCalculator.validatePan(detectedPan);
    const applicableRate = customRate !== null && !isNaN(customRate)
      ? customRate
      : panResult.default194CRate;

    // 5. Section 194C(5) Threshold Evaluation
    const thresholdResult = TdsCalculator.check194CThreshold(priorYtd, currentAmount, priorAlreadyTaxedAmount);

    // 6. Pre-calculate Both Options (Gross-Up vs Standard Deduction)
    const grossUpComputation = TdsCalculator.computeTds({
      netAmount: currentAmount,
      ratePercent: applicableRate,
      isGrossUp: true,
      catchUpBaseAmount: thresholdResult.requiresCatchUp ? thresholdResult.catchUpBase : 0
    });

    const standardComputation = TdsCalculator.computeTds({
      netAmount: currentAmount,
      ratePercent: applicableRate,
      isGrossUp: false,
      catchUpBaseAmount: thresholdResult.requiresCatchUp ? thresholdResult.catchUpBase : 0
    });

    return {
      success: true,
      data: {
        financialYear: fyString,
        accountHead,
        partyName,
        pan: panResult.pan,
        isPanValid: panResult.isValid,
        isIndividual: panResult.isIndividual,
        entityType: panResult.entityType,
        applicableRate,
        priorYtd: thresholdResult.priorYtd,
        currentAmount,
        newYtd: thresholdResult.newYtd,
        threshold: {
          singleExceeded: thresholdResult.singleExceeded,
          aggregateExceeded: thresholdResult.aggregateExceeded,
          isThresholdBreached: thresholdResult.isThresholdBreached,
          requiresCatchUp: thresholdResult.requiresCatchUp,
          catchUpBase: thresholdResult.catchUpBase,
          singleLimit: 30000,
          aggregateLimit: 100000
        },
        grossUpOption: grossUpComputation,
        standardOption: standardComputation
      }
    };
  } catch (err: any) {
    throw createError({
      statusCode: err.statusCode || 500,
      statusMessage: err.statusMessage || err.message || 'Error checking TDS threshold'
    });
  }
});
