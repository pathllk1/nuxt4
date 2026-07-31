import { defineEventHandler, createError, getQuery, getHeader } from 'h3';
import MasterRoll from '../../models/MasterRoll';
import mongoose from 'mongoose';

export default defineEventHandler(async (event) => {
  try {
    const firmId = getHeader(event, 'x-firm-id');
    if (!firmId) {
      throw createError({ statusCode: 400, statusMessage: 'Firm context required' });
    }

    const query = getQuery(event);
    const filter: Record<string, any> = { firm_id: new mongoose.Types.ObjectId(firmId) };
    
    // Apply selectedIds filter if provided
    if (query.selectedIds) {
      const ids = (query.selectedIds as string).split(',').map(id => new mongoose.Types.ObjectId(id));
      filter._id = { $in: ids };
    }

    const employees = await MasterRoll.find(filter).lean();

    // Return JSON data as "export" - the frontend composable will trigger a download
    // For proper Excel generation, this would use xlsx library on server side
    // Currently returns JSON which will fail the blob download - this is a known limitation
    // The FASTIFY1 backend handles the actual Excel generation
    return {
      success: true,
      data: employees,
      count: employees.length
    };
  } catch (error: any) {
    console.error('Export master-rolls error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Error exporting employees'
    });
  }
});
