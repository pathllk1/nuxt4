import { getTable31, getTable4 } from '../../../utils/gst/gstr3bDataAggregator';
import { requireAuthSession } from '../../../utils/auth';

export default defineEventHandler(async (event) => {
  const user = await requireAuthSession(event);
  const query = getQuery(event);

  const startDate = String(query.startDate || `${new Date().getFullYear()}-01-01`);
  const endDate = String(query.endDate || new Date().toISOString().split('T')[0]);
  const firmGstin = String(query.gstin || '');

  const table31 = await getTable31(user.firm_id as string, firmGstin, startDate, endDate);
  const table4 = await getTable4(user.firm_id as string, firmGstin, startDate, endDate);

  return {
    success: true,
    data: {
      period: { startDate, endDate },
      table31,
      table4
    }
  };
});
