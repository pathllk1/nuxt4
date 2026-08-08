import { defineEventHandler, createError, readBody } from 'h3';
import { requireSuperAdmin } from '~~/server/utils/admin-guard';
import Firm from '~~/server/models/Firm';
import { connectDB } from '~~/server/utils/db';

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event);
  await connectDB();

  const firmId = event.context.params?.firmId;
  if (!firmId) {
    throw createError({ statusCode: 400, statusMessage: 'Firm ID is required' });
  }

  try {
    const { status } = await readBody(event);
    if (!status || !['approved', 'pending', 'suspended'].includes(status)) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid or missing status parameter' });
    }

    const firm = await Firm.findByIdAndUpdate(firmId, { $set: { status } }, { new: true });
    if (!firm) {
      throw createError({ statusCode: 404, statusMessage: 'Firm not found' });
    }

    return {
      success: true,
      message: `Firm status updated to '${status}' successfully`,
      data: firm
    };
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || error.message || 'Error updating firm status'
    });
  }
});
