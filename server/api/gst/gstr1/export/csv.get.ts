import { defineEventHandler, getQuery, setHeader } from 'h3';
import { requireAuthSession } from '../../../../utils/auth';
import { fetchFullGSTR1Data } from '../../../../utils/gst/gstr1DataAggregator';
import { exportGSTR1AsCSV } from '../../../../utils/gst/gstr1ExportUtils';

export default defineEventHandler(async (event) => {
  const session = await requireAuthSession(event);
  const query = getQuery(event);

  const startDate = String(query.startDate || `${new Date().getFullYear()}-01-01`);
  const endDate = String(query.endDate || new Date().toISOString().split('T')[0]);
  const firmGstin = String(query.gstin || query.firmGstin || '');

  const { summary, tables } = await fetchFullGSTR1Data(session.firm_id as string, firmGstin, startDate, endDate);
  const csvData = exportGSTR1AsCSV(summary, tables);

  setHeader(event, 'Content-Type', 'text/csv');
  setHeader(event, 'Content-Disposition', 'attachment; filename="GSTR1_Return.csv"');
  return csvData;
});
