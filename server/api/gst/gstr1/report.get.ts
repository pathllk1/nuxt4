import { defineEventHandler, getQuery } from 'h3';
import { getB2BSupplies, getB2CSupplies, getCreditDebitNotes } from '../../../utils/gst/gstr1DataAggregator';
import { requireAuthSession } from '../../../utils/auth';

export default defineEventHandler(async (event) => {
  const user = await requireAuthSession(event);
  const query = getQuery(event);

  const startDate = String(query.startDate || `${new Date().getFullYear()}-01-01`);
  const endDate = String(query.endDate || new Date().toISOString().split('T')[0]);
  const firmGstin = String(query.gstin || '');

  const b2b = await getB2BSupplies(user.firm_id as string, firmGstin, startDate, endDate);
  const b2c = await getB2CSupplies(user.firm_id as string, firmGstin, startDate, endDate);
  const cdn = await getCreditDebitNotes(user.firm_id as string, firmGstin, startDate, endDate);

  const totals = {
    b2bCount: b2b.length,
    b2bTaxable: b2b.reduce((sum: any, item: any) => sum + item.taxable_value, 0),
    b2bTax: b2b.reduce((sum: any, item: any) => sum + item.cgst + item.sgst + item.igst, 0),

    b2cTaxable: b2c.reduce((sum: any, item: any) => sum + item.taxable_value, 0),
    b2cTax: b2c.reduce((sum: any, item: any) => sum + item.cgst + item.sgst + item.igst, 0),

    cdnCount: cdn.length,
    cdnTaxable: cdn.reduce((sum: any, item: any) => sum + item.taxable_value, 0),
    cdnTax: cdn.reduce((sum: any, item: any) => sum + item.cgst + item.sgst + item.igst, 0),
  };

  return {
    success: true,
    data: {
      period: { startDate, endDate },
      b2b,
      b2c,
      cdn,
      totals
    }
  };
});
