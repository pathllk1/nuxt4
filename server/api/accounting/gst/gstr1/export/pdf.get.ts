import { defineEventHandler, getQuery, setHeader, createError } from 'h3';
import Firm from '../../../../../models/Firm';
import { requireAuthSession } from '../../../../../utils/auth';
import { fetchFullGSTR1Data } from '../../../../../utils/gst/gstr1DataAggregator';
import { getGSTR1PDFDefinition } from '../../../../../utils/gst/gstPdfGenerator';
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
    const { summary, tables } = await fetchFullGSTR1Data(firmIdStr, firmGstin, startDate, endDate);

    const docDefinition = getGSTR1PDFDefinition({ summary, tables }, firm);
    const pdfBuffer = await createPdfBufferFromDocDef(docDefinition);

    setHeader(event, 'Content-Type', 'application/pdf');
    setHeader(event, 'Content-Disposition', `attachment; filename="GSTR1_${firmGstin || 'REPORT'}_${startDate || 'all'}.pdf"`);

    return pdfBuffer;
  } catch (error: any) {
    console.error('Export GSTR1 PDF error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Error exporting GSTR1 PDF'
    });
  }
});
