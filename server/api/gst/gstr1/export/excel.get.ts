import { defineEventHandler, getQuery, setHeader } from 'h3';
import { requireAuthSession } from '../../../../utils/auth';
import { getB2BSupplies, getB2CSupplies, getCreditDebitNotes } from '../../../../utils/gst/gstr1DataAggregator';
import { exportGSTR1AsExcel } from '../../../../utils/gst/gstr1ExportUtils';

export default defineEventHandler(async (event) => {
  const session = await requireAuthSession(event);
  const query = getQuery(event);

  const startDate = String(query.startDate || `${new Date().getFullYear()}-01-01`);
  const endDate = String(query.endDate || new Date().toISOString().split('T')[0]);
  const firmGstin = String(query.gstin || query.firmGstin || '');

  const b2b = await getB2BSupplies(session.firm_id as string, firmGstin, startDate, endDate);
  const b2c = await getB2CSupplies(session.firm_id as string, firmGstin, startDate, endDate);
  const cdn = await getCreditDebitNotes(session.firm_id as string, firmGstin, startDate, endDate);

  const summary = {
    period_start: startDate,
    period_end: endDate,
    firm_gstin: firmGstin,
    total_invoices: b2b.length + b2c.length,
    b2b_invoices: b2b.length,
    b2c_invoices: b2c.length,
    total_taxable_value: b2b.reduce((s, i) => s + i.taxable_value, 0) + b2c.reduce((s, i) => s + i.taxable_value, 0),
    total_cgst: b2b.reduce((s, i) => s + i.cgst, 0) + b2c.reduce((s, i) => s + i.cgst, 0),
    total_sgst: b2b.reduce((s, i) => s + i.sgst, 0) + b2c.reduce((s, i) => s + i.sgst, 0),
    total_igst: b2b.reduce((s, i) => s + i.igst, 0) + b2c.reduce((s, i) => s + i.igst, 0),
    total_gst: 0,
    total_invoice_value: 0
  };
  summary.total_gst = summary.total_cgst + summary.total_sgst + summary.total_igst;
  summary.total_invoice_value = summary.total_taxable_value + summary.total_gst;

  const allTables = {
    table_4a_b2b_supplies: b2b,
    table_7_b2cs_supplies: b2c,
    table_9_amendments: cdn,
  };

  const buffer = await exportGSTR1AsExcel(summary, allTables);
  setHeader(event, 'Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  setHeader(event, 'Content-Disposition', 'attachment; filename="GSTR1_Return.xlsx"');
  return buffer;
});
