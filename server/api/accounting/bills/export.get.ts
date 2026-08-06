import { defineEventHandler, getQuery, setHeader } from 'h3';
import Bill from '../../../models/Bill';
import { requireAuthSession } from '../../../utils/auth';
import { exportBillsToExcel } from '../../../utils/accounting/export-utils';

export default defineEventHandler(async (event) => {
  const session = await requireAuthSession(event);
  const query = getQuery(event);

  const filter: any = { firmId: session.firm_id };
  if (query.btype && query.btype !== 'ALL') filter.btype = query.btype;

  const bills = await Bill.find(filter).lean();
  const buffer = await exportBillsToExcel(bills);

  setHeader(event, 'Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  setHeader(event, 'Content-Disposition', 'attachment; filename="bills.xlsx"');
  return buffer;
});
