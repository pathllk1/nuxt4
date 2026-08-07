import { defineEventHandler, getQuery, setHeader } from 'h3';
import { requireAuthSession } from '../../../../utils/auth';
import { fetchFullGSTR1Data } from '../../../../utils/gst/gstr1DataAggregator';
import { exportGSTR1AsJSON } from '../../../../utils/gst/gstr1ExportUtils';

export default defineEventHandler(async (event) => {
  const session = await requireAuthSession(event);
  const query = getQuery(event);

  const startDate = String(query.startDate || `${new Date().getFullYear()}-01-01`);
  const endDate = String(query.endDate || new Date().toISOString().split('T')[0]);
  const firmGstin = String(query.gstin || query.firmGstin || '');

  const { summary, tables } = await fetchFullGSTR1Data(session.firm_id as string, firmGstin, startDate, endDate);
  const jsonData = exportGSTR1AsJSON(summary, tables);

  setHeader(event, 'Content-Type', 'application/json');
  setHeader(event, 'Content-Disposition', 'attachment; filename="GSTR1_Return.json"');
  return JSON.stringify(jsonData, null, 2);
});
