import { defineEventHandler, getQuery } from 'h3';
import mongoose from 'mongoose';
import ChartOfAccounts from '../../models/ChartOfAccounts';
import OpeningBalance from '../../models/OpeningBalance';
import Ledger from '../../models/Ledger';
import { LedgerService } from '../../utils/accounting/ledger.service';
import { requireAuthSession } from '../../utils/auth';
import { getSql, connectPostgres } from '../../utils/pg.config';

function getCurrentFinancialYear(): string {
  const now = new Date();
  const month = now.getMonth() + 1; // 1-12
  const year = now.getFullYear();
  if (month >= 4) {
    return `${year}-${(year + 1).toString().slice(-2)}`;
  } else {
    return `${year - 1}-${year.toString().slice(-2)}`;
  }
}

export default defineEventHandler(async (event) => {
  const user = await requireAuthSession(event);
  const firmIdStr = String(user.firm_id);
  const firmIdObj = new mongoose.Types.ObjectId(firmIdStr);

  // Initialize System Accounts if not initialized
  await LedgerService.initializeChartOfAccounts(firmIdObj, new mongoose.Types.ObjectId(String(user._id)));

  let pgLeaderMap: Map<string, any> = new Map();

  // Auto-sync Labor Leaders from PostgreSQL into ChartOfAccounts
  try {
    let sql = getSql();
    if (!sql) sql = await connectPostgres();
    if (sql) {
      const pgLeaders = await sql`
        SELECT name, phone, pan, aadhaar_number, gst_number, bank_name, account_number, ifsc_code FROM labor_leaders WHERE firm_id = ${firmIdStr} AND status = 'Active'
      `;
      if (pgLeaders && pgLeaders.length > 0) {
        pgLeaderMap = new Map(pgLeaders.map((l: any) => [l.name?.trim(), l]));
        
        for (const [name, l] of pgLeaderMap.entries()) {
          if (!name) continue;
          await (ChartOfAccounts as any).findOneAndUpdate(
            {
              $or: [{ firm_id: firmIdObj }, { firmId: firmIdObj }, { firm_id: firmIdStr }, { firmId: firmIdStr }],
              account_name: name
            },
            {
              $set: {
                firm_id: firmIdObj,
                account_name: name,
                account_type: 'LABOR_LEADER',
                pan: l?.pan || null,
                aadhaar_number: l?.aadhaar_number || null,
                gstin: l?.gst_number || null,
                phone: l?.phone || null,
                bank_name: l?.bank_name || null,
                account_number: l?.account_number || null,
                ifsc_code: l?.ifsc_code ? String(l.ifsc_code).toUpperCase() : null,
                is_active: true
              }
            },
            { upsert: true }
          ).catch(() => {});
        }
      }
    }
  } catch (syncErr) {
    // Non-blocking sync fallback
  }

  const queryParams = getQuery(event);
  const search = queryParams.search ? String(queryParams.search) : '';
  const type = queryParams.type ? String(queryParams.type) : '';

  const filter: any = {
    $or: [
      { firm_id: firmIdObj },
      { firm_id: firmIdStr },
      { firmId: firmIdObj },
      { firmId: firmIdStr }
    ],
    is_active: true
  };

  if (search) {
    filter.account_name = { $regex: search, $options: 'i' };
  }
  if (type && type !== 'all') {
    filter.account_type = type;
  }

  const accounts = await ChartOfAccounts.find(filter)
    .sort({ account_type: 1, account_name: 1 })
    .lean();

  // Attach latest PostgreSQL labor leader banking info directly to returned records
  if (pgLeaderMap && pgLeaderMap.size > 0) {
    accounts.forEach((acc: any) => {
      const pgL = pgLeaderMap.get(acc.account_name?.trim());
      if (pgL) {
        if (pgL.bank_name) acc.bank_name = pgL.bank_name;
        if (pgL.account_number) acc.account_number = pgL.account_number;
        if (pgL.ifsc_code) acc.ifsc_code = String(pgL.ifsc_code).toUpperCase();
        if (pgL.phone) acc.phone = pgL.phone;
        if (pgL.pan) acc.pan = pgL.pan;
        if (pgL.aadhaar_number) acc.aadhaar_number = pgL.aadhaar_number;
      }
    });
  }

  const financialYear = getCurrentFinancialYear();

  // Fetch Opening Balances
  const obs = await (OpeningBalance as any).find({
    firmId: { $in: [firmIdObj, firmIdStr] },
    financialYear
  }).lean();

  const obMap = new Map<string, any>();
  obs.forEach((ob: any) => {
    obMap.set(ob.accountHead, ob);
  });

  // Aggregate Ledger balances per account head
  const ledgerBalances = await Ledger.aggregate([
    {
      $match: {
        firmId: { $in: [firmIdObj, firmIdStr] }
      }
    },
    {
      $group: {
        _id: '$accountHead',
        totalDebit: { $sum: '$debitAmount' },
        totalCredit: { $sum: '$creditAmount' }
      }
    }
  ]);

  const balanceMap = new Map<string, { totalDebit: number; totalCredit: number }>();
  ledgerBalances.forEach((b: any) => {
    balanceMap.set(b._id, { totalDebit: b.totalDebit || 0, totalCredit: b.totalCredit || 0 });
  });

  // Fetch Party records to enrich existing parties with GSTIN, PAN, and Contact
  const Party = (await import('../../models/Party')).default;
  const parties = await Party.find({
    $or: [
      { firmId: firmIdObj },
      { firm_id: firmIdObj },
      { firmId: firmIdStr },
      { firm_id: firmIdStr }
    ]
  }).select('name gstin pan contact').lean();

  const partyMap = new Map();
  parties.forEach((p: any) => {
    if (p.name) partyMap.set(p.name.trim().toLowerCase(), p);
  });

  // Enrich accounts with Opening & Current Balances & Statutory Details
  const enrichedAccounts = accounts.map((acc: any) => {
    const ob = obMap.get(acc.account_name);
    const ledger = balanceMap.get(acc.account_name);
    const party = partyMap.get((acc.account_name || '').trim().toLowerCase());

    const ob_debit = ob ? (ob.debitAmount || 0) : 0;
    const ob_credit = ob ? (ob.creditAmount || 0) : 0;

    const ledger_debit = ledger ? (ledger.totalDebit || 0) : 0;
    const ledger_credit = ledger ? (ledger.totalCredit || 0) : 0;

    const totalDebit = ob_debit + ledger_debit;
    const totalCredit = ob_credit + ledger_credit;

    const netBalance = totalDebit - totalCredit;
    const openingVal = ob ? (ob.debitAmount || ob.creditAmount || 0) : 0;
    const openingType = ob ? (ob.debitAmount > 0 ? 'DR' : 'CR') : 'DR';

    const resolvedGstin = acc.gstin || (party?.gstin && party.gstin !== 'UNREGISTERED' ? party.gstin : null);
    const resolvedPan = acc.pan || party?.pan || null;
    const resolvedPhone = acc.phone || party?.contact || null;

    return {
      ...acc,
      pan: resolvedPan,
      gstin: resolvedGstin,
      phone: resolvedPhone,
      opening_balance: openingVal,
      balance_type: openingType,
      current_balance: Math.abs(netBalance),
      current_balance_type: netBalance >= 0 ? 'DR' : 'CR'
    };
  });

  return {
    success: true,
    count: enrichedAccounts.length,
    data: enrichedAccounts
  };
});
