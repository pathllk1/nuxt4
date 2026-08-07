import { defineEventHandler, getQuery, setHeader } from 'h3';
import Bill from '../../../models/Bill';
import { requireAuthSession } from '../../../utils/auth';
import { exportBillsToExcel } from '../../../utils/accounting/export-utils';

export default defineEventHandler(async (event) => {
  const session = await requireAuthSession(event);
  const query = getQuery(event);

  const filter: any = {
    $or: [{ firmId: session.firm_id }, { firm_id: session.firm_id as any }]
  };
  if (query.btype && query.btype !== 'ALL') filter.btype = query.btype;
  if (query.id) filter._id = query.id;

  const bills = await Bill.find(filter).lean();
  const buffer = await exportBillsToExcel(bills);

  setHeader(event, 'Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  if (bills.length === 1) {
    const safeBno = String((bills[0] as any).bno || 'invoice').replace(/[^a-zA-Z0-9._-]/g, '_');
    setHeader(event, 'Content-Disposition', `attachment; filename="Invoice_${safeBno}.xlsx"`);
  } else {
    setHeader(event, 'Content-Disposition', 'attachment; filename="bills.xlsx"');
  }
  return buffer;
});
