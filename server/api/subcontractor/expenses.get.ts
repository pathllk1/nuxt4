import { defineEventHandler, getQuery, createError } from 'h3';
import mongoose from 'mongoose';
import { requireAuthSession } from '../../utils/auth';
import SubcontractorExpense from '../../models/SubcontractorExpense';
import User from '../../models/User';

/**
 * GET /api/subcontractor/expenses
 * Lists site slips for the logged-in Subcontractor (or specific contractor if accessed by Admin/Manager).
 * Supports category filtering, search, and pagination.
 */
export default defineEventHandler(async (event) => {
  const authSession = await requireAuthSession(event);
  const firmIdObj = new mongoose.Types.ObjectId(String(authSession.firm_id));
  const userIdObj = new mongoose.Types.ObjectId(String(authSession._id));

  const query = getQuery(event);
  const { category, search, startDate, endDate, subcontractorId } = query;

  // If admin/owner/manager specifies a subcontractorId, allow querying that subcontractor's slips
  let targetUserId = userIdObj;
  if (subcontractorId && mongoose.Types.ObjectId.isValid(String(subcontractorId))) {
    const currentUser = await User.findById(userIdObj).lean() as any;
    const currentAssignment = (currentUser?.firms || []).find((f: any) =>
      String(f.firm?._id || f.firm) === String(firmIdObj)
    );
    const isElevated = currentUser?.role === 'superadmin' || 
      ['Owner', 'Admin', 'Manager'].includes(currentAssignment?.grade || '');

    if (isElevated) {
      targetUserId = new mongoose.Types.ObjectId(String(subcontractorId));
    } else {
      throw createError({
        statusCode: 403,
        statusMessage: 'You do not have permission to view other contractors\' slips'
      });
    }
  }

  const filter: any = {
    firmId: firmIdObj,
    subcontractorUserId: targetUserId
  };

  if (category && category !== 'ALL') {
    filter.category = category;
  }

  if (startDate || endDate) {
    filter.expenseDate = {};
    if (startDate) filter.expenseDate.$gte = String(startDate);
    if (endDate) filter.expenseDate.$lte = String(endDate);
  }

  if (search) {
    const s = String(search).trim();
    filter.$or = [
      { vendorOrPayee: { $regex: s, $options: 'i' } },
      { notes: { $regex: s, $options: 'i' } },
      { billOrSlipRef: { $regex: s, $options: 'i' } }
    ];
  }

  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 30));
  const skip = (page - 1) * limit;

  const [totalCount, expenses] = await Promise.all([
    SubcontractorExpense.countDocuments(filter),
    SubcontractorExpense.find(filter)
      .sort({ expenseDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()
  ]);

  return {
    success: true,
    expenses,
    pagination: {
      page,
      limit,
      totalCount,
      totalPages: Math.ceil(totalCount / limit)
    }
  };
});
