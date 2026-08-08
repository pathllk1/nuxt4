import { defineEventHandler, createError } from 'h3';
import { requireSuperAdmin } from '~~/server/utils/admin-guard';
import User from '~~/server/models/User';
import Firm from '~~/server/models/Firm';
import { connectDB } from '~~/server/utils/db';

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event);
  await connectDB();

  try {
    const users = await User.find()
      .select('-password -securitySettings')
      .populate({ path: 'firms.firm', model: Firm, select: 'name code' })
      .sort({ createdAt: -1 })
      .lean();

    const formatted = users.map((u: any) => ({
      ...u,
      id: u._id.toString(),
      _id: u._id.toString(),
      firms: (u.firms || []).map((f: any) => ({
        firmId: typeof f.firm === 'object' && f.firm ? f.firm._id.toString() : f.firm?.toString(),
        firmName: typeof f.firm === 'object' && f.firm ? f.firm.name : 'Unknown Firm',
        grade: f.grade || 'Staff'
      }))
    }));

    return {
      success: true,
      data: formatted
    };
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to fetch users directory'
    });
  }
});
