import { defineEventHandler, getRouterParam, createError, setHeader } from 'h3';
import Bill from '../../../../models/Bill';
import Firm from '../../../../models/Firm';
import { requireAuthSession } from '../../../../utils/auth';
import { exportSingleBillToPdfBuffer } from '../../../../utils/accounting/pdf-export.utils';

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

  const firm = await Firm.findById(session.firm_id).lean();
  const buffer = await exportSingleBillToPdfBuffer(bill, firm);

  const safeBno = String((bill as any).bno || 'invoice').replace(/[^a-zA-Z0-9._-]/g, '_');
  setHeader(event, 'Content-Type', 'application/pdf');
  setHeader(event, 'Content-Disposition', `attachment; filename="Invoice_${safeBno}.pdf"`);
  return buffer;
});
