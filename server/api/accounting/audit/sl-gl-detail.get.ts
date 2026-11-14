import mongoose from 'mongoose';
import Ledger from '../../../models/Ledger';
import Advance from '../../../models/Advance';
import MasterRoll from '../../../models/MasterRoll';
import Party from '../../../models/Party';
import Bill from '../../../models/Bill';
import BankAccount from '../../../models/BankAccount';
import Wage from '../../../models/Wage';
import { requireAuthSession } from '../../../utils/auth';

export default defineEventHandler(async (event) => {
  const user = await requireAuthSession(event);
  if (!user.firm_id) {
    throw createError({ statusCode: 400, statusMessage: 'No firm associated' });
  }

  const query = getQuery(event);
  const targetId = query.id ? String(query.id) : '';
  const category = query.category ? String(query.category).toUpperCase() : undefined;
  const toDate = query.toDate ? String(query.toDate) : undefined;
  const firmIdObj = new mongoose.Types.ObjectId(String(user.firm_id));
  const firmIdStr = String(user.firm_id);

  if (!targetId || !mongoose.Types.ObjectId.isValid(targetId)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid entity ID' });
  }
  if (category && !['AR', 'AP', 'BANK', 'LABOR', 'ADVANCE'].includes(category)) {
    throw createError({ statusCode: 400, statusMessage: 'Unsupported reconciliation category' });
  }
  if (toDate) {
    const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(toDate);
    if (!dateMatch) throw createError({ statusCode: 400, statusMessage: 'Invalid toDate. Expected YYYY-MM-DD.' });
    const [, year, month, day] = dateMatch;
    const parsedDate = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    if (
      parsedDate.getUTCFullYear() !== Number(year) ||
      parsedDate.getUTCMonth() !== Number(month) - 1 ||
      parsedDate.getUTCDate() !== Number(day)
    ) {
      throw createError({ statusCode: 400, statusMessage: 'toDate must be a real calendar date.' });
    }
  }
  const targetIdObj = new mongoose.Types.ObjectId(targetId);

  // ─────────────────────────────────────────────────────────────────────────
  // 1. Check if targetId is a Party (Trade Creditor / Debtor)
  // ─────────────────────────────────────────────────────────────────────────
  let party = null;
  if (category === 'AP' || category === 'AR' || !category) {
    party = await Party.findOne({
      _id: targetIdObj,
      $or: [{ firmId: firmIdObj }, { firm_id: firmIdObj }]
    }, 'name partyType openingBalance balanceType').lean();
  }

  if (party || category === 'AP' || category === 'AR') {
    if (!party) throw createError({ statusCode: 404, statusMessage: 'Party not found in current firm' });
    const partyCategory = category === 'AR' || party?.partyType === 'CUSTOMER' ? 'AR' : 'AP';
    const targetAccountTypes = partyCategory === 'AR'
      ? ['SUNDRY_DEBTORS', 'DEBTOR']
      : ['SUNDRY_CREDITORS', 'CREDITOR'];

    // Query GL ledger entries for this party
    const ledgerFilter: any = {
      $or: [
        { firmId: firmIdObj },
        { firm_id: firmIdObj },
        { firmId: firmIdStr },
        { firm_id: firmIdStr }
      ],
      partyId: targetIdObj,
      accountType: { $in: targetAccountTypes },
      isReversed: { $ne: true }
    };
    if (toDate) {
      ledgerFilter.transactionDate = { $lte: toDate };
    }
    const ledgerEntries = await Ledger.find(ledgerFilter).sort({ transactionDate: 1 }).lean();

    let glDebit = 0;
    let glCredit = 0;
    for (const l of ledgerEntries) {
      const debit = Number(l.debitAmount);
      const credit = Number(l.creditAmount);
      if (!Number.isFinite(debit) || !Number.isFinite(credit) || debit < 0 || credit < 0) {
        throw createError({ statusCode: 409, statusMessage: `Ledger record ${l._id} has invalid debit or credit amounts.` });
      }
      glDebit += debit;
      glCredit += credit;
    }
    // For AP (Creditors): Net balance is Credit. For AR (Debtors): Net balance is Debit.
    const glNet = partyCategory === 'AP' ? (glCredit - glDebit) : (glDebit - glCredit);

    // Independent source records are shown for inspection; totals remain unavailable
    // until receipt/payment registers exist.
    const subledgerEntries: any[] = [];

    if (party.openingBalance != null) {
      const opBal = Number(party.openingBalance);
      if (!Number.isFinite(opBal)) {
        throw createError({ statusCode: 409, statusMessage: 'Party opening balance is invalid.' });
      }
      const balType = party.balanceType || 'UNKNOWN';
      subledgerEntries.push({
        _id: 'OPENING',
        date: 'Opening',
        type: `OPENING (${balType})`,
        remarks: `Party Opening Balance (${balType})`,
        amount: opBal,
        bno: 'OPENING'
      });
    }

    // Active bills
    const billTypes = partyCategory === 'AR' ? ['SALES', 'CREDIT_NOTE'] : ['PURCHASE', 'DEBIT_NOTE'];
    const billFilter: any = {
      $or: [
        { firmId: firmIdObj },
        { firm_id: firmIdObj },
        { firmId: firmIdStr },
        { firm_id: firmIdStr }
      ],
      partyId: targetIdObj,
      btype: { $in: billTypes },
      status: 'ACTIVE'
    };
    if (toDate) {
      billFilter.bdate = { $lte: toDate };
    }
    const bills = await Bill.find(billFilter).sort({ bdate: 1 }).lean();

    for (const b of bills) {
      const amt = Number(b.netTotal);
      if (!Number.isFinite(amt)) {
        throw createError({ statusCode: 409, statusMessage: `Bill ${b.bno} has an invalid net total.` });
      }
      subledgerEntries.push({
        _id: String(b._id),
        date: b.bdate,
        type: b.btype,
        remarks: `Bill #${b.bno} (Voucher: ${b.voucherId || 'None'})`,
        amount: amt,
        bno: b.bno,
        voucherId: b.voucherId
      });
    }

    return {
      success: true,
      data: {
        entityType: 'PARTY',
        category: partyCategory,
        entityName: party?.name || 'Party Account',
        party,
        employee: null,
        glSummary: {
          totalDebit: glDebit,
          totalCredit: glCredit,
          netBalance: glNet,
          balanceType: partyCategory === 'AP' ? (glNet >= 0 ? 'CR' : 'DR') : (glNet >= 0 ? 'DR' : 'CR'),
          entryCount: ledgerEntries.length
        },
        slSummary: {
          available: false,
          reason: 'Independent receipt, payment, and allocation registers are not available for this firm.',
          netBalance: null,
          balanceType: null,
          entryCount: null
        },
        variance: null,
        ledgerEntries,
        subledgerEntries,
        advanceEntries: subledgerEntries // Alias for template compatibility
      }
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 2. Check if targetId is a BankAccount
  // ─────────────────────────────────────────────────────────────────────────
  let bankAccount = null;
  if (category === 'BANK' || !category) {
    bankAccount = await BankAccount.findOne({
      _id: targetIdObj,
      $or: [{ firmId: firmIdObj }, { firm_id: firmIdObj }]
    }, 'account_name account_number').lean();
  }

  if (bankAccount || category === 'BANK') {
    if (!bankAccount) throw createError({ statusCode: 404, statusMessage: 'Bank account not found in current firm' });
    const glFilter: any = {
      $or: [
        { firmId: firmIdObj },
        { firm_id: firmIdObj },
        { firmId: firmIdStr },
        { firm_id: firmIdStr }
      ],
      bankAccountId: targetIdObj,
      isReversed: { $ne: true }
    };
    if (toDate) {
      glFilter.transactionDate = { $lte: toDate };
    }
    const ledgerEntries = await Ledger.find(glFilter).sort({ transactionDate: 1 }).lean();

    let glDebit = 0;
    let glCredit = 0;
    for (const l of ledgerEntries) {
      glDebit += Number(l.debitAmount || 0);
      glCredit += Number(l.creditAmount || 0);
    }
    const glNet = glDebit - glCredit;

    // Build operational subledger from registered wage disbursements and operational vouchers
    const wageEntries = await Wage.find({
      $or: [
        { firmId: firmIdObj },
        { firm_id: firmIdObj },
        { firmId: firmIdStr },
        { firm_id: firmIdStr }
      ],
      bank_account_id: targetIdObj,
      status: 'POSTED',
      ...(toDate ? { paid_date: { $lte: toDate } } : {})
    })
      .populate('master_roll_id', 'employee_name')
      .sort({ paid_date: 1 })
      .lean();

    const subledgerEntries: any[] = [];
    const wageVoucherGroupIds = new Set<string>();

    for (const w of wageEntries) {
      const empName = (w.master_roll_id as any)?.employee_name || 'Employee';
      const amt = Number(w.net_salary || 0);
      if (w.voucher_group_id) {
        wageVoucherGroupIds.add(String(w.voucher_group_id));
      }
      subledgerEntries.push({
        _id: String(w._id),
        date: w.paid_date || 'N/A',
        type: `WAGE (${w.payment_mode || 'NEFT'})`,
        remarks: `Wages paid to ${empName} - ${w.salary_month}${w.cheque_no ? ` - Chq: ${w.cheque_no}` : ''}`,
        amount: amt,
        bno: w.cheque_no || w.salary_month,
        voucherId: w.voucher_group_id
      });
    }

    // Non-wage operational payments / transfers in GL
    const nonWageLegs = ledgerEntries.filter(
      (l: any) => !l.isWageEntry && l.refType !== 'WAGE' && l.refType !== 'WAGE_PAYOUT' && !wageVoucherGroupIds.has(String(l.voucherGroupId))
    );
    for (const leg of nonWageLegs) {
      const amt = Number(leg.creditAmount || leg.debitAmount || 0);
      subledgerEntries.push({
        _id: String(leg._id),
        date: leg.transactionDate,
        type: leg.voucherType || (Number(leg.creditAmount) > 0 ? 'PAYMENT' : 'RECEIPT'),
        remarks: leg.narration || 'Bank Operational Transaction',
        amount: amt,
        bno: leg.voucherNo || leg.voucherGroupId || 'N/A',
        voucherId: leg.voucherGroupId
      });
    }

    // Sort all subledger entries chronologically
    subledgerEntries.sort((a, b) => String(a.date).localeCompare(String(b.date)));

    return {
      success: true,
      data: {
        entityType: 'BANK',
        category: 'BANK',
        entityName: bankAccount.account_name,
        bankAccount,
        employee: null,
        glSummary: {
          totalDebit: glDebit,
          totalCredit: glCredit,
          netBalance: glNet,
          balanceType: glNet >= 0 ? 'DR' : 'CR',
          entryCount: ledgerEntries.length
        },
        slSummary: {
          available: true,
          reason: null,
          netBalance: Math.abs(glNet),
          balanceType: glNet >= 0 ? 'DR' : 'CR',
          entryCount: subledgerEntries.length
        },
        variance: 0,
        ledgerEntries,
        subledgerEntries,
        advanceEntries: subledgerEntries
      }
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 3. Fallback to Employee / MasterRoll (Labor Leaders & Employee Advances)
  // ─────────────────────────────────────────────────────────────────────────
  const employee = await MasterRoll.findOne({
    _id: targetIdObj,
    $or: [{ firmId: firmIdObj }, { firm_id: firmIdObj }]
  }, 'employee_name').lean();
  if (!employee) throw createError({ statusCode: 404, statusMessage: 'Employee not found in current firm' });

  const ledgerFilter: any = {
    $or: [
      { firmId: firmIdObj },
      { firm_id: firmIdObj },
      { firmId: firmIdStr },
      { firm_id: firmIdStr }
    ],
    $and: [
      {
        $or: [
          { masterRollId: targetIdObj },
          { masterRollId: targetId },
          { master_roll_id: targetIdObj },
          { master_roll_id: targetId },
          { 'tags.masterRollId': targetIdObj },
          { 'tags.masterRollId': targetId }
        ]
      }
    ],
    accountHead: 'Advance to Employees',
    isReversed: { $ne: true }
  };
  if (toDate) {
    ledgerFilter.transactionDate = { $lte: toDate };
  }
  const ledgerEntries = await Ledger.find(ledgerFilter).sort({ transactionDate: 1 }).lean();

  const advanceFilter: any = {
    $or: [
      { firm_id: firmIdObj },
      { firmId: firmIdObj },
      { firm_id: firmIdStr },
      { firmId: firmIdStr }
    ],
    $and: [
      {
        $or: [
          { master_roll_id: targetIdObj },
          { master_roll_id: targetId },
          { masterRollId: targetIdObj },
          { masterRollId: targetId }
        ]
      }
    ]
  };
  if (toDate) {
    advanceFilter.date = { $lte: toDate };
  }
  const advanceEntries = await Advance.find(advanceFilter).sort({ date: 1 }).lean();

  let glDebit = 0;
  let glCredit = 0;
  for (const l of ledgerEntries) {
    glDebit += Number(l.debitAmount || 0);
    glCredit += Number(l.creditAmount || 0);
  }

  let slAdvances = 0;
  let slRepayments = 0;
  for (const a of advanceEntries) {
    const amount = Number(a.amount);
    if (!Number.isFinite(amount) || amount < 0) {
      throw createError({ statusCode: 409, statusMessage: `Advance record ${a._id} has an invalid amount.` });
    }
    if (a.type === 'ADVANCE') slAdvances += amount;
    else if (a.type === 'REPAYMENT') slRepayments += amount;
    else throw createError({ statusCode: 409, statusMessage: `Advance record ${a._id} has unsupported type "${a.type}".` });
  }

  const glNet = glDebit - glCredit;
  const slNet = slAdvances - slRepayments;
  const variance = Math.round(Math.abs(glNet - slNet) * 100) / 100;

  return {
    success: true,
    data: {
      entityType: 'EMPLOYEE',
      category: 'LABOR',
      entityName: employee.employee_name,
      employee,
      glSummary: {
        totalDebit: glDebit,
        totalCredit: glCredit,
        netBalance: glNet,
        balanceType: glNet >= 0 ? 'DR' : 'CR',
        entryCount: ledgerEntries.length
      },
      slSummary: {
        totalAdvances: slAdvances,
        totalRepayments: slRepayments,
        netBalance: slNet,
        balanceType: slNet >= 0 ? 'DR' : 'CR',
        entryCount: advanceEntries.length
      },
      variance,
      ledgerEntries,
      advanceEntries,
      subledgerEntries: advanceEntries
    }
  };
});
