import { defineEventHandler, createError, readBody } from 'h3';
import crypto from 'crypto';
import mongoose from 'mongoose';
import User from '../../../models/User';
import ChartOfAccounts from '../../../models/ChartOfAccounts';

// Default expense category COA heads auto-created during supervisor onboarding
const SITE_EXPENSE_DEFAULT_HEADS = [
  { account_name: 'Site Labour & Coolie Charges', account_type: 'DIRECT_EXPENSE', bs_classification: 'PNL' },
  { account_name: 'Staff & Labour Welfare', account_type: 'INDIRECT_EXPENSE', bs_classification: 'PNL' },
  { account_name: 'Site Consumables & Local Purchases', account_type: 'DIRECT_EXPENSE', bs_classification: 'PNL' },
  { account_name: 'Freight & Cartage Inward', account_type: 'DIRECT_EXPENSE', bs_classification: 'PNL' },
  { account_name: 'Generator & Machine Fuel', account_type: 'DIRECT_EXPENSE', bs_classification: 'PNL' },
  { account_name: 'Machinery & Tools Maintenance', account_type: 'INDIRECT_EXPENSE', bs_classification: 'PNL' },
  { account_name: 'Miscellaneous Site Expenses', account_type: 'INDIRECT_EXPENSE', bs_classification: 'PNL' },
];

export default defineEventHandler(async (event) => {
  try {
    const firmId = event.context.params?.firmId;
    if (!firmId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Firm ID is required'
      });
    }

    const currentUserId = event.context.user?.id;
    if (!currentUserId) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized'
      });
    }

    // Get current user's grade in this firm
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

    const {
      email, grade, name, password,
      phone, assignedProjectIds, panNumber,
      coaLinkMode, existingLedgerHead
    } = await readBody(event) || {};

    if (!email || !grade) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Email and Grade are required'
      });
    }

    if (!['Owner', 'Admin', 'Manager', 'Staff', 'Supervisor', 'Subcontractor'].includes(grade)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid grade'
      });
    }

    // Name is mandatory for Supervisor and Subcontractor COA provisioning
    if ((grade === 'Supervisor' || grade === 'Subcontractor') && !name) {
      throw createError({
        statusCode: 400,
        statusMessage: `Full Name is required for ${grade} registration`
      });
    }

    let user = await User.findOne({ email: email.toLowerCase() });
    let isNewUser = false;

    const cleanPan = panNumber ? String(panNumber).trim().toUpperCase() : null;

    if (!user) {
      // Security: Generate a secure cryptographic temporary password instead of static default
      const tempPassword = password || crypto.randomBytes(16).toString('hex');

      user = new User({
        name: name || email.split('@')[0],
        email: email.toLowerCase(),
        password: tempPassword,
        role: 'standard', // Firm invitation can only create standard users
        status: 'active',
        firms: [{
          firm: firmId,
          grade,
          panNumber: cleanPan,
          ...((grade === 'Supervisor' || grade === 'Subcontractor') && assignedProjectIds ? { assignedProjectIds } : {})
        }],
        securitySettings: {
          failedLoginAttempts: 0,
          trustedIPs: [],
          suspiciousActivityCount: 0
        }
      });
      isNewUser = true;
      await user.save();
    } else {
      const hasAccess = user.firms.some(f => f.firm.toString() === firmId);
      if (hasAccess) {
        throw createError({
          statusCode: 400,
          statusMessage: 'User already has access to this firm'
        });
      }

      user.firms.push({
        firm: firmId as any,
        grade: grade as any,
        panNumber: cleanPan,
        ...((grade === 'Supervisor' || grade === 'Subcontractor') && assignedProjectIds ? { assignedProjectIds } : {})
      } as any);
      // Security: Do NOT mutate global account status (e.g. un-suspending suspended users)
      await user.save();
    }

    // ── Supervisor & Subcontractor COA Auto-Provisioning ──
    let linkedLedgerHead: string | null = null;
    const firmIdObj = new mongoose.Types.ObjectId(firmId);
    const sanitizedName = (name || '').trim().replace(/\s+/g, ' ');

    if (grade === 'Supervisor') {
      if (coaLinkMode === 'LINK_EXISTING' && existingLedgerHead) {
        // Manual link to existing COA head (Tally/legacy migration)
        const existing = await ChartOfAccounts.findOne({
          $or: [{ firm_id: firmIdObj }, { firmId: firmIdObj }],
          account_name: existingLedgerHead,
          is_active: true
        }).lean();

        if (!existing) {
          throw createError({
            statusCode: 400,
            statusMessage: `Chart of Accounts head "${existingLedgerHead}" not found or is inactive`
          });
        }
        linkedLedgerHead = existingLedgerHead;
      } else {
        // Auto-create standardized imprest account
        let targetAccountHead = `Advance - ${sanitizedName} (Site)`;

        // Check for name collision (e.g. two supervisors named "Ramesh Kumar")
        const collision = await ChartOfAccounts.findOne({
          $or: [{ firm_id: firmIdObj }, { firmId: firmIdObj }],
          account_name: targetAccountHead
        }).lean();

        if (collision) {
          const emailPrefix = email.split('@')[0];
          const disambiguator = emailPrefix.slice(-4);
          targetAccountHead = `Advance - ${sanitizedName} [${disambiguator}] (Site)`;
        }

        const existingAccount = await ChartOfAccounts.findOne({
          $or: [{ firm_id: firmIdObj }, { firmId: firmIdObj }],
          account_name: targetAccountHead
        }).lean();

        if (!existingAccount) {
          await ChartOfAccounts.create({
            firm_id: firmIdObj,
            firmId: firmIdObj,
            account_name: targetAccountHead,
            account_type: 'LOANS_ADVANCES',
            bs_classification: 'BALANCE_SHEET',
            description: `Automated Imprest Float Account for Site Supervisor: ${sanitizedName}`,
            is_system: false,
            is_active: true,
            created_by: new mongoose.Types.ObjectId(currentUserId)
          });
        }

        linkedLedgerHead = targetAccountHead;
      }

      // Bind linkedLedgerHead to the user's firm assignment
      const targetFirmAssignment = user.firms.find(f => f.firm.toString() === firmId);
      if (targetFirmAssignment) {
        (targetFirmAssignment as any).linkedLedgerHead = linkedLedgerHead;
        await user.save();
      }

      // Auto-create default site expense category COA heads (idempotent)
      for (const head of SITE_EXPENSE_DEFAULT_HEADS) {
        const exists = await ChartOfAccounts.findOne({
          $or: [{ firm_id: firmIdObj }, { firmId: firmIdObj }],
          account_name: head.account_name
        }).lean();

        if (!exists) {
          await ChartOfAccounts.create({
            firm_id: firmIdObj,
            firmId: firmIdObj,
            account_name: head.account_name,
            account_type: head.account_type,
            bs_classification: head.bs_classification as any,
            description: 'Standard site expense head (auto-provisioned)',
            is_system: false,
            is_active: true,
            created_by: new mongoose.Types.ObjectId(currentUserId)
          });
        }
      }
    } else if (grade === 'Subcontractor') {
      // ── Subcontractor COA Auto-Provisioning (Direct Expense) ──
      let targetAccountHead = `Subcontract - ${sanitizedName}`;

      // Check collision
      const collision = await ChartOfAccounts.findOne({
        $or: [{ firm_id: firmIdObj }, { firmId: firmIdObj }],
        account_name: targetAccountHead
      }).lean();

      if (collision) {
        const disambiguator = cleanPan ? cleanPan.slice(-4) : email.split('@')[0].slice(-4);
        targetAccountHead = `Subcontract - ${sanitizedName} [${disambiguator}]`;
      }

      const existingAccount = await ChartOfAccounts.findOne({
        $or: [{ firm_id: firmIdObj }, { firmId: firmIdObj }],
        account_name: targetAccountHead
      }).lean();

      if (!existingAccount) {
        await ChartOfAccounts.create({
          firm_id: firmIdObj,
          firmId: firmIdObj,
          account_name: targetAccountHead,
          account_type: 'DIRECT_EXPENSE',
          bs_classification: 'PNL',
          description: `Direct Subcontract Works Cost for ${sanitizedName}`,
          is_system: false,
          is_active: true,
          created_by: new mongoose.Types.ObjectId(currentUserId)
        });
      }

      linkedLedgerHead = targetAccountHead;

      // Bind linkedLedgerHead to the user's firm assignment
      const targetFirmAssignment = user.firms.find(f => f.firm.toString() === firmId);
      if (targetFirmAssignment) {
        (targetFirmAssignment as any).linkedLedgerHead = linkedLedgerHead;
        if (cleanPan) {
          (targetFirmAssignment as any).panNumber = cleanPan;
        }
        await user.save();
      }

      // Ensure 'TDS Payable u/s 194C' exists in Chart of Accounts
      const tdsHeadExists = await ChartOfAccounts.findOne({
        $or: [{ firm_id: firmIdObj }, { firmId: firmIdObj }],
        account_name: 'TDS Payable u/s 194C'
      }).lean();

      if (!tdsHeadExists) {
        await ChartOfAccounts.create({
          firm_id: firmIdObj,
          firmId: firmIdObj,
          account_name: 'TDS Payable u/s 194C',
          account_type: 'DUTIES_TAXES',
          bs_classification: 'BALANCE_SHEET',
          description: 'Statutory TDS on Payments to Contractors u/s 194C',
          is_system: false,
          is_active: true,
          created_by: new mongoose.Types.ObjectId(currentUserId)
        });
      }
    }

    return {
      success: true,
      statusCode: 201,
      message: isNewUser ? 'User created and added to firm successfully' : 'Member added successfully',
      member: {
        userId: user._id,
        email: user.email,
        name: user.name,
        grade,
        status: user.status,
        ...(linkedLedgerHead ? { linkedLedgerHead } : {})
      }
    };
  } catch (error: any) {
    console.error('Add member error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Error adding member'
    });
  }
});
