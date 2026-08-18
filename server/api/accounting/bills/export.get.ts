import { defineEventHandler, getQuery, setHeader } from 'h3';
import mongoose from 'mongoose';
import Bill from '../../../models/Bill';
import { requireAuthSession } from '../../../utils/auth';
import { exportBillsToExcel } from '../../../utils/accounting/export-utils';

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

  if (query.id) filter._id = query.id;

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

  const buffer = await exportBillsToExcel(bills);

  setHeader(event, 'Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  if (bills.length === 1) {
    const safeBno = String((bills[0] as any).bno || 'invoice').replace(/[^a-zA-Z0-9._-]/g, '_');
    setHeader(event, 'Content-Disposition', `attachment; filename="Invoice_${safeBno}.xlsx"`);
  } else {
    setHeader(event, 'Content-Disposition', 'attachment; filename="Bills_Register.xlsx"');
  }
  return buffer;
});
