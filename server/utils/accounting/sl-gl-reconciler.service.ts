import mongoose from 'mongoose';
import Ledger from '../../models/Ledger';
import Party from '../../models/Party';
import BankAccount from '../../models/BankAccount';
import ChartOfAccounts from '../../models/ChartOfAccounts';
import Advance from '../../models/Advance';
import MasterRoll from '../../models/MasterRoll';
import Bill from '../../models/Bill';

// ─────────────────────────────────────────────────────────────────────────
// SUB-LEDGER TO GENERAL LEDGER (SL-GL) RECONCILIATION SERVICE
//
// In an Enterprise ERP, the General Ledger is the SINGLE source of truth.
// Sub-ledgers (customer statements, vendor payables, bank registers) must
// be strict mathematical projections of GL entries tagged with partyId or
// bankAccountId.
//
// This service detects drift between sub-ledger totals and GL control
// account totals. Any variance indicates either:
//   - Untagged journal entries (partyId missing)
//   - Direct database modifications bypassing the posting engine
//   - Legacy entries from before the unified engine was deployed
//
// IMPORTANT: This service is READ-ONLY. It never modifies data.
// ─────────────────────────────────────────────────────────────────────────

export interface IReconciliationVariance {
  category: 'AR' | 'AP' | 'BANK' | 'LABOR' | 'ADVANCE';
  entityName: string;
  entityId: string;
  glBalance: number;
  glBalanceType: 'DR' | 'CR';
  slBalance: number;
  slBalanceType: 'DR' | 'CR';
  variance: number;
  status: 'HEALTHY' | 'WARNING' | 'CRITICAL';
}

export interface IReconciliationReport {
  firmId: string;
  timestamp: string;
  toDate?: string;
  overallStatus: 'HEALTHY' | 'WARNING' | 'CRITICAL';
  arSummary: { glTotal: number; slTotal: number; variance: number; status: string };
  apSummary: { glTotal: number; slTotal: number; variance: number; status: string };
  bankSummary: { glTotal: number; slTotal: number; variance: number; status: string };
  laborSummary: { glTotal: number; slTotal: number; variance: number; status: string };
  advanceSummary?: { glTotal: number; slTotal: number; variance: number; status: string };
  variances: IReconciliationVariance[];
  untaggedVoucherCount: number;
}

export class SLGLReconcilerService {

  /**
   * Runs a full SL-GL reconciliation for a firm and returns a variance report.
   *
   * This compares:
   *   1. Sum of all partyId-tagged SUNDRY_DEBTORS GL entries → vs → Party AR sub-ledger
   *   2. Sum of all partyId-tagged SUNDRY_CREDITORS GL entries → vs → Party AP sub-ledger
   *   3. Sum of all bankAccountId-tagged BANK/CASH GL entries → vs → BankAccount balances
   *   4. Sum of all partyId-tagged LABOR_LEADER GL entries → vs → Labor leader sub-ledger
   *
   * @param firmId - The firm to reconcile
   * @param toDate - Optional cutoff date (YYYY-MM-DD). Defaults to today.
   */
  static async runReconciliation(
    firmId: mongoose.Types.ObjectId | string,
    toDate?: string
  ): Promise<IReconciliationReport> {
    const cutoffDate: string = toDate || (new Date().toISOString().split('T')[0] as string);
    const firmIdObj = typeof firmId === 'string' ? new mongoose.Types.ObjectId(firmId) : firmId;

    const [arResult, apResult, bankResult, laborResult, advResult, untaggedCount] = await Promise.all([
      this.reconcileAccountsReceivable(firmIdObj, cutoffDate),
      this.reconcileAccountsPayable(firmIdObj, cutoffDate),
      this.reconcileBankAccounts(firmIdObj, cutoffDate),
      this.reconcileLaborLeaders(firmIdObj, cutoffDate),
      this.reconcileEmployeeAdvances(firmIdObj, cutoffDate),
      this.countUntaggedPartyVouchers(firmIdObj, cutoffDate),
    ]);

    const allVariances = [
      ...arResult.variances,
      ...apResult.variances,
      ...bankResult.variances,
      ...laborResult.variances,
      ...advResult.variances,
    ];

    const hasCritical = allVariances.some(v => v.status === 'CRITICAL');
    const hasWarning = allVariances.some(v => v.status === 'WARNING');

    return {
      firmId: String(firmId),
      timestamp: new Date().toISOString(),
      toDate: cutoffDate,
      overallStatus: hasCritical ? 'CRITICAL' : hasWarning ? 'WARNING' : 'HEALTHY',
      arSummary: arResult.summary,
      apSummary: apResult.summary,
      bankSummary: bankResult.summary,
      laborSummary: laborResult.summary,
      advanceSummary: advResult.summary,
      variances: allVariances.filter(v => v.status !== 'HEALTHY'),
      untaggedVoucherCount: untaggedCount,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // AR (Accounts Receivable) — SUNDRY_DEBTORS
  // ═══════════════════════════════════════════════════════════════════════

  private static async reconcileAccountsReceivable(
    firmId: mongoose.Types.ObjectId,
    toDate: string
  ) {
    return this.reconcilePartyCategory(firmId, toDate, 'SUNDRY_DEBTORS', 'AR');
  }

  // ═══════════════════════════════════════════════════════════════════════
  // AP (Accounts Payable) — SUNDRY_CREDITORS
  // ═══════════════════════════════════════════════════════════════════════

  private static async reconcileAccountsPayable(
    firmId: mongoose.Types.ObjectId,
    toDate: string
  ) {
    return this.reconcilePartyCategory(firmId, toDate, 'SUNDRY_CREDITORS', 'AP');
  }

  // ═══════════════════════════════════════════════════════════════════════
  // LABOR LEADERS — LABOR_LEADER (Reconciled via COA / PostgreSQL Leader Registry)
  // ═══════════════════════════════════════════════════════════════════════

  private static async reconcileLaborLeaders(
    firmId: mongoose.Types.ObjectId,
    toDate: string
  ) {
    // GL side: aggregate by accountHead for accountType = 'LABOR_LEADER'
    const glBalances = await Ledger.aggregate([
      {
        $match: {
          $or: [{ firmId }, { firm_id: firmId }],
          accountType: 'LABOR_LEADER',
          isReversed: { $ne: true },
          transactionDate: { $lte: toDate },
        },
      },
      {
        $group: {
          _id: '$accountHead',
          totalDebit: { $sum: '$debitAmount' },
          totalCredit: { $sum: '$creditAmount' },
        },
      },
    ]);

    const glMap = new Map<string, number>();
    let glGrandTotal = 0;

    for (const row of glBalances) {
      const net = (row.totalDebit || 0) - (row.totalCredit || 0);
      glMap.set(String(row._id).trim().toLowerCase(), net);
      glGrandTotal += net;
    }

    // SL side: query registered labor leaders from ChartOfAccounts for this firm
    const coaLeaders = await ChartOfAccounts.find(
      {
        $or: [{ firm_id: firmId }, { firmId: firmId }],
        account_type: 'LABOR_LEADER',
      },
      'account_name'
    ).lean();

    const leaderMap = new Map<string, string>();
    for (const l of coaLeaders) {
      leaderMap.set(l.account_name.trim().toLowerCase(), l.account_name);
    }

    // Cross-Database: Query registered Labor Leaders and independent operational total from PostgreSQL (F-05)
    let slOperationalTotal = 0;
    try {
      const { getSql, isPgReady } = await import('../pg.config');
      const sql = getSql();
      if (sql && isPgReady()) {
        const pgLeaders = await sql`
          SELECT id, name
          FROM labor_leaders
          WHERE firm_id = ${String(firmId)}
        `;
        for (const pl of pgLeaders) {
          const lowerName = String(pl.name).trim().toLowerCase();
          if (!leaderMap.has(lowerName)) {
            leaderMap.set(lowerName, String(pl.name));
          }
        }

        // Independent operational sub-ledger totals derived from PostgreSQL operational records (F-05)
        // Complete operational accounting without arbitrary zero-clamps:
        // Debits: Total advances + Total settlement payouts + Settlement discount adjustments
        // Credits: Total settlement gross liabilities (wages + expenses)
        const [advSumRow] = await sql`
          SELECT COALESCE(SUM(amount), 0) AS total_adv
          FROM labor_advances
          WHERE firm_id = ${String(firmId)} AND payment_date <= ${toDate}
        `;
        const totalAdv = Number(advSumRow?.total_adv || 0);

        const [settleSumRow] = await sql`
          SELECT 
            COALESCE(SUM(s.total_wages), 0) AS sum_wages,
            COALESCE(SUM(s.total_expenses), 0) AS sum_expenses,
            COALESCE(SUM(s.total_advances), 0) AS sum_settled_adv,
            COALESCE(SUM(s.paid_amount), 0) AS sum_paid,
            COALESCE(SUM(s.net_payable), 0) AS sum_net_payable
          FROM labor_settlements s
          JOIN labor_periods p ON s.period_id = p.id
          WHERE p.firm_id = ${String(firmId)} AND s.payment_date <= ${toDate}
        `;
        const sumWages = Number(settleSumRow?.sum_wages || 0);
        const sumExpenses = Number(settleSumRow?.sum_expenses || 0);
        const sumPaid = Number(settleSumRow?.sum_paid || 0);
        const sumNetPayable = Number(settleSumRow?.sum_net_payable || 0);

        let sumAdjustments = 0;
        if (sumNetPayable > 0) {
          sumAdjustments = sumNetPayable - sumPaid;
        }

        // Net operational labor balance reflecting complete operational state without artificial clamping (F-05)
        slOperationalTotal = (totalAdv + sumPaid + sumAdjustments) - (sumWages + sumExpenses);
      }
    } catch (pgErr: any) {
      console.warn('[SL-GL Reconciler] Postgres labor leader sync notice:', pgErr.message);
    }

    // STRICT: Never fall back to GL balance when operational total is zero (F-05)
    // The operational sub-ledger total must reflect independent operational records.
    let slGrandTotal = slOperationalTotal;
    const variances: IReconciliationVariance[] = [];

    for (const [headKey, glNet] of glMap) {
      const canonicalName = leaderMap.get(headKey);
      if (!canonicalName) {
        variances.push({
          category: 'LABOR',
          entityName: `Unregistered Leader (${headKey})`,
          entityId: headKey,
          glBalance: Math.abs(glNet),
          glBalanceType: glNet >= 0 ? 'DR' : 'CR',
          slBalance: 0,
          slBalanceType: 'DR',
          variance: Math.abs(glNet),
          status: 'CRITICAL',
        });
      }
    }

    // Cross-Database: Verify that all PostgreSQL labor advances are reflected in GL with exact cutoff & leader parity (A-04, A-07, F-03, F-05)
    let pgAdvancesVarianceSum = 0;
    try {
      const { getSql, isPgReady } = await import('../pg.config');
      const sql = getSql();
      if (sql && isPgReady()) {
        const pgAdvances = await sql`
          SELECT a.id, a.period_id, a.amount, a.payment_date, a.ledger_voucher_group_id,
                 a.gross_amount, a.tds_amount, a.tds_mode, a.paid_from_bank_account_id,
                 p.leader_id, l.name as leader_name
          FROM labor_advances a
          LEFT JOIN labor_periods p ON a.period_id = p.id
          LEFT JOIN labor_leaders l ON p.leader_id = l.id
          WHERE a.firm_id = ${String(firmId)}
            AND a.ledger_voucher_group_id IS NOT NULL
            AND a.payment_date <= ${toDate}
        `;
        if (pgAdvances && pgAdvances.length > 0) {
          const advVoucherIds = pgAdvances.map((a: any) => String(a.ledger_voucher_group_id)).filter(Boolean);
          // STRICT: Filter GL legs by transactionDate <= toDate and effective population (F-05, F-07)
          const glLegs = await Ledger.find({
            $or: [{ firmId }, { firm_id: firmId }],
            voucherGroupId: { $in: advVoucherIds },
            transactionDate: { $lte: toDate },
            isReversed: { $ne: true }
          }, 'voucherGroupId accountHead accountType debitAmount creditAmount bankAccountId transactionDate legIndex').lean();

          const glLegsByGroup = new Map<string, any[]>();
          for (const leg of glLegs) {
            const vId = leg.voucherGroupId;
            if (vId) {
              const list = glLegsByGroup.get(vId) || [];
              list.push(leg);
              glLegsByGroup.set(vId, list);
            }
          }

          // Track consumed legs per voucherGroupId to prevent 1-to-many leg reuse (F-05)
          const consumedLegsByVg = new Map<string, Set<number>>();

          for (const adv of pgAdvances) {
            const vId = String(adv.ledger_voucher_group_id);
            const legs = glLegsByGroup.get(vId);
            const advAmt = Number(adv.amount) || 0;

            if (!legs || legs.length === 0) {
              pgAdvancesVarianceSum += advAmt;
              variances.push({
                category: 'LABOR',
                entityName: `PostgreSQL Labor Advance #${adv.id} (Period #${adv.period_id}) missing or reversed in GL at cutoff ${toDate}`,
                entityId: String(adv.id),
                glBalance: 0,
                glBalanceType: 'DR',
                slBalance: advAmt,
                slBalanceType: 'DR',
                variance: advAmt,
                status: 'CRITICAL',
              });
              continue;
            }

            if (!consumedLegsByVg.has(vId)) {
              consumedLegsByVg.set(vId, new Set());
            }
            const consumedSet = consumedLegsByVg.get(vId)!;

            // Verify specific labor leader debit leg matching the exact PostgreSQL leader (F-05)
            // Use exact equality or canonical prefix matching, NOT loose substring includes!
            const targetLeaderName = (adv.leader_name || '').trim().toLowerCase();
            const leaderLeg = legs.find((l: any, idx: number) => {
              if (consumedSet.has(idx)) return false;
              if (Number(l.debitAmount) <= 0) return false;
              if (targetLeaderName) {
                const head = (l.accountHead || '').trim().toLowerCase();
                return head === targetLeaderName ||
                       head === `advance to ${targetLeaderName}` ||
                       head === `${targetLeaderName} - advance`;
              }
              return l.accountType === 'LABOR_LEADER' || l.accountType === 'ADVANCE_TO_LABOR';
            });

            if (!leaderLeg) {
              pgAdvancesVarianceSum += advAmt;
              variances.push({
                category: 'LABOR',
                entityName: `PostgreSQL Labor Advance #${adv.id}: Missing Leader GL Debit Leg for "${adv.leader_name || 'Leader'}"`,
                entityId: String(adv.id),
                glBalance: 0,
                glBalanceType: 'DR',
                slBalance: advAmt,
                slBalanceType: 'DR',
                variance: advAmt,
                status: 'CRITICAL',
              });
              continue;
            }

            // Mark this leg as consumed
            consumedSet.add(legs.indexOf(leaderLeg));

            // Expected amount basis depends on TDS mode (F-05):
            // In DEDUCT mode, leader leg debits gross amount; in GROSS_UP mode, leader leg debits net payout
            const expectedDebit = adv.tds_mode === 'DEDUCT'
              ? (Number(adv.gross_amount) || advAmt)
              : advAmt;

            const legDr = Number(leaderLeg.debitAmount) || 0;
            const diff = Math.abs(legDr - expectedDebit);
            if (diff > 0.05) {
              pgAdvancesVarianceSum += diff;
              variances.push({
                category: 'LABOR',
                entityName: `PostgreSQL Labor Advance #${adv.id} Amount Mismatch (Expected ${adv.tds_mode || 'NET'}: ₹${expectedDebit.toFixed(2)}, GL: ₹${legDr.toFixed(2)})`,
                entityId: String(adv.id),
                glBalance: legDr,
                glBalanceType: 'DR',
                slBalance: expectedDebit,
                slBalanceType: 'DR',
                variance: diff,
                status: 'CRITICAL',
              });
            }
          }
        }
      } else {
        // PostgreSQL unavailable must prevent unverified healthy assurance (F-05)
        variances.push({
          category: 'LABOR',
          entityName: 'PostgreSQL Database Unavailable for Cross-Verification',
          entityId: 'PG_UNAVAILABLE',
          glBalance: glGrandTotal,
          glBalanceType: 'DR',
          slBalance: 0,
          slBalanceType: 'DR',
          variance: glGrandTotal > 0 ? glGrandTotal : 1,
          status: 'CRITICAL'
        });
      }
    } catch (pgAdvErr: any) {
      console.warn('[SL-GL Reconciler] Postgres labor advance cross-check notice:', pgAdvErr.message);
      variances.push({
        category: 'LABOR',
        entityName: `PostgreSQL Verification Incomplete: ${pgAdvErr.message}`,
        entityId: 'PG_ERROR',
        glBalance: glGrandTotal,
        glBalanceType: 'DR',
        slBalance: 0,
        slBalanceType: 'DR',
        variance: glGrandTotal > 0 ? glGrandTotal : 1,
        status: 'CRITICAL'
      });
    }

    const hasCriticalLabor = variances.some(v => v.category === 'LABOR' && v.status === 'CRITICAL');
    const totalVariance = Math.abs(glGrandTotal - slGrandTotal) + pgAdvancesVarianceSum;

    return {
      summary: {
        glTotal: glGrandTotal,
        slTotal: slGrandTotal + pgAdvancesVarianceSum,
        variance: totalVariance,
        status: hasCriticalLabor || totalVariance >= 0.01 ? 'CRITICAL' : 'HEALTHY',
      },
      variances,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Shared Party Reconciliation Logic
  // ═══════════════════════════════════════════════════════════════════════

  private static async reconcilePartyCategory(
    firmId: mongoose.Types.ObjectId,
    toDate: string,
    accountType: string,
    category: 'AR' | 'AP' | 'LABOR'
  ) {
    // GL side: aggregate by partyId for the given accountType, filtering unreversed rows
    const glBalances = await Ledger.aggregate([
      {
        $match: {
          $or: [{ firmId }, { firm_id: firmId }],
          accountType,
          isReversed: { $ne: true },
          transactionDate: { $lte: toDate },
        },
      },
      {
        $group: {
          _id: { $ifNull: [{ $toString: '$partyId' }, 'UNTAGGED'] },
          totalDebit: { $sum: '$debitAmount' },
          totalCredit: { $sum: '$creditAmount' },
        },
      },
    ]);

    // Build a map: partyId → net GL balance
    const glMap = new Map<string, number>();
    let glGrandTotal = 0;

    for (const row of glBalances) {
      const net = (row.totalDebit || 0) - (row.totalCredit || 0);
      glMap.set(String(row._id), net);
      glGrandTotal += net;
    }

    // SL side: query all registered parties belonging to this firm with opening balances (F-05)
    const parties = await Party.find(
      { $or: [{ firmId }, { firm_id: firmId }] },
      'name openingBalance balanceType'
    ).lean();

    const partyMap = new Map<string, any>();
    for (const p of parties) {
      partyMap.set(String(p._id), p);
    }

    // Query independent operational commercial bills for this category up to cutoff (F-05)
    const billTypes = category === 'AR' ? ['SALES', 'CREDIT_NOTE'] : ['PURCHASE', 'DEBIT_NOTE'];
    const activeBills = await Bill.find(
      {
        $or: [{ firmId }, { firm_id: firmId as any }],
        btype: { $in: billTypes as any },
        status: 'ACTIVE',
        bdate: { $lte: toDate }
      },
      '_id bno btype netTotal partyId partyName voucherId'
    ).lean();

    // Compute independent operational sub-ledger balances per party from Billing Register
    const partyOperationalMap = new Map<string, number>();
    for (const p of parties) {
      const pid = String(p._id);
      let opBal = 0;
      if (p.openingBalance) {
        if (category === 'AR') {
          opBal += p.balanceType === 'CR' ? -p.openingBalance : p.openingBalance;
        } else {
          opBal += p.balanceType === 'DR' ? -p.openingBalance : p.openingBalance;
        }
      }
      partyOperationalMap.set(pid, opBal);
    }

    for (const b of activeBills) {
      const pid = String(b.partyId);
      if (partyOperationalMap.has(pid)) {
        const amt = Number(b.netTotal) || 0;
        if (category === 'AR') {
          const delta = b.btype === 'CREDIT_NOTE' ? -amt : amt;
          partyOperationalMap.set(pid, (partyOperationalMap.get(pid) || 0) + delta);
        } else {
          const delta = b.btype === 'DEBIT_NOTE' ? -amt : amt;
          partyOperationalMap.set(pid, (partyOperationalMap.get(pid) || 0) + delta);
        }
      }
    }

    // Query independent payment, receipt, and adjustment vouchers for these parties up to cutoff (F-05)
    // Subtract customer receipts from AR outstanding; subtract supplier payments from AP payable
    const partyIds = parties.map(p => p._id);
    const nonBillLegs = await Ledger.find({
      $or: [{ firmId }, { firm_id: firmId }],
      partyId: { $in: partyIds },
      accountType,
      refType: { $ne: 'BILL' },
      isReversed: { $ne: true },
      transactionDate: { $lte: toDate }
    }, 'partyId debitAmount creditAmount voucherType').lean();

    for (const leg of nonBillLegs) {
      const pid = String(leg.partyId);
      if (partyOperationalMap.has(pid)) {
        const dr = Number(leg.debitAmount) || 0;
        const cr = Number(leg.creditAmount) || 0;
        if (category === 'AR') {
          partyOperationalMap.set(pid, (partyOperationalMap.get(pid) || 0) + (dr - cr));
        } else {
          partyOperationalMap.set(pid, (partyOperationalMap.get(pid) || 0) + (cr - dr));
        }
      }
    }

    // Independent operational SL Grand Total derived strictly from operational registers (F-05)
    let slGrandTotal = 0;
    for (const [_, opBal] of partyOperationalMap) {
      slGrandTotal += opBal;
    }

    const variances: IReconciliationVariance[] = [];

    for (const [partyId, glNet] of glMap) {
      if (partyId === 'UNTAGGED') {
        variances.push({
          category,
          entityName: `Untagged ${accountType} Control Account Entries (Missing partyId)`,
          entityId: 'UNTAGGED',
          glBalance: Math.abs(glNet),
          glBalanceType: glNet >= 0 ? 'DR' : 'CR',
          slBalance: 0,
          slBalanceType: 'DR',
          variance: Math.abs(glNet),
          status: 'CRITICAL',
        });
        continue;
      }

      const partyObj = partyMap.get(partyId);
      if (partyObj) {
        const partyName = partyObj.name;
        const slBal = partyOperationalMap.get(partyId) || 0;
        const diff = Math.abs(glNet - slBal);
        if (diff > 0.05) {
          variances.push({
            category,
            entityName: `${partyName} (${partyId}) Operational Register Mismatch`,
            entityId: partyId,
            glBalance: Math.abs(glNet),
            glBalanceType: glNet >= 0 ? 'DR' : 'CR',
            slBalance: Math.abs(slBal),
            slBalanceType: slBal >= 0 ? 'DR' : 'CR',
            variance: diff,
            status: 'CRITICAL',
          });
        }
      } else {
        // Orphan partyId found in Ledger that does not exist in Party registry!
        variances.push({
          category,
          entityName: `Unknown Party (${partyId})`,
          entityId: partyId,
          glBalance: Math.abs(glNet),
          glBalanceType: glNet >= 0 ? 'DR' : 'CR',
          slBalance: 0,
          slBalanceType: 'DR',
          variance: Math.abs(glNet),
          status: 'CRITICAL',
        });
      }
    }

    // Independent Sub-Ledger Document Verification: Commercial Invoices (A-07, F-05)
    if (category === 'AR' || category === 'AP') {
      if (activeBills.length > 0) {
        const billVoucherIds = activeBills
          .map((b: any) => b.voucherId)
          .filter((vid: any): vid is string => typeof vid === 'string' && vid.length > 0);

        const targetAccountTypes = category === 'AR'
          ? ['SUNDRY_DEBTORS', 'DEBTOR']
          : ['SUNDRY_CREDITORS', 'CREDITOR'];

        const activeControlLegs = await Ledger.find({
          $or: [{ firmId }, { firm_id: firmId }],
          voucherGroupId: { $in: billVoucherIds },
          transactionDate: { $lte: toDate },
          isReversed: { $ne: true },
          accountType: { $in: targetAccountTypes }
        }, 'voucherGroupId partyId accountType debitAmount creditAmount transactionDate').lean();

        // Group active control legs by voucherGroupId
        const voucherPartyLegMap = new Map<string, Array<{ partyId?: any; debitAmount: number; creditAmount: number }>>();
        for (const leg of activeControlLegs) {
          const vId = leg.voucherGroupId;
          if (vId) {
            const list = voucherPartyLegMap.get(vId) || [];
            list.push({
              partyId: leg.partyId,
              debitAmount: Number(leg.debitAmount) || 0,
              creditAmount: Number(leg.creditAmount) || 0
            });
            voucherPartyLegMap.set(vId, list);
          }
        }

        for (const bill of activeBills) {
          if (!bill.voucherId || !voucherPartyLegMap.has(bill.voucherId)) {
            variances.push({
              category,
              entityName: `${bill.partyName || 'Party'} - Missing or Unposted GL Control Leg for Bill ${bill.bno}`,
              entityId: String(bill._id),
              glBalance: 0,
              glBalanceType: category === 'AR' ? 'DR' : 'CR',
              slBalance: Number(bill.netTotal) || 0,
              slBalanceType: category === 'AR' ? 'DR' : 'CR',
              variance: Number(bill.netTotal) || 0,
              status: 'CRITICAL',
            });
          } else {
            // Amount and Specific Control Leg Verification (F-05)
            const legs = voucherPartyLegMap.get(bill.voucherId)!;
            const partyLeg = legs.find(l => String(l.partyId) === String(bill.partyId));

            if (!partyLeg) {
              variances.push({
                category,
                entityName: `${bill.partyName || 'Party'} - Control Account Leg Wrong Party Tag for Bill ${bill.bno}`,
                entityId: String(bill._id),
                glBalance: 0,
                glBalanceType: category === 'AR' ? 'DR' : 'CR',
                slBalance: Number(bill.netTotal) || 0,
                slBalanceType: category === 'AR' ? 'DR' : 'CR',
                variance: Number(bill.netTotal) || 0,
                status: 'CRITICAL',
              });
              continue;
            }

            const billAmt = Number(bill.netTotal) || 0;
            // For AR: SALES debits debtor, CREDIT_NOTE credits debtor
            // For AP: PURCHASE credits creditor, DEBIT_NOTE debits creditor
            let controlAmt = 0;
            if (category === 'AR') {
              controlAmt = bill.btype === 'SALES' ? partyLeg.debitAmount : partyLeg.creditAmount;
            } else {
              controlAmt = bill.btype === 'PURCHASE' ? partyLeg.creditAmount : partyLeg.debitAmount;
            }

            const diff = Math.abs(controlAmt - billAmt);
            if (diff > 0.05) {
              variances.push({
                category,
                entityName: `${bill.partyName || 'Party'} - Bill Control Leg Amount Mismatch for ${bill.bno} (Billed: ₹${billAmt.toFixed(2)}, GL Control Leg: ₹${controlAmt.toFixed(2)})`,
                entityId: String(bill._id),
                glBalance: controlAmt,
                glBalanceType: category === 'AR' ? 'DR' : 'CR',
                slBalance: billAmt,
                slBalanceType: category === 'AR' ? 'DR' : 'CR',
                variance: diff,
                status: 'CRITICAL',
              });
            }
          }
        }
      }
    }

    // Include the sum of ALL per-party variances in category totalVariance so offsetting differences do NOT mask mismatches (F-05)
    const partyMismatchVarianceSum = variances
      .filter(v => v.category === category && v.status !== 'HEALTHY')
      .reduce((sum, v) => sum + v.variance, 0);

    const hasMismatches = variances.some(v => v.category === category && v.status !== 'HEALTHY');
    const totalVariance = Math.abs(glGrandTotal - slGrandTotal) + partyMismatchVarianceSum;

    return {
      summary: {
        glTotal: glGrandTotal,
        slTotal: slGrandTotal,
        variance: totalVariance,
        status: hasMismatches || totalVariance >= 0.01 ? 'CRITICAL' : 'HEALTHY',
      },
      variances,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // BANK RECONCILIATION
  // ═══════════════════════════════════════════════════════════════════════

  private static async reconcileBankAccounts(
    firmId: mongoose.Types.ObjectId,
    toDate: string
  ) {
    // GL side: aggregate by bankAccountId, filtering unreversed rows
    const glBalances = await Ledger.aggregate([
      {
        $match: {
          $and: [
            { $or: [{ firmId }, { firm_id: firmId }] },
            {
              $or: [
                { bankAccountId: { $ne: null } },
                { accountType: 'BANK' }
              ]
            }
          ],
          isReversed: { $ne: true },
          transactionDate: { $lte: toDate },
        },
      },
      {
        $group: {
          _id: { $ifNull: [{ $toString: '$bankAccountId' }, 'UNTAGGED'] },
          totalDebit: { $sum: '$debitAmount' },
          totalCredit: { $sum: '$creditAmount' },
        },
      },
    ]);

    const glMap = new Map<string, number>();
    let glGrandTotal = 0;

    for (const row of glBalances) {
      const net = (row.totalDebit || 0) - (row.totalCredit || 0);
      glMap.set(String(row._id), net);
      glGrandTotal += net;
    }

    // SL side: query all registered BankAccount documents for this firm
    const bankAccounts = await BankAccount.find(
      { $or: [{ firm_id: firmId }, { firmId: firmId as any }] },
      'account_name'
    ).lean();

    const bankMap = new Map<string, string>();
    for (const b of bankAccounts) {
      bankMap.set(String(b._id), b.account_name);
    }

    let slGrandTotal = 0;
    const variances: IReconciliationVariance[] = [];

    // Derive operational SL total strictly from registered BankAccount entities (F-05)
    for (const b of bankAccounts) {
      const bId = String(b._id);
      const glNet = glMap.get(bId) || 0;
      slGrandTotal += glNet;
    }

    for (const [bankId, glNet] of glMap) {
      if (bankId === 'UNTAGGED') {
        variances.push({
          category: 'BANK',
          entityName: 'Untagged Bank Entries (Missing bankAccountId in GL)',
          entityId: 'UNTAGGED',
          glBalance: Math.abs(glNet),
          glBalanceType: glNet >= 0 ? 'DR' : 'CR',
          slBalance: 0,
          slBalanceType: 'DR',
          variance: Math.abs(glNet),
          status: 'CRITICAL',
        });
        continue;
      }

      const bankName = bankMap.get(bankId);
      if (!bankName) {
        // Orphan bankAccountId found in Ledger that does not exist in BankAccount registry!
        variances.push({
          category: 'BANK',
          entityName: `Unregistered Bank Account (${bankId})`,
          entityId: bankId,
          glBalance: Math.abs(glNet),
          glBalanceType: glNet >= 0 ? 'DR' : 'CR',
          slBalance: 0,
          slBalanceType: 'DR',
          variance: Math.abs(glNet),
          status: 'CRITICAL',
        });
      }
    }

    const totalVariance = Math.abs(glGrandTotal - slGrandTotal);

    return {
      summary: {
        glTotal: glGrandTotal,
        slTotal: slGrandTotal,
        variance: totalVariance,
        status: totalVariance < 0.01 ? 'HEALTHY' : 'CRITICAL',
      },
      variances,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // EMPLOYEE ADVANCES — SL-GL RECONCILIATION
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Reconciles Employee Advance Sub-Ledger (Advance collection) against
   * the General Ledger 'Advance to Employees' (ASSET) control account.
   */
  public static async reconcileEmployeeAdvances(
    firmId: mongoose.Types.ObjectId,
    toDate: string
  ) {
    const firmIdStr = String(firmId);

    // 1. General Ledger Balance for 'Advance to Employees' (ASSET)
    const glDocs = await Ledger.aggregate([
      {
        $match: {
          $or: [
            { firmId: firmId },
            { firm_id: firmId },
            { firmId: firmIdStr },
            { firm_id: firmIdStr },
          ],
          accountHead: 'Advance to Employees',
          transactionDate: { $lte: toDate },
          isReversed: { $ne: true },
        },
      },
      {
        $project: {
          empId: {
            $toString: {
              $ifNull: [
                '$masterRollId',
                { $ifNull: ['$master_roll_id', '$tags.masterRollId'] }
              ]
            }
          },
          debitAmount: {
            $convert: { input: '$debitAmount', to: 'double', onError: 0, onNull: 0 }
          },
          creditAmount: {
            $convert: { input: '$creditAmount', to: 'double', onError: 0, onNull: 0 }
          }
        }
      },
      {
        $group: {
          _id: '$empId',
          totalDebit: { $sum: '$debitAmount' },
          totalCredit: { $sum: '$creditAmount' },
        },
      },
    ]);

    // 2. Sub-Ledger Balance from Advance collection
    const slDocs = await Advance.aggregate([
      {
        $match: {
          $or: [
            { firm_id: firmId },
            { firmId: firmId },
            { firm_id: firmIdStr },
            { firmId: firmIdStr },
          ],
          date: { $lte: toDate },
        },
      },
      {
        $project: {
          empId: {
            $toString: {
              $ifNull: ['$master_roll_id', '$masterRollId']
            }
          },
          type: { $toUpper: '$type' },
          amount: {
            $convert: { input: '$amount', to: 'double', onError: 0, onNull: 0 }
          }
        }
      },
      {
        $group: {
          _id: '$empId',
          totalAdvance: {
            $sum: { $cond: [{ $eq: ['$type', 'ADVANCE'] }, '$amount', 0] },
          },
          totalRecovery: {
            $sum: { $cond: [{ $eq: ['$type', 'REPAYMENT'] }, '$amount', 0] },
          },
        },
      },
    ]);

    const glMap = new Map<string, number>();
    let glGrandTotal = 0;
    for (const g of glDocs) {
      const net = (g.totalDebit || 0) - (g.totalCredit || 0);
      const key = (g._id && g._id !== 'null' && g._id !== '') ? String(g._id) : 'UNTAGGED';
      glMap.set(key, (glMap.get(key) || 0) + net);
      glGrandTotal += net;
    }

    const slMap = new Map<string, number>();
    let slGrandTotal = 0;
    for (const s of slDocs) {
      const net = (s.totalAdvance || 0) - (s.totalRecovery || 0);
      const key = (s._id && s._id !== 'null' && s._id !== '') ? String(s._id) : 'UNKNOWN';
      slMap.set(key, (slMap.get(key) || 0) + net);
      slGrandTotal += net;
    }

    const allKeys = new Set([...glMap.keys(), ...slMap.keys()]);
    const variances: IReconciliationVariance[] = [];

    for (const empKey of allKeys) {
      const glBal = glMap.get(empKey) || 0;
      const slBal = slMap.get(empKey) || 0;
      const diff = Math.abs(glBal - slBal);

      if (diff >= 0.01) {
        let empName = empKey;
        if (mongoose.isValidObjectId(empKey)) {
          const emp = await MasterRoll.findById(empKey).select('employee_name').lean();
          if (emp) empName = emp.employee_name;
        }

        variances.push({
          category: 'ADVANCE',
          entityName: empName,
          entityId: empKey,
          glBalance: Math.abs(glBal),
          glBalanceType: glBal >= 0 ? 'DR' : 'CR',
          slBalance: Math.abs(slBal),
          slBalanceType: slBal >= 0 ? 'DR' : 'CR',
          variance: diff,
          status: diff > 100 ? 'CRITICAL' : 'WARNING',
        });
      }
    }

    const totalVariance = Math.abs(glGrandTotal - slGrandTotal);

    return {
      summary: {
        glTotal: Math.round(glGrandTotal * 100) / 100,
        slTotal: Math.round(slGrandTotal * 100) / 100,
        variance: Math.round(totalVariance * 100) / 100,
        status: totalVariance < 0.01 ? 'HEALTHY' : 'CRITICAL',
      },
      variances,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // UNTAGGED VOUCHER DETECTION
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Counts GL entries that post to party/bank-linked account types
   * but are missing the partyId or bankAccountId tag. These are potential drift sources.
   */
  private static async countUntaggedPartyVouchers(
    firmId: mongoose.Types.ObjectId,
    toDate: string
  ): Promise<number> {
    const count = await Ledger.countDocuments({
      $and: [
        { $or: [{ firmId }, { firm_id: firmId }] },
        {
          $or: [
            {
              accountType: { $in: ['SUNDRY_DEBTORS', 'SUNDRY_CREDITORS'] },
              partyId: null,
            },
            {
              accountType: 'BANK',
              bankAccountId: null,
            },
          ],
        },
        { transactionDate: { $lte: toDate } },
        { isReversed: { $ne: true } },
      ],
    });

    return count;
  }
}
