import { defineEventHandler, createError, readBody } from 'h3';
import { requireSuperAdmin } from '../../../../utils/admin-guard';
import SystemConfig from '../../../../models/SystemConfig';
import { connectDB } from '../../../../utils/db';

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event);
  await connectDB();

  try {
    const { key, value } = await readBody(event);
    if (!key) {
      throw createError({ statusCode: 400, statusMessage: 'Config key is required' });
    }

    const updated = await SystemConfig.findOneAndUpdate(
      { key },
      { $set: { value, updatedAt: new Date() } },
      { upsert: true, returnDocument: 'after' }
    );

    return {
      success: true,
      message: `System config '${key}' saved`,
      config: updated
    };
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to update system config'
    });
  }
});
