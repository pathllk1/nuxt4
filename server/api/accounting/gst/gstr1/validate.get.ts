import { defineEventHandler, getQuery, createError } from 'h3';
import { requireAuthSession } from '../../../../utils/auth';
import Bill from '../../../../models/Bill';

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuthSession(event);
    const firmIdObj = user.firm_id;
    const firmIdStr = String(firmIdObj);

    const query = getQuery(event);
    const startDate = query.startDate ? String(query.startDate) : '';
    const endDate = query.endDate ? String(query.endDate) : '';

    const filter: any = {
      $or: [
        { firmId: firmIdObj },
        { firmId: firmIdStr },
        { firm_id: firmIdObj },
        { firm_id: firmIdStr }
      ],
      btype: 'SALES',
      status: { $ne: 'CANCELLED' }
    };
    if (startDate && endDate) {
      filter.bdate = { $gte: startDate, $lte: endDate };
    }

    const bills = await Bill.find(filter).lean();
    const errors: any[] = [];

    bills.forEach((b: any) => {
      if (b.partyGstin && b.partyGstin !== 'UNREGISTERED' && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(b.partyGstin)) {
        errors.push({ bill_no: b.bno, issue: `Invalid GSTIN format for party ${b.partyName}` });
      }
      if (!b.grossTotal || b.grossTotal <= 0) {
        errors.push({ bill_no: b.bno, issue: 'Taxable value is zero or missing' });
      }
    });

    return {
      success: true,
      data: {
        isValid: errors.length === 0,
        total_bills: bills.length,
        total_issues: errors.length,
        errors
      }
    };
  } catch (error: any) {
    console.error('Validate GSTR1 error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Error validating GSTR1 data'
    });
  }
});
