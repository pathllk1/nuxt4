import mongoose from 'mongoose';
import Ledger from '../../../models/Ledger';
import Advance from '../../../models/Advance';
import MasterRoll from '../../../models/MasterRoll';
import Party from '../../../models/Party';
import Bill from '../../../models/Bill';
import BankAccount from '../../../models/BankAccount';
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
  const targetIdObj = new mongoose.Types.ObjectId(targetId);

  // ─────────────────────────────────────────────────────────────────────────
  // 1. Check if targetId is a Party (Trade Creditor / Debtor)
  // ─────────────────────────────────────────────────────────────────────────
  let party = null;
  if (category === 'AP' || category === 'AR' || !category) {
    party = await Party.findById(targetIdObj).lean();
  }

  if (party || category === 'AP' || category === 'AR') {
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
      glDebit += Number(l.debitAmount || 0);
      glCredit += Number(l.creditAmount || 0);
    }
    // For AP (Creditors): Net balance is Credit. For AR (Debtors): Net balance is Debit.
    const glNet = partyCategory === 'AP' ? (glCredit - glDebit) : (glDebit - glCredit);

    // Operational Subledger entries: Opening Balance + Bills + Non-Bill Payments/Receipts
    const subledgerEntries: any[] = [];
    let slNet = 0;

    if (party?.openingBalance) {
      const opBal = Number(party.openingBalance) || 0;
      const balType = party.balanceType || (partyCategory === 'AP' ? 'CR' : 'DR');
      if (partyCategory === 'AP') {
        slNet += balType === 'DR' ? -opBal : opBal;
      } else {
        slNet += balType === 'CR' ? -opBal : opBal;
      }
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
      const amt = Number(b.netTotal) || 0;
      if (partyCategory === 'AR') {
        const delta = b.btype === 'CREDIT_NOTE' ? -amt : amt;
        slNet += delta;
      } else {
        const delta = b.btype === 'DEBIT_NOTE' ? -amt : amt;
        slNet += delta;
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

    // Non-bill ledger adjustments (payments / receipts / debit/credit notes)
    const nonBillLegFilter: any = {
      $or: [
        { firmId: firmIdObj },
        { firm_id: firmIdObj },
        { firmId: firmIdStr },
        { firm_id: firmIdStr }
      ],
      partyId: targetIdObj,
      accountType: { $in: targetAccountTypes },
      refType: { $ne: 'BILL' },
      isReversed: { $ne: true }
    };
    if (toDate) {
      nonBillLegFilter.transactionDate = { $lte: toDate };
    }
    const nonBillLegs = await Ledger.find(nonBillLegFilter).sort({ transactionDate: 1 }).lean();

    for (const leg of nonBillLegs) {
      const dr = Number(leg.debitAmount) || 0;
      const cr = Number(leg.creditAmount) || 0;
      if (partyCategory === 'AR') {
        slNet += (dr - cr);
        subledgerEntries.push({
          _id: String(leg._id),
          date: leg.transactionDate,
          type: leg.voucherType || (cr > 0 ? 'RECEIPT' : 'ADJUSTMENT'),
          remarks: leg.narration || leg.voucherGroupId || 'Receipt/Adjustment',
          amount: cr > 0 ? cr : dr,
          bno: leg.voucherNo || leg.voucherGroupId
        });
      } else {
        slNet += (cr - dr);
        subledgerEntries.push({
          _id: String(leg._id),
          date: leg.transactionDate,
          type: leg.voucherType || (dr > 0 ? 'PAYMENT' : 'ADJUSTMENT'),
          remarks: leg.narration || leg.voucherGroupId || 'Payment/Adjustment',
          amount: dr > 0 ? dr : cr,
          bno: leg.voucherNo || leg.voucherGroupId
        });
      }
    }

    const variance = Math.round(Math.abs(glNet - slNet) * 100) / 100;

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
          netBalance: slNet,
          balanceType: partyCategory === 'AP' ? (slNet >= 0 ? 'CR' : 'DR') : (slNet >= 0 ? 'DR' : 'CR'),
          entryCount: subledgerEntries.length
        },
        variance,
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
    bankAccount = await BankAccount.findById(targetIdObj).lean();
  }

  if (bankAccount || category === 'BANK') {
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
    const opBal = Number((bankAccount as any)?.statement_balance ?? (bankAccount as any)?.opening_balance ?? (bankAccount as any)?.balance ?? 0);
    const subledgerEntries = [{
      _id: String(bankAccount?._id || targetId),
      date: 'Statement',
      type: 'BANK_STATEMENT',
      remarks: `Statement / Register Balance (${bankAccount?.account_name || 'Bank Account'})`,
      amount: opBal,
      bno: bankAccount?.account_number || '-'
    }];

    const variance = Math.round(Math.abs(glNet - opBal) * 100) / 100;

    return {
      success: true,
      data: {
        entityType: 'BANK',
        category: 'BANK',
        entityName: bankAccount?.account_name || 'Bank Account',
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
          netBalance: opBal,
          balanceType: opBal >= 0 ? 'DR' : 'CR',
          entryCount: 1
        },
        variance,
        ledgerEntries,
        subledgerEntries,
        advanceEntries: subledgerEntries
      }
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 3. Fallback to Employee / MasterRoll (Labor Leaders & Employee Advances)
  // ─────────────────────────────────────────────────────────────────────────
  const employee = await MasterRoll.findById(targetIdObj).lean();

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

  const nameSearchFilter: any = {
    $and: [
      { $or: [{ firmId: firmIdObj }, { firm_id: firmIdObj }] },
      {
        $or: [
          { narration: { $regex: employee?.employee_name || 'Employee', $options: 'i' } },
          { accountHead: { $regex: employee?.employee_name || 'Employee', $options: 'i' } }
        ]
      }
    ],
    isReversed: { $ne: true }
  };
  if (toDate) {
    nameSearchFilter.transactionDate = { $lte: toDate };
  }
  const nameSearchEntries = await Ledger.find(nameSearchFilter).sort({ transactionDate: 1 }).lean();

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
    if (a.type === 'ADVANCE') slAdvances += Number(a.amount || 0);
    else if (a.type === 'REPAYMENT') slRepayments += Number(a.amount || 0);
  }

  const glNet = glDebit - glCredit;
  const slNet = slAdvances - slRepayments;
  const variance = Math.round(Math.abs(glNet - slNet) * 100) / 100;

  return {
    success: true,
    data: {
      entityType: 'EMPLOYEE',
      category: 'LABOR',
      entityName: employee?.employee_name || 'Employee Advance Account',
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
      nameSearchEntries,
      advanceEntries,
      subledgerEntries: advanceEntries
    }
  };
});
