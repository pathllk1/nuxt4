import { defineEventHandler, createError, readBody } from 'h3';
import { requireSuperAdmin } from '~~/server/utils/admin-guard';
import User from '~~/server/models/User';
import { connectDB } from '~~/server/utils/db';

export default defineEventHandler(async (event) => {
  const currentAdmin = await requireSuperAdmin(event);
  await connectDB();

  const userId = event.context.params?.userId;
  if (!userId) {
    throw createError({ statusCode: 400, statusMessage: 'User ID is required' });
  }

  try {
    const { name, email, role, status, firmAssignments } = await readBody(event);

    const user = await User.findById(userId);
    if (!user) {
      throw createError({ statusCode: 404, statusMessage: 'User not found' });
    }

    if (userId === currentAdmin.id) {
      if (status && status !== user.status) {
        throw createError({ statusCode: 400, statusMessage: 'You cannot change your own user status' });
      }
      if (role && role !== user.role) {
        throw createError({ statusCode: 400, statusMessage: 'You cannot change your own system role' });
      }
    }

    if (name) user.name = name;
    if (email) {
      const emailClash = await User.findOne({ email: email.toLowerCase(), _id: { $ne: userId } }).lean();
      if (emailClash) {
        throw createError({ statusCode: 409, statusMessage: 'Email already in use by another user' });
      }
      user.email = email.toLowerCase();
    }

    if (role && ['superadmin', 'standard'].includes(role)) {
      user.role = role;
    }

    if (status && ['active', 'pending', 'suspended'].includes(status)) {
      user.status = status;
    }

    if (Array.isArray(firmAssignments)) {
      user.firms = firmAssignments.map((f: any) => ({
        firm: f.firmId,
        grade: f.grade || 'Staff'
      }));
    }

    await user.save();

    return {
      success: true,
      message: 'User profile updated successfully',
      data: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        firms: user.firms
      }
    };
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || 'Error updating user profile'
    });
  }
});
