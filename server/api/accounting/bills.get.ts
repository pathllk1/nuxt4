import mongoose from 'mongoose';
import Bill from '../../models/Bill';
import { requireAuthSession } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  const user = await requireAuthSession(event);
  const query = getQuery(event);
  const { btype, search, status, invoiceMode, billSubtype, dateFrom, dateTo, limit, offset } = query;

  const filter: any = { firmId: new mongoose.Types.ObjectId(user.firm_id as string) };

  if (btype) {
    const bt = String(btype).toUpperCase();
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

  if (invoiceMode) {
    filter.invoiceMode = String(invoiceMode).toUpperCase();
  }

  if (billSubtype) {
    filter.billSubtype = String(billSubtype).toUpperCase();
  }

  if (status) {
    filter.status = (status as string).toUpperCase();
  }

  if (dateFrom || dateTo) {
    filter.bdate = {};
    if (dateFrom) filter.bdate.$gte = dateFrom;
    if (dateTo) filter.bdate.$lte = dateTo;
  }

  if (search) {
    const s = String(search).trim();
    filter.$or = [
      { bno: { $regex: s, $options: 'i' } },
      { partyName: { $regex: s, $options: 'i' } },
      { supplierBillNo: { $regex: s, $options: 'i' } },
    ];
  }

  const limitNum = Math.min(parseInt(limit as string) || 200, 1000);
  const offsetNum = parseInt(offset as string) || 0;

  const total = await Bill.countDocuments(filter);
  const bills = await Bill.find(filter)
    .sort({ bdate: -1, bno: -1, createdAt: -1 })
    .skip(offsetNum)
    .limit(limitNum)
    .populate('partyId', 'name gstin contact state')
    .lean();

  const enrichedBills = bills.map((b: any) => {
    const cgst = parseFloat(b.cgst) || 0;
    const sgst = parseFloat(b.sgst) || 0;
    const igst = parseFloat(b.igst) || 0;
    const totalTax = parseFloat((cgst + sgst + igst).toFixed(2));
    return {
      ...b,
      totalTax
    };
  });

  return {
    success: true,
    total,
    count: enrichedBills.length,
    data: enrichedBills
  };
});
