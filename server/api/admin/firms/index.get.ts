import { defineEventHandler, createError } from 'h3';
import { requireSuperAdmin } from '~~/server/utils/admin-guard';
import Firm from '~~/server/models/Firm';
import User from '~~/server/models/User';
import { connectDB } from '~~/server/utils/db';

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event);
  await connectDB();

  try {
    const firms = await Firm.find().sort({ createdAt: -1 }).lean();

    const enriched = await Promise.all(
      firms.map(async (firm: any) => {
        const memberCount = await User.countDocuments({ 'firms.firm': firm._id });
        const ownerUser = await User.findOne({ 
          'firms.firm': firm._id, 
          'firms.grade': 'Owner' 
        }).select('name email').lean();

        return {
          ...firm,
          id: firm._id.toString(),
          _id: firm._id.toString(),
          memberCount,
          owner: ownerUser ? { name: ownerUser.name, email: ownerUser.email } : null
        };
      })
    );

    return {
      success: true,
      data: enriched
    };
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to fetch firms'
    });
  }
});
