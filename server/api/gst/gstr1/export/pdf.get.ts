import { defineEventHandler, getQuery, setHeader } from 'h3';
import Firm from '../../../../models/Firm';
import { requireAuthSession } from '../../../../utils/auth';
import { getB2BSupplies } from '../../../../utils/gst/gstr1DataAggregator';
import { getGSTR1PDFDefinition } from '../../../../utils/gst/gstPdfGenerator';
import { createPdfBufferFromDocDef } from '../../../../utils/accounting/pdf-export.utils';

export default defineEventHandler(async (event) => {
  const session = await requireAuthSession(event);
  const query = getQuery(event);

  const startDate = String(query.startDate || `${new Date().getFullYear()}-01-01`);
  const endDate = String(query.endDate || new Date().toISOString().split('T')[0]);
  const firmGstin = String(query.gstin || query.firmGstin || '');

  const b2b = await getB2BSupplies(session.firm_id as string, firmGstin, startDate, endDate);
  const firm = await Firm.findById(session.firm_id).lean();

  const summary = {
    period_start: startDate,
    period_end: endDate,
    firm_gstin: firmGstin,
    total_invoices: b2b.length,
    total_taxable_value: b2b.reduce((s, i) => s + i.taxable_value, 0),
    total_cgst: b2b.reduce((s, i) => s + i.cgst, 0),
    total_sgst: b2b.reduce((s, i) => s + i.sgst, 0),
    total_igst: b2b.reduce((s, i) => s + i.igst, 0),
    total_gst: 0,
    total_invoice_value: 0
  };
  summary.total_gst = summary.total_cgst + summary.total_sgst + summary.total_igst;
  summary.total_invoice_value = summary.total_taxable_value + summary.total_gst;

  const reportData = {
    summary,
    tables: {
      table_4a_b2b_supplies: b2b
    }
  };

  const docDefinition = getGSTR1PDFDefinition(reportData, firm);
  const buffer = await createPdfBufferFromDocDef(docDefinition);

  setHeader(event, 'Content-Type', 'application/pdf');
  setHeader(event, 'Content-Disposition', 'attachment; filename="GSTR1_Report.pdf"');
  return buffer;
});
