import { defineEventHandler, createError } from 'h3';
import { requireSuperAdmin } from '~~/server/utils/admin-guard';
import SystemConfig from '~~/server/models/SystemConfig';
import { connectDB } from '~~/server/utils/db';

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event);
  await connectDB();

  try {
    const configDocs = await SystemConfig.find().lean();
    const configMap: Record<string, any> = {};
    configDocs.forEach((doc: any) => {
      configMap[doc.key] = doc.value;
    });

    return {
      success: true,
      config: configMap
    };
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to fetch system configurations'
    });
  }
});
