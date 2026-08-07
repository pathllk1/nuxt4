import { defineEventHandler, getQuery, setHeader, createError } from 'h3';
import Firm from '../../../../../models/Firm';
import { requireAuthSession } from '../../../../../utils/auth';
import { fetchFullGSTR3BData } from '../../../../../utils/gst/gstr3bDataAggregator';
import { getGSTR3BPDFDefinition } from '../../../../../utils/gst/gstPdfGenerator';
import { createPdfBufferFromDocDef } from '../../../../../utils/accounting/pdf-export.utils';

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuthSession(event);
    const firmIdObj = user.firm_id;
    const firmIdStr = String(firmIdObj);

    const query = getQuery(event);
    const startDate = query.startDate ? String(query.startDate) : '';
    const endDate = query.endDate ? String(query.endDate) : '';
    const firmGstin = query.firmGstin ? String(query.firmGstin) : '';

    const firm = await Firm.findById(firmIdObj).lean();
    const report = await fetchFullGSTR3BData(firmIdStr, firmGstin, startDate, endDate);

    const docDefinition = getGSTR3BPDFDefinition(report, firm);
    const pdfBuffer = await createPdfBufferFromDocDef(docDefinition);

    setHeader(event, 'Content-Type', 'application/pdf');
    setHeader(event, 'Content-Disposition', `attachment; filename="GSTR3B_${firmGstin || 'REPORT'}_${startDate || 'all'}.pdf"`);

    return pdfBuffer;
  } catch (error: any) {
    console.error('Export GSTR3B PDF error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Error exporting GSTR3B PDF'
    });
  }
});
