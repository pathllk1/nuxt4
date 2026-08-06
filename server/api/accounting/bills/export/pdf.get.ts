import { defineEventHandler, getQuery, setHeader } from 'h3';
import Bill from '../../../../models/Bill';
import Firm from '../../../../models/Firm';
import { requireAuthSession } from '../../../../utils/auth';
import { exportBillsToPdfBuffer } from '../../../../utils/accounting/pdf-export.utils';

export default defineEventHandler(async (event) => {
  const session = await requireAuthSession(event);
  const query = getQuery(event);

  const filter: any = { firmId: session.firm_id };
  if (query.btype && query.btype !== 'ALL') filter.btype = query.btype;

  const bills = await Bill.find(filter).lean();
  const firm = await Firm.findById(session.firm_id).lean();
  const buffer = await exportBillsToPdfBuffer(bills, firm);

  setHeader(event, 'Content-Type', 'application/pdf');
  setHeader(event, 'Content-Disposition', 'attachment; filename="Bills_Report.pdf"');
  return buffer;
});
