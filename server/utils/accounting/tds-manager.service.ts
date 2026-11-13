import mongoose from 'mongoose';
import Ledger, { type ILedger } from '../../models/Ledger';
import Party, { type IParty } from '../../models/Party';
import BankAccount, { type IBankAccount } from '../../models/BankAccount';
import ChartOfAccounts from '../../models/ChartOfAccounts';
import User from '../../models/User';
import { TdsCalculator, type PanValidationResult } from './tds-calculator';
import { getSql, connectPostgres } from '../pg.config';

export interface ITdsFilterParams {
  firmId: mongoose.Types.ObjectId | string;
  financialYear?: string; // e.g. "2026-27"
  quarter?: 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'ALL';
  section?: string; // e.g. '194C', '194J', '194I', '194H', 'ALL'
  fromDate?: string;
  toDate?: string;
  search?: string;
}

export interface ITdsRegisterItem {
  id: string;
  voucherGroupId: string;
  voucherNo: string;
  voucherType: string;
  transactionDate: string;
  section: string; // '194C', '194J', etc.
  payeeName: string;
  payeeType: string; // 'INDIVIDUAL' | 'COMPANY' | 'FIRM' | 'OTHER' | 'UNKNOWN'
  panNumber: string;
  isPanValid: boolean;
  panEntityType: string;
  grossAmount: number;
  tdsRate: number;
  tdsAmount: number;
  netAmount: number;
  isGrossUp: boolean;
  bankAccountName: string;
  bankAccountNumber?: string;
  paymentMode: string;
  narration: string;
  challanStatus: 'PENDING' | 'DEPOSITED';
  challanBSRCode?: string;
  challanNumber?: string;
  challanDate?: string;
}

export interface ITdsSummaryMetrics {
  totalGross: number;
  totalTds: number;
  totalNet: number;
  totalDeductees: number;
  validPanCount: number;
  missingPanCount: number;
  panComplianceRate: number;
  sectionBreakdown: Record<string, { count: number; gross: number; tds: number }>;
  quarterBreakdown: Record<string, { count: number; gross: number; tds: number }>;
}

export interface ITdsRegisterResult {
  financialYear: string;
  quarter: string;
  fromDate: string;
  toDate: string;
  metrics: ITdsSummaryMetrics;
  items: ITdsRegisterItem[];
}

export class TdsManagerService {
  /**
   * Identifies whether a ledger leg represents a genuine TDS liability deduction.
   * Strictly excludes Bank, Cash, Customer, Supplier, and Expense legs.
   */
  public static isTdsLiabilityLeg(leg: any): boolean {
    const cr = Number(leg.creditAmount || 0);
    if (cr <= 0) return false;

    const accType = (leg.accountType || '').toUpperCase();
    const accHead = (leg.accountHead || '').toLowerCase().trim();

    // STRICT EXCLUSIONS: Bank, Cash, Expense, Customer, Supplier, Labor Leader can NEVER be TDS liability!
    if (['BANK', 'CASH', 'CUSTOMER', 'SUPPLIER', 'EXPENSE', 'DIRECT_EXPENSE', 'INDIRECT_EXPENSE', 'LABOR_LEADER'].includes(accType)) {
      return false;
    }
    if (leg.bankAccountId) {
      return false;
    }
    if (accHead.includes('borne by company')) {
      return false; // Debit side of gross-up
    }

    // STRICT INCLUSIONS:
    if (accType === 'DUTIES_AND_TAXES') return true;
    if (/\btds\b/i.test(accHead) || /\btax deducted\b/i.test(accHead) || /\bwithholding\b/i.test(accHead)) {
      return true;
    }

    return false;
  }

  /**
   * Resolves the start and end dates based on financial year and quarter.
   * Indian Financial Year: April 1 to March 31.
   */
  public static resolvePeriodDates(params: {
    financialYear?: string;
    quarter?: string;
    fromDate?: string;
    toDate?: string;
  }): { startDate: string; endDate: string; fy: string; qtr: string } {
    let fy = params.financialYear;
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    if (!fy) {
      const fyStart = currentMonth >= 4 ? currentYear : currentYear - 1;
      fy = `${fyStart}-${String(fyStart + 1).slice(-2)}`;
    }

    const [startYearStr] = fy.split('-');
    const startYear = parseInt(startYearStr || '2026', 10);
    const endYear = startYear + 1;

    const qtr = (params.quarter || 'ALL').toUpperCase();

    let startDate = `${startYear}-04-01`;
    let endDate = `${endYear}-03-31`;

    switch (qtr) {
      case 'Q1':
        startDate = `${startYear}-04-01`;
        endDate = `${startYear}-06-30`;
        break;
      case 'Q2':
        startDate = `${startYear}-07-01`;
        endDate = `${startYear}-09-30`;
        break;
      case 'Q3':
        startDate = `${startYear}-10-01`;
        endDate = `${startYear}-12-31`;
        break;
      case 'Q4':
        startDate = `${endYear}-01-01`;
        endDate = `${endYear}-03-31`;
        break;
      case 'ALL':
      default:
        startDate = `${startYear}-04-01`;
        endDate = `${endYear}-03-31`;
        break;
    }

    if (params.fromDate && params.fromDate.trim()) {
      startDate = params.fromDate.trim();
    }
    if (params.toDate && params.toDate.trim()) {
      endDate = params.toDate.trim();
    }

    return { startDate, endDate, fy, qtr };
  }

  /**
   * Detects the statutory TDS Section code from the account head or narration.
   */
  public static inferTdsSection(accountHead: string, narration: string = ''): string {
    const combined = `${accountHead} ${narration}`.toUpperCase();
    if (combined.includes('194C') || combined.includes('CONTRACTOR') || combined.includes('SUBCON')) return '194C';
    if (combined.includes('194J') || combined.includes('PROFESSIONAL') || combined.includes('TECHNICAL')) return '194J';
    if (combined.includes('194I') || combined.includes('RENT')) return '194I';
    if (combined.includes('194H') || combined.includes('COMMISSION') || combined.includes('BROKERAGE')) return '194H';
    if (combined.includes('194Q')) return '194Q';
    if (combined.includes('194A') || combined.includes('INTEREST')) return '194A';
    if (combined.includes('192') || combined.includes('SALARY')) return '192';
    return 'UNCLASSIFIED';
  }

  /**
   * Fetches the TDS Register with comprehensive cross-leg aggregation.
   * Guarantees EXACTLY ONE row per voucher group to eliminate double-counting.
   */
  public static async getTdsRegister(params: ITdsFilterParams): Promise<ITdsRegisterResult> {
    const firmIdObj = new mongoose.Types.ObjectId(String(params.firmId));
    const { startDate, endDate, fy, qtr } = this.resolvePeriodDates(params);

    // 1. Fetch only genuine TDS liability credit entries in date range
    const candidateTdsEntries = await Ledger.find({
      $and: [
        { $or: [{ firmId: firmIdObj }, { firm_id: firmIdObj }] },
        {
          $or: [
            { accountType: 'DUTIES_AND_TAXES' },
            { accountHead: { $regex: /\btds\b|\btax deducted\b|\bwithholding\b/i } }
          ]
        }
      ],
      transactionDate: { $gte: startDate, $lte: endDate },
      creditAmount: { $gt: 0 },
      isReversed: { $ne: true },
      accountHead: { $not: /borne by company/i }
    }).lean();

    // Strictly filter through isTdsLiabilityLeg to eliminate any bank/cash lines
    const genuineTdsEntries = candidateTdsEntries.filter(l => this.isTdsLiabilityLeg(l));

    if (genuineTdsEntries.length === 0) {
      return {
        financialYear: fy,
        quarter: qtr,
        fromDate: startDate,
        toDate: endDate,
        metrics: {
          totalGross: 0,
          totalTds: 0,
          totalNet: 0,
          totalDeductees: 0,
          validPanCount: 0,
          missingPanCount: 0,
          panComplianceRate: 100,
          sectionBreakdown: {},
          quarterBreakdown: {}
        },
        items: []
      };
    }

    // 2. Fetch all voucher legs sharing these voucherGroupIds
    const voucherGroupIds = Array.from(new Set(
      genuineTdsEntries
        .map(e => e.voucherGroupId)
        .filter((id): id is string => Boolean(id))
    ));

    const allLegs = await Ledger.find({
      $or: [{ firmId: firmIdObj }, { firm_id: firmIdObj }],
      voucherGroupId: { $in: voucherGroupIds },
      isReversed: { $ne: true }
    }).lean();

    // Group all legs by voucherGroupId
    const legsByGroup = new Map<string, typeof allLegs>();
    for (const leg of allLegs) {
      if (!leg.voucherGroupId) continue;
      const existing = legsByGroup.get(leg.voucherGroupId) || [];
      existing.push(leg);
      legsByGroup.set(leg.voucherGroupId, existing);
    }

    // 3. Preload Party, BankAccount, and User lookup maps
    const [partyList, bankList, userList] = await Promise.all([
      Party.find({ $or: [{ firmId: firmIdObj }, { firm_id: firmIdObj }] }).lean(),
      BankAccount.find({ $or: [{ firmId: firmIdObj }, { firm_id: firmIdObj }] }).lean(),
      User.find({ 'firms.firm': firmIdObj }).lean()
    ]);

    const partyById = new Map<string, (typeof partyList)[0]>();
    const partyByName = new Map<string, (typeof partyList)[0]>();
    for (const p of partyList) {
      partyById.set(p._id.toString(), p);
      partyByName.set(p.name.trim().toLowerCase(), p);
    }

    const bankById = new Map<string, (typeof bankList)[0]>();
    for (const b of bankList) {
      bankById.set(b._id.toString(), b);
    }

    // Preload PostgreSQL labor_leaders if available
    const pgLeaderPanMap = new Map<string, string>();
    try {
      let sql = getSql();
      if (!sql) sql = await connectPostgres();
      if (sql) {
        const rows = await sql`SELECT id, name, pan FROM labor_leaders WHERE firm_id = ${String(params.firmId)}`;
        for (const row of rows) {
          if (row.pan) {
            pgLeaderPanMap.set(String(row.id), row.pan);
            pgLeaderPanMap.set(String(row.name).trim().toLowerCase(), row.pan);
          }
        }
      }
    } catch {
      // safe fallback if PG is unavailable
    }

    // 4. Construct aggregated TDS items — ONE ITEM PER VOUCHER GROUP
    const rawItems: ITdsRegisterItem[] = [];

    for (const vGroupId of voucherGroupIds) {
      const siblingLegs = legsByGroup.get(vGroupId) || [];
      if (siblingLegs.length === 0) continue;

      // Genuine TDS liability legs in this voucher
      const tdsLegs = siblingLegs.filter(l => this.isTdsLiabilityLeg(l));
      const totalTdsAmt = tdsLegs.reduce((sum, l) => sum + (Number(l.creditAmount) || 0), 0);
      if (totalTdsAmt <= 0) continue;

      const primaryTdsLeg = tdsLegs[0];
      if (!primaryTdsLeg) continue;

      // Check if Gross-Up applies (company bears the TDS u/s 195A)
      const isGrossUp = (primaryTdsLeg as any)?.statutory?.isGrossUp !== undefined
        ? Boolean((primaryTdsLeg as any).statutory.isGrossUp)
        : siblingLegs.some(l => 
            (l.accountHead || '').toLowerCase().includes('tds borne by company') ||
            (l.narration || '').toLowerCase().includes('grossed-up') ||
            (l.narration || '').toLowerCase().includes('195a')
          );

      // Debit legs (Expense, Party, Labor Leader)
      const debitLegs = siblingLegs.filter(l => (Number(l.debitAmount) || 0) > 0);

      // Compute Gross Amount
      let grossAmount = 0;
      if (isGrossUp) {
        // For Gross-Up, gross is the sum of Net expense + Company-borne TDS expense
        grossAmount = debitLegs.reduce((sum, l) => sum + (Number(l.debitAmount) || 0), 0);
      } else {
        // For Standard deduction, sum non-TDS debit lines
        const nonTaxDebits = debitLegs.filter(l => !(l.accountHead || '').toLowerCase().includes('tds'));
        grossAmount = nonTaxDebits.reduce((sum, l) => sum + (Number(l.debitAmount) || 0), 0);
        if (grossAmount === 0 && debitLegs.length > 0) {
          grossAmount = debitLegs.reduce((sum, l) => sum + (Number(l.debitAmount) || 0), 0);
        }
      }

      // Bank or Cash Leg (Credit) -> This is the actual Net Payout disbursed!
      const bankLegs = siblingLegs.filter(l => 
        (l.accountType === 'BANK' || l.accountType === 'CASH' || l.bankAccountId) &&
        (Number(l.creditAmount) || 0) > 0
      );

      let netAmount = bankLegs.reduce((sum, l) => sum + (Number(l.creditAmount) || 0), 0);
      if (netAmount === 0) {
        netAmount = Math.max(0, grossAmount - totalTdsAmt);
      }

      // Bank details from primary bank leg
      const primaryBankLeg = bankLegs[0];
      let bankName = primaryBankLeg?.accountHead || 'Bank Account';
      let bankAccNo = '';
      if (primaryBankLeg?.bankAccountId) {
        const bDoc = bankById.get(primaryBankLeg.bankAccountId.toString());
        if (bDoc) {
          bankName = bDoc.account_name || bDoc.bank_name;
          bankAccNo = bDoc.account_number;
        }
      }

      // Detect Section: Prioritize first-class statutory metadata over regex inference
      const statutorySection = (primaryTdsLeg as any)?.statutory?.tdsSection;
      const section = statutorySection || this.inferTdsSection(primaryTdsLeg.accountHead || '', primaryTdsLeg.narration || '');

      // Payee Resolution
      const payeeLeg = debitLegs.find(l => !(l.accountHead || '').toLowerCase().includes('tds')) || debitLegs[0];
      let payeeName = '';
      let payeePan = '';
      let partyDoc: (typeof partyList)[0] | undefined;

      // 1. Check partyId on any leg
      const legWithParty = siblingLegs.find(l => l.partyId);
      if (legWithParty?.partyId) {
        partyDoc = partyById.get(legWithParty.partyId.toString());
      }

      // 2. Clean head and match by name
      const rawHead = payeeLeg?.accountHead || '';
      const headClean = rawHead.replace(/^(subcontract\s*-\s*|vendor\s*-\s*|supplier\s*-\s*|party\s*-\s*)/i, '').trim();

      if (!partyDoc && headClean) {
        partyDoc = partyByName.get(headClean.toLowerCase()) || partyByName.get(rawHead.toLowerCase());
      }

      if (partyDoc) {
        payeeName = partyDoc.name;
        if (partyDoc.pan) payeePan = partyDoc.pan;
      } else {
        payeeName = headClean || 'Third Party Payee';
      }

      // Clean prefix from payeeName
      payeeName = payeeName.replace(/^(subcontract\s*-\s*|vendor\s*-\s*|supplier\s*-\s*)/i, '').trim();

      // 3. Match Subcontractor User for PAN
      if (!payeePan && payeeName) {
        const matchedUser = userList.find(u => 
          u.name.trim().toLowerCase() === payeeName.toLowerCase() ||
          (u as any).username?.toLowerCase() === payeeName.toLowerCase()
        );
        if (matchedUser) {
          const firmAssignment = matchedUser.firms?.find(f => f.firm.toString() === firmIdObj.toString());
          if (firmAssignment?.panNumber) {
            payeePan = firmAssignment.panNumber;
          }
        }
      }

      // 4. Match PostgreSQL labor leaders map for PAN
      if (!payeePan && payeeName) {
        const pgPan = pgLeaderPanMap.get(payeeName.toLowerCase());
        if (pgPan) payeePan = pgPan;
      }

      // PAN Validation
      const panValidation = TdsCalculator.validatePan(payeePan);

      // Statutory Rate: Strictly adheres to Section 194C / Form 26Q statutory rates (1%, 2%, or 20%)
      let tdsRate = Number((primaryTdsLeg as any)?.statutory?.tdsRate);
      if (isNaN(tdsRate) || tdsRate <= 0) {
        tdsRate = panValidation.default194CRate;
      }
      if (totalTdsAmt > 0 && tdsRate === 0) {
        tdsRate = panValidation.isIndividual ? 1 : 2;
      }

      rawItems.push({
        id: primaryTdsLeg._id.toString(),
        voucherGroupId: vGroupId,
        voucherNo: primaryTdsLeg.voucherNo || `VCH-${vGroupId.slice(-8)}`,
        voucherType: primaryTdsLeg.voucherType || 'PAYMENT',
        transactionDate: primaryTdsLeg.transactionDate,
        section,
        payeeName,
        payeeType: panValidation.entityType,
        panNumber: payeePan ? payeePan.toUpperCase() : '',
        isPanValid: panValidation.isValid,
        panEntityType: panValidation.entityType,
        grossAmount: Number(grossAmount.toFixed(2)),
        tdsRate,
        tdsAmount: Number(totalTdsAmt.toFixed(2)),
        netAmount: Number(netAmount.toFixed(2)),
        isGrossUp,
        bankAccountName: bankName,
        bankAccountNumber: bankAccNo,
        paymentMode: primaryBankLeg?.paymentMode || 'BANK',
        narration: primaryTdsLeg.narration || payeeLeg?.narration || '',
        challanStatus: 'PENDING'
      });
    }

    // 5. Apply filters: Section and Search
    let filteredItems = rawItems;

    if (params.section && params.section !== 'ALL') {
      const targetSec = params.section.toUpperCase();
      filteredItems = filteredItems.filter(i => i.section.toUpperCase() === targetSec);
    }

    if (params.search && params.search.trim()) {
      const q = params.search.trim().toLowerCase();
      filteredItems = filteredItems.filter(i => 
        i.payeeName.toLowerCase().includes(q) ||
        i.panNumber.toLowerCase().includes(q) ||
        i.voucherNo.toLowerCase().includes(q) ||
        i.narration.toLowerCase().includes(q) ||
        i.bankAccountName.toLowerCase().includes(q)
      );
    }

    // Sort chronologically
    filteredItems.sort((a, b) => new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime());

    // 6. Aggregate Metrics
    let totalGross = 0;
    let totalTds = 0;
    let totalNet = 0;
    let validPanCount = 0;
    let missingPanCount = 0;
    const sectionBreakdown: Record<string, { count: number; gross: number; tds: number }> = {};
    const quarterBreakdown: Record<string, { count: number; gross: number; tds: number }> = {
      Q1: { count: 0, gross: 0, tds: 0 },
      Q2: { count: 0, gross: 0, tds: 0 },
      Q3: { count: 0, gross: 0, tds: 0 },
      Q4: { count: 0, gross: 0, tds: 0 },
    };

    const uniqueDeductees = new Set<string>();

    for (const item of filteredItems) {
      totalGross += item.grossAmount;
      totalTds += item.tdsAmount;
      totalNet += item.netAmount;

      uniqueDeductees.add(item.payeeName.toLowerCase());

      if (item.isPanValid) {
        validPanCount++;
      } else {
        missingPanCount++;
      }

      // Section breakdown
      if (!sectionBreakdown[item.section]) {
        sectionBreakdown[item.section] = { count: 0, gross: 0, tds: 0 };
      }
      const secStats = sectionBreakdown[item.section]!;
      secStats.count++;
      secStats.gross += item.grossAmount;
      secStats.tds += item.tdsAmount;

      // Quarter breakdown
      const month = new Date(item.transactionDate).getMonth() + 1;
      let qKey = 'Q1';
      if (month >= 4 && month <= 6) qKey = 'Q1';
      else if (month >= 7 && month <= 9) qKey = 'Q2';
      else if (month >= 10 && month <= 12) qKey = 'Q3';
      else qKey = 'Q4';

      const qtrStats = quarterBreakdown[qKey]!;
      qtrStats.count++;
      qtrStats.gross += item.grossAmount;
      qtrStats.tds += item.tdsAmount;
    }

    const totalRecords = filteredItems.length;
    const panComplianceRate = totalRecords > 0 
      ? Math.round((validPanCount / totalRecords) * 100) 
      : 100;

    return {
      financialYear: fy,
      quarter: qtr,
      fromDate: startDate,
      toDate: endDate,
      metrics: {
        totalGross: Number(totalGross.toFixed(2)),
        totalTds: Number(totalTds.toFixed(2)),
        totalNet: Number(totalNet.toFixed(2)),
        totalDeductees: uniqueDeductees.size,
        validPanCount,
        missingPanCount,
        panComplianceRate,
        sectionBreakdown,
        quarterBreakdown
      },
      items: filteredItems
    };
  }
}
