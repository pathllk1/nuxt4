import mongoose from 'mongoose';
import { requireAuthSession } from '../../utils/auth';
import User from '../../models/User';
import SiteExpenseClaim from '../../models/SiteExpenseClaim';

/**
 * GET /api/accounting/imprest-approvals
 * Checker endpoint: Lists site expense claims with filters, summary totals, and supervisor breakdowns.
 * Accessible to Owner, Admin, and Manager grades.
 */
export default defineEventHandler(async (event) => {
  const authSession = await requireAuthSession(event);
  const firmIdObj = new mongoose.Types.ObjectId(String(authSession.firm_id));
  const userIdObj = new mongoose.Types.ObjectId(String(authSession._id));

  // Role validation
  const userDoc = await User.findById(userIdObj).lean() as any;
  if (!userDoc) {
    throw createError({ statusCode: 401, statusMessage: 'User not found' });
  }

  const firmAssignment = (userDoc.firms || []).find((f: any) =>
    String(f.firm?._id || f.firm) === String(firmIdObj)
  );

  const grade = firmAssignment?.grade || 'Staff';
  if (userDoc.role !== 'superadmin' && !['Owner', 'Admin', 'Manager'].includes(grade)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden: Maker-Checker approval requires Manager, Admin, or Owner privilege'
    });
  }

  const query = getQuery(event);
  const status = (query.status as string) || 'PENDING';
  const supervisorId = query.supervisorId as string;
  const projectId = query.projectId as string;
  const search = (query.search as string)?.trim();
  const startDate = query.startDate as string;
  const endDate = query.endDate as string;
  const page = Math.max(1, parseInt(query.page as string, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit as string, 10) || 50));

  // Build filter
  const filter: any = { firmId: firmIdObj };

  if (status && status !== 'ALL') {
    filter.status = status;
  }

  if (supervisorId && mongoose.Types.ObjectId.isValid(supervisorId)) {
    filter.supervisorId = new mongoose.Types.ObjectId(supervisorId);
  }

  if (projectId) {
    filter.projectId = projectId;
  }

  if (startDate || endDate) {
    filter.expenseDate = {};
    if (startDate) filter.expenseDate.$gte = startDate;
    if (endDate) filter.expenseDate.$lte = endDate;
  }

  if (search) {
    filter.$or = [
      { supervisorName: { $regex: search, $options: 'i' } },
      { narration: { $regex: search, $options: 'i' } },
      { partyOrPayeeName: { $regex: search, $options: 'i' } },
      { targetAccountHead: { $regex: search, $options: 'i' } }
    ];
  }

  const skip = (page - 1) * limit;

  const [claims, total, aggregateStats, distinctSupervisors, distinctProjects] = await Promise.all([
    SiteExpenseClaim.find(filter)
      .sort({ expenseDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    SiteExpenseClaim.countDocuments(filter),
    SiteExpenseClaim.aggregate([
      { $match: { firmId: firmIdObj } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      }
    ]),
    SiteExpenseClaim.aggregate([
      { $match: { firmId: firmIdObj } },
      {
        $group: {
          _id: '$supervisorId',
          name: { $first: '$supervisorName' },
          imprestAccountHead: { $first: '$imprestAccountHead' },
          pendingCount: {
            $sum: { $cond: [{ $eq: ['$status', 'PENDING'] }, 1, 0] }
          },
          pendingAmount: {
            $sum: { $cond: [{ $eq: ['$status', 'PENDING'] }, '$amount', 0] }
          }
        }
      }
    ]),
    SiteExpenseClaim.distinct('projectId', { firmId: firmIdObj, projectId: { $ne: null } })
  ]);

  const stats = {
    pending: { count: 0, totalAmount: 0 },
    approved: { count: 0, totalAmount: 0 },
    rejected: { count: 0, totalAmount: 0 }
  };

  for (const s of aggregateStats) {
    if (s._id === 'PENDING') stats.pending = { count: s.count, totalAmount: s.totalAmount };
    if (s._id === 'APPROVED') stats.approved = { count: s.count, totalAmount: s.totalAmount };
    if (s._id === 'REJECTED') stats.rejected = { count: s.count, totalAmount: s.totalAmount };
  }

  return {
    success: true,
    data: {
      claims,
      total,
      page,
      limit,
      stats,
      supervisors: distinctSupervisors.map(s => ({
        id: s._id?.toString(),
        name: s.name,
        imprestAccountHead: s.imprestAccountHead,
        pendingCount: s.pendingCount,
        pendingAmount: s.pendingAmount
      })),
      projects: distinctProjects.filter(Boolean)
    }
  };
});
