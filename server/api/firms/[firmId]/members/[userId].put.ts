import { defineEventHandler, createError, readBody } from 'h3';
import mongoose from 'mongoose';
import User from '../../../../models/User';
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

    // Get current user's grade and role
    const currentUser = await User.findById(currentUserId);
    const currentFirmAssignment = currentUser?.firms.find(f => f.firm.toString() === firmId);
    const currentGrade = currentFirmAssignment?.grade;
    const currentRole = currentUser?.role;

    const isSuperAdmin = currentRole === 'superadmin';
    if (!isSuperAdmin && !['Owner', 'Admin'].includes(currentGrade || '')) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Insufficient permissions: Firm Owner, Admin, or Superadmin privileges required'
      });
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      throw createError({
        statusCode: 404,
        statusMessage: 'User not found'
      });
    }

    if (targetUser.role === 'superadmin' && !isSuperAdmin) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Cannot modify system superadmin users'
      });
    }

    const targetFirmAssignment = targetUser.firms.find(f => f.firm.toString() === firmId);
    if (!targetFirmAssignment) {
      throw createError({
        statusCode: 404,
        statusMessage: 'User does not have access to this firm'
      });
    }

    if (targetFirmAssignment.grade === 'Owner' && currentGrade !== 'Owner' && !isSuperAdmin) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Admins cannot modify the Owner of the firm'
      });
    }

    const body = await readBody(event) || {};
    const { grade, assignedProjectIds, status, role, name } = body;

    if (targetUserId === currentUserId) {
      if (grade && grade !== targetFirmAssignment.grade) {
        throw createError({ statusCode: 400, statusMessage: 'You cannot change your own grade' });
      }
    }

    if (name && typeof name === 'string' && name.trim()) {
      targetUser.name = name.trim();
    }

    if (status && ['active', 'pending', 'suspended'].includes(status)) {
      targetUser.status = status;
    }

    if (role && isSuperAdmin && ['standard', 'superadmin'].includes(role)) {
      targetUser.role = role;
    }

    if (grade) {
      if (!['Owner', 'Admin', 'Manager', 'Staff', 'Supervisor'].includes(grade)) {
        throw createError({ statusCode: 400, statusMessage: 'Invalid grade' });
      }
      targetFirmAssignment.grade = grade as any;

      // Auto-provision COA imprest account if transitioning to Supervisor
      if (grade === 'Supervisor' && !targetFirmAssignment.linkedLedgerHead) {
        const firmIdObj = new mongoose.Types.ObjectId(firmId);
        const sanitizedName = (targetUser.name || 'Supervisor').trim().replace(/\s+/g, ' ');
        let targetAccountHead = `Advance - ${sanitizedName} (Site)`;

        let existingAccount = await ChartOfAccounts.findOne({
          $or: [{ firm_id: firmIdObj }, { firmId: firmIdObj }],
          account_name: targetAccountHead
        });

        if (existingAccount) {
          const suffix = (targetUser.email || '').split('@')[0]?.slice(-4) || String(targetUser._id).slice(-4);
          targetAccountHead = `Advance - ${sanitizedName} [${suffix}] (Site)`;
        }

        const coaAccount = await ChartOfAccounts.findOneAndUpdate(
          {
            $or: [{ firm_id: firmIdObj }, { firmId: firmIdObj }],
            account_name: targetAccountHead
          },
          {
            $setOnInsert: {
              firm_id: firmIdObj,
              firmId: firmIdObj,
              account_name: targetAccountHead,
              account_type: 'LOANS_ADVANCES',
              bs_classification: 'BALANCE_SHEET',
              description: `Automated Imprest Float Account for Site Supervisor: ${sanitizedName}`,
              is_system: false,
              is_active: true,
              created_by: currentUserId
            }
          },
          { upsert: true, new: true }
        );

        targetFirmAssignment.linkedLedgerHead = targetAccountHead;
      }
    }

    if (Array.isArray(assignedProjectIds)) {
      targetFirmAssignment.assignedProjectIds = assignedProjectIds;
    }

    await targetUser.save();

    return {
      success: true,
      statusCode: 200,
      message: 'Member updated successfully',
      member: {
        userId: targetUser._id,
        email: targetUser.email,
        name: targetUser.name,
        grade: targetFirmAssignment.grade,
        linkedLedgerHead: targetFirmAssignment.linkedLedgerHead,
        assignedProjectIds: targetFirmAssignment.assignedProjectIds,
        status: targetUser.status,
        role: targetUser.role
      }
    };
  } catch (error: any) {
    console.error('Update member error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Error updating member'
    });
  }
});
