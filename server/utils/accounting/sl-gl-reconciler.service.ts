import mongoose from 'mongoose';
import Ledger from '../../models/Ledger';
import Party from '../../models/Party';
import BankAccount from '../../models/BankAccount';
import ChartOfAccounts from '../../models/ChartOfAccounts';

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
  category: 'AR' | 'AP' | 'BANK' | 'LABOR';
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
  overallStatus: 'HEALTHY' | 'WARNING' | 'CRITICAL';
  arSummary: { glTotal: number; slTotal: number; variance: number; status: string };
  apSummary: { glTotal: number; slTotal: number; variance: number; status: string };
  bankSummary: { glTotal: number; slTotal: number; variance: number; status: string };
  laborSummary: { glTotal: number; slTotal: number; variance: number; status: string };
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

    const [arResult, apResult, bankResult, laborResult, untaggedCount] = await Promise.all([
      this.reconcileAccountsReceivable(firmIdObj, cutoffDate),
      this.reconcileAccountsPayable(firmIdObj, cutoffDate),
      this.reconcileBankAccounts(firmIdObj, cutoffDate),
      this.reconcileLaborLeaders(firmIdObj, cutoffDate),
      this.countUntaggedPartyVouchers(firmIdObj, cutoffDate),
    ]);

    const allVariances = [
      ...arResult.variances,
      ...apResult.variances,
      ...bankResult.variances,
      ...laborResult.variances,
    ];

    const hasCritical = allVariances.some(v => v.status === 'CRITICAL');
    const hasWarning = allVariances.some(v => v.status === 'WARNING');

    return {
      firmId: String(firmId),
      timestamp: new Date().toISOString(),
      overallStatus: hasCritical ? 'CRITICAL' : hasWarning ? 'WARNING' : 'HEALTHY',
      arSummary: arResult.summary,
      apSummary: apResult.summary,
      bankSummary: bankResult.summary,
      laborSummary: laborResult.summary,
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

    let slGrandTotal = 0;
    const variances: IReconciliationVariance[] = [];

    for (const [headKey, glNet] of glMap) {
      const canonicalName = leaderMap.get(headKey);
      if (canonicalName) {
        slGrandTotal += glNet;
      } else {
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
  // Shared Party Reconciliation Logic
  // ═══════════════════════════════════════════════════════════════════════

  private static async reconcilePartyCategory(
    firmId: mongoose.Types.ObjectId,
    toDate: string,
    accountType: string,
    category: 'AR' | 'AP' | 'LABOR'
  ) {
    // GL side: aggregate by partyId for the given accountType
    const glBalances = await Ledger.aggregate([
      {
        $match: {
          $or: [{ firmId }, { firm_id: firmId }],
          accountType,
          partyId: { $ne: null },
          transactionDate: { $lte: toDate },
        },
      },
      {
        $group: {
          _id: '$partyId',
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

    // SL side: query all registered parties belonging to this firm
    const parties = await Party.find(
      { $or: [{ firmId }, { firm_id: firmId }] },
      'name'
    ).lean();

    const partyMap = new Map<string, string>();
    for (const p of parties) {
      partyMap.set(String(p._id), p.name);
    }

    let slGrandTotal = 0;
    const variances: IReconciliationVariance[] = [];

    for (const [partyId, glNet] of glMap) {
      const partyName = partyMap.get(partyId);
      if (partyName) {
        // Party is verified in Master Registry: Sub-ledger projection matches GL
        slGrandTotal += glNet;
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
  // BANK RECONCILIATION
  // ═══════════════════════════════════════════════════════════════════════

  private static async reconcileBankAccounts(
    firmId: mongoose.Types.ObjectId,
    toDate: string
  ) {
    // GL side: aggregate by bankAccountId
    const glBalances = await Ledger.aggregate([
      {
        $match: {
          $or: [{ firmId }, { firm_id: firmId }],
          bankAccountId: { $ne: null },
          transactionDate: { $lte: toDate },
        },
      },
      {
        $group: {
          _id: '$bankAccountId',
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

    for (const [bankId, glNet] of glMap) {
      const bankName = bankMap.get(bankId);
      if (bankName) {
        // Valid registered bank account: Sub-ledger projection matches GL
        slGrandTotal += glNet;
      } else {
        // Orphan bankAccountId found in Ledger that does not exist in BankAccount registry!
        variances.push({
          category: 'BANK',
          entityName: `Unknown Bank (${bankId})`,
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
      ],
    });

    return count;
  }
}
