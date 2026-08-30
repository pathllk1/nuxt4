import { defineEventHandler, createError, getQuery } from 'h3';
import MasterRoll from '../models/MasterRoll';
import { requireAuthSession } from '../utils/auth';

export default defineEventHandler(async (event) => {
  try {
    // Fix #7: Use requireAuthSession instead of raw x-firm-id header
    const user = await requireAuthSession(event);

    const query = getQuery(event);
    const filter: Record<string, any> = { firm_id: user.firm_id };

    if (query.status) filter.status = query.status;
    if (query.project) filter.project = query.project;
    if (query.site) filter.site = query.site;
    if (query.category) filter.category = query.category;
    if (query.bank) filter.bank = query.bank;

    if (query.search) {
      const escapedSearch = String(query.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(escapedSearch, 'i');
      filter.$or = [
        { employee_name: searchRegex },
        { aadhar: searchRegex },
        { phone_no: searchRegex }
      ];
    }

    const page = parseInt(query.page as string || '1', 10);
    const limit = parseInt(query.limit as string || '50', 10);
    const skip = (page - 1) * limit;

    const sortField = query.sort || 'employee_name';
    const sortOrder = query.order === 'desc' ? -1 : 1;

    const [employees, total] = await Promise.all([
      MasterRoll.find(filter)
        .sort({ [sortField as string]: sortOrder })
        .skip(skip)
        .limit(limit)
        .lean(),
      MasterRoll.countDocuments(filter)
    ]);

    return {
      success: true,
      data: employees,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  } catch (error: any) {
    console.error('Get master-rolls error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Error fetching employees'
    });
  }
});
