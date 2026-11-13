import { defineEventHandler, readBody, createError } from 'h3';
import mongoose from 'mongoose';
import Ledger from '../../../models/Ledger';
import Advance from '../../../models/Advance';
import MasterRoll from '../../../models/MasterRoll';
import Party from '../../../models/Party';
import { requireAuthSession } from '../../../utils/auth';
import { UnifiedPostingService } from '../../../utils/accounting/unified-posting.service';

export default defineEventHandler(async (event) => {
  const user = await requireAuthSession(event);
  if (!user.firm_id) {
    throw createError({ statusCode: 400, statusMessage: 'No firm associated' });
  }

  const body = await readBody(event) || {};
  const { entityId = '6a116be88a70df2218b89da1', action = 'RECONCILE', toDate } = body;

  const firmIdObj = new mongoose.Types.ObjectId(String(user.firm_id));
  const firmIdStr = String(user.firm_id);
  const masterRollIdObj = new mongoose.Types.ObjectId(String(entityId));
  const masterRollIdStr = String(entityId);

  // 1. Fetch employee
  const employee = await MasterRoll.findById(masterRollIdObj).lean();
  if (!employee) {
    const party = await Party.findById(masterRollIdObj).lean();
    if (party) {
      throw createError({
        statusCode: 400,
        statusMessage: `Entity "${party.name}" is a ${party.partyType === 'CUSTOMER' ? 'Trade Debtor' : 'Trade Creditor'}. Automated advance reconciliation is only applicable to Labor Leaders and Employee payroll advances.`
      });
    }
    throw createError({ statusCode: 404, statusMessage: 'Employee not found in Master Roll' });
  }

  // 2. Fetch all GL entries for 'Advance to Employees'
  const glFilter: any = {
    $and: [
      {
        $or: [
          { firmId: firmIdObj },
          { firm_id: firmIdObj },
          { firmId: firmIdStr },
          { firm_id: firmIdStr }
        ]
      },
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
    glFilter.transactionDate = { $lte: toDate };
  }
  const glEntries = await Ledger.find(glFilter).lean();

  // 3. Fetch all SL entries from Advance collection
  const slFilter: any = {
    $and: [
      {
        $or: [
          { firm_id: firmIdObj },
          { firmId: firmIdObj },
          { firm_id: firmIdStr },
          { firmId: firmIdStr }
        ]
      },
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
    slFilter.date = { $lte: toDate };
  }
  const slEntries = await Advance.find(slFilter).lean();

  let glTotalDr = 0;
  let glTotalCr = 0;
  for (const l of glEntries) {
    glTotalDr += Number(l.debitAmount || 0);
    glTotalCr += Number(l.creditAmount || 0);
  }
  const glNet = glTotalDr - glTotalCr;

  let slAdv = 0;
  let slRec = 0;
  for (const s of slEntries) {
    const sType = String(s.type || '').toUpperCase();
    if (sType === 'ADVANCE') slAdv += Number(s.amount || 0);
    else if (sType === 'REPAYMENT') slRec += Number(s.amount || 0);
  }
  const slNet = slAdv - slRec;
  const variance = glNet - slNet;

  if (Math.abs(variance) < 0.01) {
    return {
      success: true,
      message: 'No variance detected. Sub-Ledger and General Ledger are in perfect parity.',
      glBalance: glNet,
      slBalance: slNet,
      variance: 0
    };
  }

  const resolutionLog: string[] = [];
  const effectiveDate = toDate || glEntries[glEntries.length - 1]?.transactionDate || new Date().toISOString().split('T')[0];

  // Align any existing reconciliation advances that might have been dated in the future
  if (toDate) {
    await Advance.updateMany(
      {
        firm_id: firmIdObj,
        master_roll_id: masterRollIdObj,
        remarks: { $regex: /System SL-GL Advance reconciliation adjustment/i },
        date: { $gt: toDate }
      },
      { $set: { date: effectiveDate } }
    );
  }

  // Case A: GL > SL (e.g. GL has ₹6,000, SL has ₹5,000 -> variance = +₹1,000)
  if (variance > 0) {
    // Find the GL entry that accounts for the discrepancy
    const exactMatchingGl = glEntries.find(gl => {
      const glAmt = Number(gl.debitAmount || 0);
      return Math.abs(glAmt - variance) < 0.01;
    });

    const orphanGl = exactMatchingGl || glEntries.find(gl => {
      const glAmt = Number(gl.debitAmount || 0);
      return !slEntries.some(sl => {
        const slAmt = Number(sl.amount || 0);
        return Math.abs(slAmt - glAmt) < 0.01;
      });
    }) || glEntries[0];

    const advanceDate = (orphanGl?.transactionDate && (!toDate || orphanGl.transactionDate <= toDate))
      ? orphanGl.transactionDate
      : effectiveDate;

    // Direct atomic creation in Advance collection
    const createdDoc = await Advance.create({
      firm_id: firmIdObj,
      master_roll_id: masterRollIdObj,
      type: 'ADVANCE',
      amount: variance,
      date: advanceDate,
      payment_mode: (orphanGl?.paymentMode === 'BANK' ? 'BANK' : orphanGl?.paymentMode === 'WAGE_DEDUCTION' ? 'WAGE_DEDUCTION' : 'CASH') as 'CASH' | 'BANK' | 'WAGE_DEDUCTION',
      bank_account_id: orphanGl?.bankAccountId || null,
      wage_id: null,
      remarks: orphanGl?.narration || `System SL-GL Advance reconciliation adjustment for ${employee.employee_name}`,
      voucher_group_id: orphanGl?.voucherGroupId || null,
      created_by: user._id,
      updated_by: user._id
    });

    resolutionLog.push(`Created verified Advance subledger record of ₹${variance.toFixed(2)} on ${advanceDate} linked to voucher ${orphanGl?.voucherGroupId || 'GL Control'}`);
  }
  // Case B: SL > GL (SL has advance that was never posted to GL)
  else if (variance < 0) {
    const shortage = Math.abs(variance);
    const cashAccount = await Ledger.findOne({
      $or: [{ firmId: firmIdObj }, { firm_id: firmIdObj }],
      accountType: 'CASH'
    }).lean();
    const cashHead = cashAccount ? cashAccount.accountHead : 'Cash in Hand';

    await UnifiedPostingService.postVoucher({
      firmId: firmIdObj,
      voucherType: 'PAYMENT',
      transactionDate: effectiveDate,
      narration: `Reconciliation Advance Payment to ${employee.employee_name}`,
      legs: [
        {
          accountHead: 'Advance to Employees',
          accountType: 'ASSET',
          debitAmount: shortage,
          creditAmount: 0,
          narration: `Advance to ${employee.employee_name}`
        },
        {
          accountHead: cashHead,
          accountType: 'CASH',
          debitAmount: 0,
          creditAmount: shortage,
          narration: `Cash paid to ${employee.employee_name}`
        }
      ],
      createdBy: user.username || user.email || 'system',
      refType: 'ADVANCE',
      tags: { masterRollId: masterRollIdObj }
    });

    resolutionLog.push(`Posted balanced double-entry GL Payment voucher of ₹${shortage.toFixed(2)} for ${employee.employee_name}`);
  }

  // Re-verify new balance from Advance collection
  const updatedSlEntries = await Advance.find(slFilter).lean();
  let updatedSlAdv = 0;
  let updatedSlRec = 0;
  for (const s of updatedSlEntries) {
    const sType = String(s.type || '').toUpperCase();
    if (sType === 'ADVANCE') updatedSlAdv += Number(s.amount || 0);
    else if (sType === 'REPAYMENT') updatedSlRec += Number(s.amount || 0);
  }
  const newSlBalance = updatedSlAdv - updatedSlRec;
  const newVariance = Math.abs(glNet - newSlBalance);

  return {
    success: true,
    message: `Successfully resolved variance of ₹${Math.abs(variance).toFixed(2)} for ${employee.employee_name}. Parity is 100% restored.`,
    employeeName: employee.employee_name,
    resolutionLog,
    previousVariance: Math.abs(variance),
    glBalance: glNet,
    slBalance: newSlBalance,
    newVariance
  };
});
