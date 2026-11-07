import mongoose from 'mongoose';
import Ledger from '../../../models/Ledger';
import Advance from '../../../models/Advance';
import MasterRoll from '../../../models/MasterRoll';
import { requireAuthSession } from '../../../utils/auth';

export default defineEventHandler(async (event) => {
  const user = await requireAuthSession(event);
  if (!user.firm_id) {
    throw createError({ statusCode: 400, statusMessage: 'No firm associated' });
  }

  const query = getQuery(event);
  const targetId = query.id ? String(query.id) : '6a116be88a70df2218b89da1';
  const toDate = query.toDate ? String(query.toDate) : undefined;
  const firmIdObj = new mongoose.Types.ObjectId(String(user.firm_id));
  const firmIdStr = String(user.firm_id);
  const masterRollIdObj = new mongoose.Types.ObjectId(targetId);
  const masterRollIdStr = String(targetId);

  // 1. MasterRoll Employee Info
  const employee = await MasterRoll.findById(masterRollIdObj).lean();

  // 2. All Ledger entries for this masterRollId
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
          { masterRollId: masterRollIdObj },
          { masterRollId: masterRollIdStr },
          { master_roll_id: masterRollIdObj },
          { master_roll_id: masterRollIdStr },
          { 'tags.masterRollId': masterRollIdObj },
          { 'tags.masterRollId': masterRollIdStr }
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

  // Also check if any ledger entry mentions Sanjit Sinha in narration or accountHead
  const nameSearchFilter: any = {
    $or: [{ firmId: firmIdObj }, { firm_id: firmIdObj }],
    isReversed: { $ne: true },
    $or: [
      { narration: { $regex: employee?.employee_name || 'Sanjit', $options: 'i' } },
      { accountHead: { $regex: employee?.employee_name || 'Sanjit', $options: 'i' } }
    ]
  };
  if (toDate) {
    nameSearchFilter.transactionDate = { $lte: toDate };
  }
  const nameSearchEntries = await Ledger.find(nameSearchFilter).sort({ transactionDate: 1 }).lean();

  // 3. All Advance collection entries for this master_roll_id
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
          { master_roll_id: masterRollIdObj },
          { master_roll_id: masterRollIdStr },
          { masterRollId: masterRollIdObj },
          { masterRollId: masterRollIdStr }
        ]
      }
    ]
  };
  if (toDate) {
    advanceFilter.date = { $lte: toDate };
  }
  const advanceEntries = await Advance.find(advanceFilter).sort({ date: 1 }).lean();

  // Calculate totals
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

  return {
    success: true,
    data: {
      employee,
      glSummary: {
        totalDebit: glDebit,
        totalCredit: glCredit,
        netBalance: glDebit - glCredit,
        entryCount: ledgerEntries.length
      },
      slSummary: {
        totalAdvances: slAdvances,
        totalRepayments: slRepayments,
        netBalance: slAdvances - slRepayments,
        entryCount: advanceEntries.length
      },
      variance: (glDebit - glCredit) - (slAdvances - slRepayments),
      ledgerEntries,
      nameSearchEntries,
      advanceEntries
    }
  };
});

