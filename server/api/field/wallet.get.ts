import mongoose from 'mongoose';
import { requireAuthSession } from '../../utils/auth';
import User from '../../models/User';
import Ledger from '../../models/Ledger';
import SiteExpenseClaim from '../../models/SiteExpenseClaim';

/**
 * GET /api/field/wallet
 * Returns the supervisor's live imprest wallet balance and summary stats.
 * Balance is computed from the General Ledger in real-time.
 */
export default defineEventHandler(async (event) => {
  const authSession = await requireAuthSession(event);
  const firmIdObj = new mongoose.Types.ObjectId(String(authSession.firm_id));
  const userIdObj = new mongoose.Types.ObjectId(String(authSession._id));

  // Get user with firm assignment
  const userDoc = await User.findById(userIdObj).lean() as any;
  if (!userDoc) {
    throw createError({ statusCode: 401, statusMessage: 'User not found' });
  }

  const firmAssignment = (userDoc.firms || []).find((f: any) =>
    String(f.firm?._id || f.firm) === String(firmIdObj)
  );

  if (!firmAssignment || firmAssignment.grade !== 'Supervisor') {
    throw createError({ statusCode: 403, statusMessage: 'This endpoint is restricted to Site Supervisors' });
  }

  const ledgerHead = firmAssignment.linkedLedgerHead;
  if (!ledgerHead) {
    throw createError({ statusCode: 400, statusMessage: 'Supervisor has no linked imprest ledger head' });
  }

  // Compute live GL balance: Σ(DR) - Σ(CR) for the imprest account
  const balanceResult = await Ledger.aggregate([
    { $match: { firmId: firmIdObj, accountHead: ledgerHead } },
    {
      $group: {
        _id: null,
        totalDebit: { $sum: '$debitAmount' },
        totalCredit: { $sum: '$creditAmount' }
      }
    }
  ]);

  const totalDebit = balanceResult.length > 0 ? (balanceResult[0].totalDebit || 0) : 0;
  const totalCredit = balanceResult.length > 0 ? (balanceResult[0].totalCredit || 0) : 0;
  const balance = totalDebit - totalCredit;

  // Count pending/approved/rejected claims
  const claimStats = await SiteExpenseClaim.aggregate([
    { $match: { firmId: firmIdObj, supervisorId: userIdObj } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalAmount: { $sum: '$amount' }
      }
    }
  ]);

  const stats: Record<string, { count: number; totalAmount: number }> = {};
  for (const s of claimStats) {
    stats[s._id] = { count: s.count, totalAmount: s.totalAmount };
  }

  // Fetch recent ledger transactions for the advance history
  const recentTransactions = await Ledger.find({
    firmId: firmIdObj,
    accountHead: ledgerHead
  })
    .sort({ transactionDate: -1, createdAt: -1 })
    .limit(20)
    .select('transactionDate debitAmount creditAmount narration voucherNo voucherType createdAt')
    .lean();

  return {
    success: true,
    wallet: {
      supervisorName: userDoc.name,
      imprestAccountHead: ledgerHead,
      assignedProjectIds: firmAssignment.assignedProjectIds || [],
      balance,
      balanceLabel: balance >= 0
        ? `₹${balance.toFixed(2)} In Hand`
        : `Company Owes You: ₹${Math.abs(balance).toFixed(2)}`,
      balanceType: balance >= 0 ? 'DEBIT' : 'CREDIT',
      totalAdvancesReceived: totalDebit,
      totalExpensesApproved: totalCredit,
    },
    claims: {
      pending: stats['PENDING'] || { count: 0, totalAmount: 0 },
      approved: stats['APPROVED'] || { count: 0, totalAmount: 0 },
      rejected: stats['REJECTED'] || { count: 0, totalAmount: 0 },
    },
    recentTransactions
  };
});
