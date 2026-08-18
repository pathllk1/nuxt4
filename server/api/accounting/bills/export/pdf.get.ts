import { defineEventHandler, getQuery, setHeader } from 'h3';
import mongoose from 'mongoose';
import Bill from '../../../../models/Bill';
import Firm from '../../../../models/Firm';
import { requireAuthSession } from '../../../../utils/auth';
import { exportBillsToPdfBuffer } from '../../../../utils/accounting/pdf-export.utils';

export default defineEventHandler(async (event) => {
  const session = await requireAuthSession(event);
  const query = getQuery(event);

  const firmIdObj = new mongoose.Types.ObjectId(session.firm_id as string);
  const filter: any = {
    $or: [{ firmId: firmIdObj }, { firm_id: firmIdObj }]
  };

  if (query.btype) {
    const bt = String(query.btype).toUpperCase();
    if (bt === 'SALES_GOODS') {
      filter.btype = 'SALES';
      filter.invoiceMode = { $ne: 'ACCOUNTING' };
    } else if (bt === 'SALES_SERVICE') {
      filter.btype = 'SALES';
      filter.invoiceMode = 'ACCOUNTING';
    } else if (bt === 'PURCHASE_GOODS') {
      filter.btype = 'PURCHASE';
      filter.invoiceMode = { $ne: 'ACCOUNTING' };
    } else if (bt === 'PURCHASE_SERVICE') {
      filter.btype = 'PURCHASE';
      filter.invoiceMode = 'ACCOUNTING';
    } else if (bt !== 'ALL') {
      filter.btype = bt;
    }
  }

  const search = String(query.search || query.searchTerm || '').trim();
  if (search) {
    filter.$and = [
      {
        $or: [
          { bno: { $regex: search, $options: 'i' } },
          { partyName: { $regex: search, $options: 'i' } },
          { partyGstin: { $regex: search, $options: 'i' } },
          { supplierBillNo: { $regex: search, $options: 'i' } },
        ]
      }
    ];
  }

  const sortOrder = query.sortOrder === 'asc' ? 1 : -1;
  const bills = await Bill.find(filter)
    .sort({ bdate: sortOrder, bno: sortOrder, createdAt: sortOrder })
    .lean();

  const firm = await Firm.findById(session.firm_id).lean();
  const buffer = await exportBillsToPdfBuffer(bills, firm);

  setHeader(event, 'Content-Type', 'application/pdf');
  setHeader(event, 'Content-Disposition', 'attachment; filename="Bills_Register_Report.pdf"');
  return buffer;
});
