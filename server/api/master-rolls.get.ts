import { defineEventHandler, createError, getQuery, getHeader } from 'h3';
import MasterRoll from '../models/MasterRoll';
import mongoose from 'mongoose';

export default defineEventHandler(async (event) => {
  try {
    const firmId = getHeader(event, 'x-firm-id');
    if (!firmId) {
      throw createError({ statusCode: 400, statusMessage: 'Firm context required' });
    }

    const query = getQuery(event);
    const filter: Record<string, any> = { firm_id: new mongoose.Types.ObjectId(firmId) };

    if (query.status) filter.status = query.status;
    if (query.project) filter.project = query.project;
    if (query.site) filter.site = query.site;
    if (query.category) filter.category = query.category;
    if (query.bank) filter.bank = query.bank;

    if (query.doj_start || query.doj_end) {
      filter.date_of_joining = {};
      if (query.doj_start) filter.date_of_joining.$gte = query.doj_start;
      if (query.doj_end) filter.date_of_joining.$lte = query.doj_end;
    }

    if (query.activeOnly === 'true') {
      filter.status = 'Active';
    }

    const limit = query.limit ? parseInt(query.limit as string, 10) : 10000;
    const skip = query.skip ? parseInt(query.skip as string, 10) : 0;

    let sortObj: Record<string, any> = { employee_name: 1 };
    if (query.sortBy) {
      sortObj = { [query.sortBy as string]: query.sortOrder === 'desc' ? -1 : 1 };
    }

    const employees = await MasterRoll.find(filter).sort(sortObj).skip(skip).limit(limit).lean();
    const total = await MasterRoll.countDocuments(filter);

    return {
      success: true,
      data: employees,
      pagination: { total, limit, skip }
    };
  } catch (error: any) {
    console.error('Get master-rolls error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Error fetching master rolls'
    });
  }
});
