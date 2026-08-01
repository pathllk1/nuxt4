import { defineEventHandler, getQuery, createError } from 'h3';
import Wage from '../../models/Wage';
import { requireAuthSession } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  try {
    const session = await requireAuthSession(event);
    const query = getQuery(event);
    const filter: Record<string, any> = { 
      firm_id: session.firm_id,
      cheque_no: { $exists: true, $nin: [null, ''] }
    };

    if (query.month) {
      filter.salary_month = query.month;
    }

    const chequeNos = await Wage.distinct('cheque_no', filter);
    
    return {
      success: true,
      data: chequeNos.filter(Boolean).sort()
    };
  } catch (error: any) {
    console.error('Fetch cheque numbers error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Error fetching cheque numbers'
    });
  }
});
