import { defineEventHandler, createError, readBody } from 'h3';
import { requireSuperAdmin } from '~~/server/utils/admin-guard';
import User from '~~/server/models/User';
import { connectDB } from '~~/server/utils/db';
import { hashPassword } from '~~/server/utils/crypto-hash';

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event);
  await connectDB();

  try {
    const { name, email, password, role, status, firmAssignments } = await readBody(event);

    if (!email || !email.includes('@')) {
      throw createError({ statusCode: 400, statusMessage: 'Valid email address is required' });
    }

    const emailTaken = await User.findOne({ email: email.toLowerCase() }).lean();
    if (emailTaken) {
      throw createError({ statusCode: 409, statusMessage: 'A user with this email address already exists' });
    }

    const hashedPassword = await hashPassword(password || 'Welcome@123');

    const formattedFirms = Array.isArray(firmAssignments) 
      ? firmAssignments.map((f: any) => ({
          firm: f.firmId,
          grade: f.grade || 'Staff'
        }))
      : [];

    const user = await User.create({
      name: name || email.split('@')[0],
      email: email.toLowerCase(),
      password: hashedPassword,
      role: role || 'standard',
      status: status || 'active',
      firms: formattedFirms,
      securitySettings: {
        failedLoginAttempts: 0,
        trustedIPs: [],
        suspiciousActivityCount: 0
      }
    });

    return {
      success: true,
      message: 'User created successfully',
      data: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status
      }
    };
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || 'Error creating user'
    });
  }
});
