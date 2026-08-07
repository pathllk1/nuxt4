import { defineEventHandler, getQuery, setHeader } from 'h3';
import Firm from '../../../../models/Firm';
import { requireAuthSession } from '../../../../utils/auth';
import { fetchFullGSTR3BData } from '../../../../utils/gst/gstr3bDataAggregator';
import { getGSTR3BPDFDefinition } from '../../../../utils/gst/gstPdfGenerator';
import { createPdfBufferFromDocDef } from '../../../../utils/accounting/pdf-export.utils';

export default defineEventHandler(async (event) => {
  const session = await requireAuthSession(event);
  const query = getQuery(event);

  const startDate = String(query.startDate || `${new Date().getFullYear()}-01-01`);
  const endDate = String(query.endDate || new Date().toISOString().split('T')[0]);
  const firmGstin = String(query.gstin || query.firmGstin || '');

  const reportData = await fetchFullGSTR3BData(session.firm_id as string, firmGstin, startDate, endDate);
  const firm = await Firm.findById(session.firm_id).lean();

  const docDefinition = getGSTR3BPDFDefinition(reportData, firm);
  const buffer = await createPdfBufferFromDocDef(docDefinition);

  setHeader(event, 'Content-Type', 'application/pdf');
  setHeader(event, 'Content-Disposition', 'attachment; filename="GSTR3B_Report.pdf"');
  return buffer;
});
