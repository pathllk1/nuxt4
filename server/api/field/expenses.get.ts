import mongoose from 'mongoose';
import { requireAuthSession } from '../../utils/auth';
import User from '../../models/User';
import SiteExpenseClaim from '../../models/SiteExpenseClaim';

/**
 * GET /api/field/expenses
 * Returns the supervisor's own expense claims with optional status filter.
 * Query params: ?status=PENDING|APPROVED|REJECTED&page=1&limit=50
 */
export default defineEventHandler(async (event) => {
  const authSession = await requireAuthSession(event);
  const query = getQuery(event);

  const firmIdObj = new mongoose.Types.ObjectId(String(authSession.firm_id));
  const userIdObj = new mongoose.Types.ObjectId(String(authSession._id));

  // Verify supervisor grade
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

  // Build filter
  const filter: any = {
    firmId: firmIdObj,
    supervisorId: userIdObj
  };

  const statusFilter = query.status as string;
  if (statusFilter && ['PENDING', 'APPROVED', 'REJECTED'].includes(statusFilter)) {
    filter.status = statusFilter;
  }

  // Pagination
  const page = Math.max(1, parseInt(query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit as string) || 50));
  const skip = (page - 1) * limit;

  const [claims, totalCount] = await Promise.all([
    SiteExpenseClaim.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    SiteExpenseClaim.countDocuments(filter)
  ]);

  return {
    success: true,
    claims,
    pagination: {
      page,
      limit,
      totalCount,
      totalPages: Math.ceil(totalCount / limit)
    }
  };
});
