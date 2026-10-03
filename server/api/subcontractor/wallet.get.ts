import { defineEventHandler, createError } from 'h3';
import mongoose from 'mongoose';
import { requireAuthSession } from '../../utils/auth';
import User from '../../models/User';
import Ledger from '../../models/Ledger';
import SubcontractorExpense from '../../models/SubcontractorExpense';

/**
 * GET /api/subcontractor/wallet
 * Returns the Subcontractor's live wallet float:
 *   Total Net Payouts Received from Firm - Total Site Expenses Incurred
 * Also returns category breakdown, TDS deductions history, and recent site slips.
 */
export default defineEventHandler(async (event) => {
  const authSession = await requireAuthSession(event);
  const firmIdObj = new mongoose.Types.ObjectId(String(authSession.firm_id));
  const userIdObj = new mongoose.Types.ObjectId(String(authSession._id));

  const userDoc = await User.findById(userIdObj).lean() as any;
  if (!userDoc) {
    throw createError({ statusCode: 401, statusMessage: 'User not found' });
  }

  const firmAssignment = (userDoc.firms || []).find((f: any) =>
    String(f.firm?._id || f.firm) === String(firmIdObj)
  );

  if (!firmAssignment || firmAssignment.grade !== 'Subcontractor') {
    throw createError({ statusCode: 403, statusMessage: 'This portal is restricted to Subcontractors' });
  }

  const ledgerHead = firmAssignment.linkedLedgerHead;
  if (!ledgerHead) {
    throw createError({ statusCode: 400, statusMessage: 'Subcontractor has no linked Direct Expense head' });
  }

  // 1. Fetch all GL Payouts from firm to this subcontractor's Direct Expense head
  const payoutEntries = await Ledger.find({
    firmId: firmIdObj,
    accountHead: ledgerHead,
    debitAmount: { $gt: 0 }
  })
    .sort({ transactionDate: -1, createdAt: -1 })
    .lean();

  // For each payout entry, inspect corresponding voucher legs to determine exact Net Cash/Bank paid and TDS withheld
  const voucherGroupIds: string[] = payoutEntries
    .map(e => e.voucherGroupId)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);
  let allVoucherLegs: any[] = [];
  if (voucherGroupIds.length > 0) {
    allVoucherLegs = await Ledger.find({
      firmId: firmIdObj,
      voucherGroupId: { $in: voucherGroupIds }
    }).lean();
  }

  let totalGrossPaid = 0;
  let totalTdsWithheld = 0;
  let totalNetReceived = 0;

  const payoutsList = payoutEntries.map(entry => {
    const vgLegs = allVoucherLegs.filter(l => l.voucherGroupId === entry.voucherGroupId);
    
    // Find TDS leg
    const tdsLeg = vgLegs.find(l => 
      l.accountHead?.toLowerCase().includes('tds') && l.creditAmount > 0
    );
    const tdsAmount = tdsLeg ? tdsLeg.creditAmount : 0;

    // Find Bank/Cash payout leg
    const payoutLeg = vgLegs.find(l => 
      ['BANK', 'CASH'].includes(l.accountType) && l.creditAmount > 0
    );
    const netAmount = payoutLeg ? payoutLeg.creditAmount : (entry.debitAmount - tdsAmount);

    totalGrossPaid += entry.debitAmount;
    totalTdsWithheld += tdsAmount;
    totalNetReceived += netAmount;

    return {
      voucherNo: entry.voucherNo,
      voucherGroupId: entry.voucherGroupId,
      transactionDate: entry.transactionDate,
      grossAmount: entry.debitAmount,
      tdsAmount,
      netAmount,
      paymentMode: payoutLeg?.paymentMode || 'BANK',
      narration: entry.narration
    };
  });

  // 2. Fetch all Site Expenses logged by this Subcontractor (Off-Core Sandbox)
  const siteExpenses = await SubcontractorExpense.find({
    firmId: firmIdObj,
    subcontractorUserId: userIdObj
  })
    .sort({ expenseDate: -1, createdAt: -1 })
    .lean();

  let totalSiteExpenses = 0;
  const categoryTotals: Record<string, number> = {};

  for (const exp of siteExpenses) {
    totalSiteExpenses += exp.amount;
    categoryTotals[exp.category] = (categoryTotals[exp.category] || 0) + exp.amount;
  }

  // 3. Compute Live Wallet Float
  const liveFloat = totalNetReceived - totalSiteExpenses;

  return {
    success: true,
    subcontractor: {
      id: userDoc._id,
      name: userDoc.name,
      panNumber: firmAssignment.panNumber || '',
      linkedLedgerHead: ledgerHead,
      assignedProjectIds: firmAssignment.assignedProjectIds || []
    },
    wallet: {
      liveFloat,
      statusLabel: liveFloat >= 0 
        ? `₹${liveFloat.toLocaleString('en-IN', { minimumFractionDigits: 2 })} In Hand`
        : `Deficit: ₹${Math.abs(liveFloat).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
      isDeficit: liveFloat < 0,
      totalNetReceived,
      totalGrossPaid,
      totalTdsWithheld,
      totalSiteExpenses,
      categoryTotals,
      totalSlipsCount: siteExpenses.length
    },
    recentPayouts: payoutsList.slice(0, 10),
    recentExpenses: siteExpenses.slice(0, 10)
  };
});
