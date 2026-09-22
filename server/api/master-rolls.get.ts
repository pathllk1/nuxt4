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

    const dojStart = typeof query.doj_start === 'string' && query.doj_start.trim() ? query.doj_start.trim() : null;
    const dojEnd = typeof query.doj_end === 'string' && query.doj_end.trim() ? query.doj_end.trim() : null;

    if (dojStart || dojEnd) {
      const dojConditions: any[] = [];

      // 1. String-based ISO comparison (covers 'YYYY-MM-DD', 'YYYY-MM-DDTHH:mm:ss.sssZ', etc.)
      const strCond: Record<string, any> = {};
      if (dojStart) strCond.$gte = dojStart;
      if (dojEnd) strCond.$lte = `${dojEnd}\uffff`;
      dojConditions.push(strCond);

      // 2. BSON Date comparison in case date_of_joining was stored as Date
      const dateCond: Record<string, any> = {};
      if (dojStart) dateCond.$gte = new Date(`${dojStart}T00:00:00.000Z`);
      if (dojEnd) dateCond.$lte = new Date(`${dojEnd}T23:59:59.999Z`);
      dojConditions.push(dateCond);

      const dojOr = dojConditions.map((c) => ({ date_of_joining: c }));
      if (filter.$and) {
        filter.$and.push({ $or: dojOr });
      } else {
        filter.$and = [{ $or: dojOr }];
      }
    }

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
    const limit = query.limit !== undefined ? parseInt(query.limit as string, 10) : 5000;
    const skip = limit > 0 ? (page - 1) * limit : 0;

    const sortField = (query.sortBy || query.sort || 'employee_name') as string;
    const sortOrder = (query.sortOrder || query.order) === 'desc' ? -1 : 1;

    const queryBuilder = MasterRoll.find(filter).sort({ [sortField]: sortOrder });
    if (limit > 0) {
      queryBuilder.skip(skip).limit(limit);
    }

    const [employees, total] = await Promise.all([
      queryBuilder.lean(),
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
