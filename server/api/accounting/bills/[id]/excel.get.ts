import { defineEventHandler, getRouterParam, createError, setHeader } from 'h3';
import Bill from '../../../../models/Bill';
import { requireAuthSession } from '../../../../utils/auth';
import { exportSingleBillToExcel } from '../../../../utils/accounting/export-utils';

export default defineEventHandler(async (event) => {
  const session = await requireAuthSession(event);
  const id = getRouterParam(event, 'id');

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Bill ID is required' });
  }

  const bill = await Bill.findOne({
    _id: id,
    $or: [{ firmId: session.firm_id }, { firm_id: session.firm_id as any }]
  }).lean();

  if (!bill) {
    throw createError({ statusCode: 404, statusMessage: 'Bill not found' });
  }

  const buffer = await exportSingleBillToExcel(bill);

  const safeBno = String((bill as any).bno || 'invoice').replace(/[^a-zA-Z0-9._-]/g, '_');
  setHeader(event, 'Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  setHeader(event, 'Content-Disposition', `attachment; filename="Invoice_${safeBno}.xlsx"`);
  return buffer;
});
