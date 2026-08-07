import { defineEventHandler, getQuery, setHeader, createError } from 'h3';
import { requireAuthSession } from '../../../../../utils/auth';
import { fetchFullGSTR1Data } from '../../../../../utils/gst/gstr1DataAggregator';
import { exportGSTR1AsCSV } from '../../../../../utils/gst/gstr1ExportUtils';

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuthSession(event);
    const firmIdObj = user.firm_id;
    const firmIdStr = String(firmIdObj);

    const query = getQuery(event);
    const startDate = query.startDate ? String(query.startDate) : '';
    const endDate = query.endDate ? String(query.endDate) : '';
    const firmGstin = query.firmGstin ? String(query.firmGstin) : '';

    const { summary, tables } = await fetchFullGSTR1Data(firmIdStr, firmGstin, startDate, endDate);
    const csvContent = exportGSTR1AsCSV(summary, tables);

    setHeader(event, 'Content-Type', 'text/csv');
    setHeader(event, 'Content-Disposition', `attachment; filename="GSTR1_${firmGstin || 'REPORT'}_${startDate || 'all'}.csv"`);

    return csvContent;
  } catch (error: any) {
    console.error('Export GSTR1 CSV error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Error exporting GSTR1 CSV'
    });
  }
});
