import { defineEventHandler, createError } from 'h3';
import mongoose from 'mongoose';
import User from '../../../../models/User';
import Ledger from '../../../../models/Ledger';
import ChartOfAccounts from '../../../../models/ChartOfAccounts';

export default defineEventHandler(async (event) => {
  try {
    const firmId = event.context.params?.firmId;
    const targetUserId = event.context.params?.userId;
    if (!firmId || !targetUserId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Firm ID and User ID are required'
      });
    }

    const currentUserId = event.context.user?.id;
    if (!currentUserId) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized'
      });
    }

    const currentUser = await User.findById(currentUserId);
    const currentFirmAssignment = currentUser?.firms.find(f => f.firm.toString() === firmId);
    const currentGrade = currentFirmAssignment?.grade;

    if (!['Owner', 'Admin'].includes(currentGrade || '')) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Insufficient permissions'
      });
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      throw createError({
        statusCode: 404,
        statusMessage: 'User not found'
      });
    }

    // ── Supervisor De-Provisioning: Integrity Guard ──
    // Before removing a supervisor, verify their imprest float is fully settled.
    const targetFirmAssignment = targetUser.firms.find(f => f.firm.toString() === firmId);
    if (targetFirmAssignment) {
      const isSupervisor = targetFirmAssignment.grade === 'Supervisor';
      const ledgerHead = (targetFirmAssignment as any).linkedLedgerHead;

      if (isSupervisor && ledgerHead) {
        const firmIdObj = new mongoose.Types.ObjectId(firmId);

        // Query live GL balance for the supervisor's imprest account
        const balanceResult = await Ledger.aggregate([
          {
            $match: {
              firmId: firmIdObj,
              accountHead: ledgerHead
            }
          },
          {
            $group: {
              _id: null,
              totalDebit: { $sum: '$debitAmount' },
              totalCredit: { $sum: '$creditAmount' }
            }
          }
        ]);

        if (balanceResult.length > 0) {
          const balance = (balanceResult[0].totalDebit || 0) - (balanceResult[0].totalCredit || 0);

          // Block deactivation if non-zero balance (tolerance: 1 paisa)
          if (Math.abs(balance) > 0.01) {
            const balanceLabel = balance > 0
              ? `₹${balance.toFixed(2)} in un-settled company advance float`
              : `₹${Math.abs(balance).toFixed(2)} owed by company to supervisor`;

            throw createError({
              statusCode: 400,
              statusMessage: `Cannot deactivate Supervisor: ${targetUser.name} holds ${balanceLabel}. Please recover the cash balance or approve pending expense claims before closing this profile.`
            });
          }
        }

        // Balance is zero — safe to deactivate. Mark COA head as inactive.
        await ChartOfAccounts.updateOne(
          {
            $or: [{ firm_id: firmIdObj }, { firmId: firmIdObj }],
            account_name: ledgerHead
          },
          { $set: { is_active: false } }
        );
      }
    }

    targetUser.firms = targetUser.firms.filter(f => f.firm.toString() !== firmId);

    if (targetUser.firms.length === 0 && targetUser.role === 'standard') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Cannot remove user from all firms'
      });
    }

    await targetUser.save();

    return {
      success: true,
      statusCode: 200,
      message: 'Member removed successfully'
    };
  } catch (error: any) {
    console.error('Remove member error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Error removing member'
    });
  }
});
