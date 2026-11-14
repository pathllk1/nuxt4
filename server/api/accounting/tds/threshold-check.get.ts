import { defineEventHandler, getQuery, createError } from 'h3';
import mongoose from 'mongoose';
import Ledger from '../../../models/Ledger';
import Party from '../../../models/Party';
import ChartOfAccounts from '../../../models/ChartOfAccounts';
import TdsExemptionCertificate from '../../../models/TdsExemptionCertificate';
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
    const paymentDate = typeof query.paymentDate === 'string' ? query.paymentDate.trim() : '';
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
    const amountStr = query.amount !== undefined ? String(query.amount).trim() : '';
    if (!/^\d+(\.\d+)?$/.test(amountStr) || Number(amountStr) <= 0) {
      throw createError({ statusCode: 400, statusMessage: 'A positive, strictly formatted amount is required.' });
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
    // Capped at paymentDate, strictly scoped to deductee, and positively restricted to canonical 194C-eligible commercial/contractor transactions (F-04)
    const matchFilter: any = {
      $or: [{ firmId: firmIdObj }, { firm_id: firmIdObj }],
      transactionDate: { $gte: fyStartDate, $lte: paymentDate },
      debitAmount: { $gt: 0 },
      isReversed: { $ne: true }, // Compatible with both legacy (null) and indexed (false) active rows (F-07)
      refType: { $ne: 'REVERSAL' },
      // Positive canonical accounting types from server/types/accounting.ts (F-04)
      accountType: {
        $in: [
          'DIRECT_EXPENSE',
          'INDIRECT_EXPENSE',
          'COGS',
          'EXPENSE',
          'CASUAL_LABOR',
          'LABOR_LEADER',
          'SUNDRY_CREDITORS',
          'CREDITOR'
        ]
      },
      $nor: [{ accountHead: { $regex: /\btds borne by company\b/i } }]
    };

    if (resolvedPartyId) {
      matchFilter.partyId = resolvedPartyId;
    } else if (resolvedAccountHead) {
      matchFilter.accountHead = resolvedAccountHead;
    }

    const priorEntries = await Ledger.find(matchFilter, 'debitAmount transactionDate voucherGroupId accountHead partyId sourcePaymentRef statutory').lean();
    let priorYtd = priorEntries.reduce((sum: number, entry: any) => {
      const amount = Number(entry.debitAmount);
      if (!Number.isFinite(amount) || amount <= 0) {
        throw createError({ statusCode: 409, statusMessage: 'Prior payment history contains an invalid debit amount.' });
      }
      return sum + amount;
    }, 0);

    // Compute how much prior payment has ALREADY suffered TDS for THIS deductee and section 194C (F-04)
    const vgIds = Array.from(new Set(priorEntries.map(e => e.voucherGroupId).filter((id): id is string => Boolean(id))));
    let priorAlreadyTaxedAmount = 0;
    let hasIncompleteHistory = priorEntries.some(entry => !entry.voucherGroupId);

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
              { accountHead: { $regex: /\b(194c|tds on contractor|tds 194c)\b/i } }
            ]
          },
          {
            accountHead: {
              // Exclude GST, non-TDS liabilities, and ordinary trade creditors (F-04)
              $not: /\b(gst|cgst|sgst|igst|cess|tcs|194j|194i|194h|194a|borne by company|sundry creditor|creditors)\b/i
            }
          }
        ]
      }, 'voucherGroupId statutory accountHead creditAmount sourcePaymentRef').lean();

      const tdsLegsByVg = new Map<string, any[]>();
      for (const tLeg of priorTdsLegs) {
        const vgId = tLeg.voucherGroupId ? String(tLeg.voucherGroupId) : '';
        if (vgId) {
          // Initialize remaining taxable base for this TDS leg so it is not multiplied across multiple debits (F-04)
          const sourcePaymentRef = tLeg.sourcePaymentRef || tLeg.statutory?.sourcePaymentRef;
          const taxableBase = tLeg.statutory?.taxableAmount ?? tLeg.statutory?.grossAmount;
          const calculatedBase = taxableBase == null ? Number.NaN : Number(taxableBase);
          if (!sourcePaymentRef || !Number.isFinite(calculatedBase) || calculatedBase <= 0) {
            hasIncompleteHistory = true;
          }
          (tLeg as any).sourcePaymentRef = sourcePaymentRef || null;
          (tLeg as any).remainingBase = Number.isFinite(calculatedBase) && calculatedBase > 0 ? calculatedBase : 0;

          if (!tdsLegsByVg.has(vgId)) tdsLegsByVg.set(vgId, []);
          tdsLegsByVg.get(vgId)!.push(tLeg);
        }
      }

      const sourceRefCounts = new Map<string, number>();
      for (const entry of priorEntries) {
        const sourceRef = entry.sourcePaymentRef || (entry as any).statutory?.sourcePaymentRef;
        if (sourceRef) {
          sourceRefCounts.set(sourceRef, (sourceRefCounts.get(sourceRef) || 0) + 1);
        }
      }

      for (const entry of priorEntries) {
        const vg = entry.voucherGroupId;
        if (!vg) {
          hasIncompleteHistory = true;
          continue;
        }
        const matchingTdsList = tdsLegsByVg.get(vg);
        if (!matchingTdsList || matchingTdsList.length === 0) {
          hasIncompleteHistory = true;
          continue;
        }

        const entrySourceRef = entry.sourcePaymentRef || (entry as any).statutory?.sourcePaymentRef;
        if (!entrySourceRef || sourceRefCounts.get(entrySourceRef) !== 1) {
          hasIncompleteHistory = true;
          continue;
        }

        const matchedTdsLegs = matchingTdsList.filter(
          (tLeg: any) => tLeg.sourcePaymentRef === entrySourceRef
        );
        if (matchedTdsLegs.length > 1) {
          hasIncompleteHistory = true;
          continue;
        }
        const matchedTdsLeg = matchedTdsLegs[0];
        if (!matchedTdsLeg) continue;

        const statutory = matchedTdsLeg.statutory;
        const identityMatches = Boolean(
          statutory &&
          (
            (resolvedPartyId
              ? String(statutory.deducteeId || '') === String(resolvedPartyId)
              : detectedPan
                ? String(statutory.pan || statutory.deducteePan || '').toUpperCase() === detectedPan.toUpperCase()
                : resolvedAccountHead &&
                  String(statutory.deducteeName || '').trim().toLowerCase() === resolvedAccountHead.trim().toLowerCase())
          )
        );
        if (!identityMatches || !(Number(matchedTdsLeg.remainingBase) > 0)) {
          hasIncompleteHistory = true;
          continue;
        }

        const entryDebit = Number(entry.debitAmount);
        const taxableBase = Number(matchedTdsLeg.remainingBase);
        if (!Number.isFinite(entryDebit) || entryDebit <= 0 || !Number.isFinite(taxableBase) || taxableBase < entryDebit) {
          hasIncompleteHistory = true;
          continue;
        }
        priorAlreadyTaxedAmount += taxableBase;
        if (statutory.isGrossUp) priorYtd += taxableBase - entryDebit;
        matchedTdsLeg.remainingBase = 0;
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
      const parties = await Party.find({
        $or: [{ firmId: firmIdObj }, { firm_id: firmIdObj }],
        name: { $regex: new RegExp(`^${accountHead.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
      }, 'pan name').lean();
      if (parties.length > 1) {
        throw createError({ statusCode: 409, statusMessage: `Deductee name "${accountHead}" is ambiguous in the current firm.` });
      }
      if (parties[0]?.pan) detectedPan = parties[0].pan;
    }

    // Check ChartOfAccounts
    if (!detectedPan && accountHead) {
      const coaDocs = await ChartOfAccounts.find({
        $or: [{ firm_id: firmIdObj }, { firmId: firmIdObj }],
        account_name: accountHead,
        is_active: true
      }, 'pan').lean();
      if (coaDocs.length > 1) {
        throw createError({ statusCode: 409, statusMessage: `Chart-of-accounts identity "${accountHead}" is ambiguous in the current firm.` });
      }
      if (coaDocs[0]?.pan) detectedPan = coaDocs[0].pan;
    }

    // Check PostgreSQL labor_leaders
    if (!detectedPan && (leaderId || accountHead)) {
      let sql = getSql();
      if (!sql) sql = await connectPostgres();
      if (!sql) {
        throw createError({ statusCode: 503, statusMessage: 'PostgreSQL is unavailable for authoritative labor deductee resolution.' });
      }
      const rows: any[] = leaderId
        ? await sql`SELECT name, pan FROM labor_leaders WHERE id = ${leaderId} AND firm_id = ${String(session.firm_id)}`
        : await sql`SELECT name, pan FROM labor_leaders WHERE name = ${accountHead} AND firm_id = ${String(session.firm_id)}`;
      if (rows.length > 1) {
        throw createError({ statusCode: 409, statusMessage: 'Labor deductee identity is ambiguous in the current firm.' });
      }
      if (rows.length === 1 && rows[0]?.pan) detectedPan = rows[0].pan;
    }

    // 4. PAN Validation & Entity Classification (F-03)
    const panResult = TdsCalculator.validatePan(detectedPan);

    // Section 206AA & Statutory Rate Enforcement (F-03)
    let applicableRate: number;
    let certificateNumber: string | null = null;
    let exemptionApplied = false;

    if (!panResult.isValid) {
      // Under Section 206AA, invalid or missing PAN mandates a 20% statutory TDS rate.
      // A request-supplied query rate cannot bypass Section 206AA.
      if (customRate !== null && customRate !== 20) {
        throw createError({
          statusCode: 400,
          statusMessage: `Section 206AA mandates a 20% TDS rate when PAN is invalid or missing. Query rate of ${customRate}% is prohibited.`
        });
      }
      applicableRate = 20;
    } else {
      // Valid PAN: default Section 194C statutory rate is 1% (Individual/HUF) or 2% (Other)
      if (customRate !== null && customRate !== panResult.default194CRate) {
        // F-03: Rate override requires an active, firm-scoped exemption certificate record (Section 197 / 194C(6)).
        // Free-text query parameters are rejected.
        const certificates = await TdsExemptionCertificate.find({
          firmId: firmIdObj,
          pan: panResult.pan,
          section: '194C',
          status: 'ACTIVE',
          validFrom: { $lte: paymentDate },
          validTo: { $gte: paymentDate }
        }).lean();

        if (certificates.length !== 1) {
          throw createError({
            statusCode: 400,
            statusMessage: `Rate override (${customRate}%) rejected. Section 194C statutory rate is ${panResult.default194CRate}% for ${panResult.entityType}. Exactly one active, firm-scoped Section 197 / 194C(6) exemption certificate is required for PAN "${panResult.pan}" on ${paymentDate}; found ${certificates.length}.`
          });
        }

        const cert = certificates[0]!;
        if (Number(cert.permittedRate) !== customRate) {
          throw createError({
            statusCode: 400,
            statusMessage: `Rate override (${customRate}%) does not match certificate permitted rate (${cert.permittedRate}%) for certificate "${cert.certificateNumber}".`
          });
        }

        applicableRate = customRate;
        certificateNumber = cert.certificateNumber;
        exemptionApplied = true;
      } else {
        applicableRate = panResult.default194CRate;
      }
    }

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
        deducteeId: resolvedPartyId ? String(resolvedPartyId) : null,
        deducteeName: resolvedAccountHead,
        pan: panResult.pan,
        isPanValid: panResult.isValid,
        isIndividual: panResult.isIndividual,
        entityType: panResult.entityType,
        applicableRate,
        exemption: {
          isApplied: exemptionApplied,
          certificateNumber,
        },
        isAuthoritative: !hasIncompleteHistory,
        incompleteHistory: hasIncompleteHistory,
        warning: hasIncompleteHistory
          ? 'Historical payment-to-TDS source linkage or statutory taxable-base data is incomplete. Catch-up calculations cannot be established authoritatively.'
          : null,
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
        grossUpOption: {
          ...grossUpComputation,
          netAmount: grossUpComputation.netPayout,
          isAuthoritative: !hasIncompleteHistory,
          requiresExplicitApproval: hasIncompleteHistory
        },
        standardOption: {
          ...standardComputation,
          netAmount: standardComputation.netPayout,
          isAuthoritative: !hasIncompleteHistory,
          requiresExplicitApproval: hasIncompleteHistory
        }
      }
    };
  } catch (err: any) {
    throw createError({
      statusCode: err.statusCode || 500,
      statusMessage: err.statusMessage || err.message || 'Error checking TDS threshold'
    });
  }
});
