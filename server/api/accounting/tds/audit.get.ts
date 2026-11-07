import { defineEventHandler, createError } from 'h3';
import mongoose from 'mongoose';
import Ledger from '../../../models/Ledger';
import { requireAuthSession } from '../../../utils/auth';
import { getSql, connectPostgres } from '../../../utils/pg.config';
import { TdsManagerService } from '../../../utils/accounting/tds-manager.service';

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuthSession(event);
    if (!user || !user.firm_id) {
      throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
    }

    const firmIdObj = new mongoose.Types.ObjectId(String(user.firm_id));

    // 1. Audit MongoDB: Scan all vouchers that have TDS legs
    const tdsCandidates = await Ledger.find({
      $or: [{ firmId: firmIdObj }, { firm_id: firmIdObj }],
      creditAmount: { $gt: 0 },
      isReversed: { $ne: true },
      $or: [
        { accountType: 'DUTIES_AND_TAXES' },
        { accountHead: { $regex: /\btds\b|\btax deducted\b|\bwithholding\b/i } }
      ],
      accountHead: { $not: /borne by company/i }
    }).lean();

    const genuineTdsLegs = tdsCandidates.filter(l => TdsManagerService.isTdsLiabilityLeg(l));
    const voucherGroupIds = Array.from(new Set(genuineTdsLegs.map(l => l.voucherGroupId).filter(Boolean)));

    const allLegs = await Ledger.find({
      $or: [{ firmId: firmIdObj }, { firm_id: firmIdObj }],
      voucherGroupId: { $in: voucherGroupIds },
      isReversed: { $ne: true }
    }).lean();

    const legsByGroup = new Map<string, typeof allLegs>();
    for (const leg of allLegs) {
      if (!leg.voucherGroupId) continue;
      const list = legsByGroup.get(leg.voucherGroupId) || [];
      list.push(leg);
      legsByGroup.set(leg.voucherGroupId, list);
    }

    const voucherAudits: any[] = [];
    let unbalancedVouchers = 0;

    for (const vgId of voucherGroupIds) {
      const legs = legsByGroup.get(vgId) || [];
      let totalDr = 0;
      let totalCr = 0;
      let tdsAmount = 0;
      let netBankAmount = 0;
      let grossExpenseAmount = 0;

      for (const l of legs) {
        const dr = Number(l.debitAmount || 0);
        const cr = Number(l.creditAmount || 0);
        totalDr += dr;
        totalCr += cr;

        if (TdsManagerService.isTdsLiabilityLeg(l)) {
          tdsAmount += cr;
        } else if (l.accountType === 'BANK' || l.accountType === 'CASH' || l.bankAccountId) {
          netBankAmount += cr;
        }

        if (dr > 0) {
          grossExpenseAmount += dr;
        }
      }

      const diff = Math.abs(totalDr - totalCr);
      const isBalanced = diff < 0.01;
      if (!isBalanced) unbalancedVouchers++;

      voucherAudits.push({
        voucherGroupId: vgId,
        voucherNo: legs[0]?.voucherNo,
        transactionDate: legs[0]?.transactionDate,
        totalDebit: Number(totalDr.toFixed(2)),
        totalCredit: Number(totalCr.toFixed(2)),
        imbalance: Number(diff.toFixed(2)),
        isBalanced,
        calculatedTds: Number(tdsAmount.toFixed(2)),
        calculatedNet: Number(netBankAmount.toFixed(2)),
        calculatedGross: Number(grossExpenseAmount.toFixed(2)),
        legCount: legs.length
      });
    }

    // 2. Cross-Database Audit: PostgreSQL labor_advances
    const pgAudits: any[] = [];
    let pgConnected = false;
    let pgDiscrepancies = 0;

    try {
      let sql = getSql();
      if (!sql) sql = await connectPostgres();
      if (sql) {
        pgConnected = true;
        const rows = await sql`
          SELECT id, period_id, amount, gross_amount, tds_amount, tds_mode, tds_rate, ledger_voucher_group_id, payment_date
          FROM labor_advances
          WHERE firm_id = ${String(user.firm_id)}
            AND ledger_voucher_group_id IN ${sql(voucherGroupIds.length ? voucherGroupIds : ['none'])}
        `;

        for (const row of rows) {
          const mongoMatch = voucherAudits.find(v => v.voucherGroupId === row.ledger_voucher_group_id);
          const isTdsMatch = mongoMatch ? Math.abs(Number(row.tds_amount || 0) - mongoMatch.calculatedTds) < 0.05 : false;
          const isNetMatch = mongoMatch ? Math.abs(Number(row.amount || 0) - mongoMatch.calculatedNet) < 0.05 : false;
          const isSynced = isTdsMatch && isNetMatch;

          if (!isSynced) pgDiscrepancies++;

          pgAudits.push({
            id: row.id,
            periodId: row.period_id,
            voucherGroupId: row.ledger_voucher_group_id,
            pgNetAmount: Number(row.amount),
            pgTdsAmount: Number(row.tds_amount),
            pgGrossAmount: Number(row.gross_amount),
            pgTdsMode: row.tds_mode,
            mongoTds: mongoMatch?.calculatedTds,
            mongoNet: mongoMatch?.calculatedNet,
            isSynced
          });
        }
      }
    } catch (pgErr: any) {
      console.warn('PostgreSQL audit warning:', pgErr.message);
    }

    return {
      success: true,
      data: {
        summary: {
          totalTdsVouchersScanned: voucherGroupIds.length,
          allDoubleEntryBalanced: unbalancedVouchers === 0,
          unbalancedVoucherCount: unbalancedVouchers,
          postgresConnected: pgConnected,
          postgresAdvancesChecked: pgAudits.length,
          postgresSyncDiscrepancies: pgDiscrepancies,
          status: (unbalancedVouchers === 0 && pgDiscrepancies === 0) ? 'HEALTHY' : 'NEEDS_ATTENTION'
        },
        mongoVouchers: voucherAudits,
        postgresAdvances: pgAudits
      }
    };
  } catch (err: any) {
    console.error('Audit failed:', err);
    throw createError({
      statusCode: 500,
      statusMessage: err.message || 'Audit execution failed'
    });
  }
});

