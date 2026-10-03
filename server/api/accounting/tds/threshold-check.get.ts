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
    const currentAmount = Math.max(0, parseFloat(String(query.amount || '0')) || 0);
    const paymentDate = String(query.paymentDate || new Date().toISOString().split('T')[0]);
    const leaderId = query.leaderId ? String(query.leaderId).trim() : '';
    const partyId = query.partyId ? String(query.partyId).trim() : '';
    const customRate = query.rate ? parseFloat(String(query.rate)) : null;

    if (!accountHead && !partyId && !leaderId) {
      throw createError({ statusCode: 400, statusMessage: 'accountHead, partyId, or leaderId is required' });
    }

    // 1. Determine Financial Year boundaries (April 1 to March 31)
    const pDate = new Date(paymentDate);
    const year = pDate.getFullYear();
    const month = pDate.getMonth() + 1; // 1-12
    const fyStartYear = month >= 4 ? year : year - 1;
    const fyStartDate = `${fyStartYear}-04-01`;
    const fyEndDate = `${fyStartYear + 1}-03-31`;
    const fyString = `${fyStartYear}-${String(fyStartYear + 1).slice(-2)}`;

    // 2. Query Prior YTD Payments in General Ledger for this Financial Year
    const matchFilter: any = {
      $or: [{ firmId: firmIdObj }, { firm_id: firmIdObj }],
      transactionDate: { $gte: fyStartDate, $lte: fyEndDate },
      debitAmount: { $gt: 0 },
      refType: { $ne: 'REVERSAL' }
    };

    if (partyId && mongoose.Types.ObjectId.isValid(partyId)) {
      matchFilter.partyId = new mongoose.Types.ObjectId(partyId);
    } else if (accountHead) {
      matchFilter.accountHead = accountHead;
    }

    const priorEntries = await Ledger.find(matchFilter, 'debitAmount transactionDate narration').lean();
    const priorYtd = priorEntries.reduce((sum: number, e: any) => sum + (Number(e.debitAmount) || 0), 0);

    // 3. Look up PAN across Party, COA, and PostgreSQL Labor Leaders
    let detectedPan = '';
    let partyName = accountHead;

    // Check Party
    if (partyId && mongoose.Types.ObjectId.isValid(partyId)) {
      const pDoc = await Party.findById(partyId).lean();
      if (pDoc?.pan) detectedPan = pDoc.pan;
      if (pDoc?.name) partyName = pDoc.name;
    } else if (accountHead) {
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
    const thresholdResult = TdsCalculator.check194CThreshold(priorYtd, currentAmount);

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
