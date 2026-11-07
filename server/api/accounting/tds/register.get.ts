import { defineEventHandler, getQuery, createError } from 'h3';
import { requireAuthSession } from '../../../utils/auth';
import { TdsManagerService } from '../../../utils/accounting/tds-manager.service';

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuthSession(event);
    if (!user || !user.firm_id) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized: Active firm required'
      });
    }

    const query = getQuery(event);

    const financialYear = query.financialYear ? String(query.financialYear).trim() : undefined;
    const quarter = query.quarter ? (String(query.quarter).trim().toUpperCase() as any) : 'ALL';
    const section = query.section ? String(query.section).trim() : 'ALL';
    const fromDate = query.fromDate ? String(query.fromDate).trim() : undefined;
    const toDate = query.toDate ? String(query.toDate).trim() : undefined;
    const search = query.search ? String(query.search).trim() : undefined;

    const result = await TdsManagerService.getTdsRegister({
      firmId: String(user.firm_id),
      financialYear,
      quarter,
      section,
      fromDate,
      toDate,
      search
    });

    return {
      success: true,
      data: result
    };
  } catch (err: any) {
    if (err.statusCode) throw err;
    console.error('Error fetching TDS register:', err);
    throw createError({
      statusCode: 500,
      statusMessage: err.message || 'Failed to fetch TDS register'
    });
  }
});

