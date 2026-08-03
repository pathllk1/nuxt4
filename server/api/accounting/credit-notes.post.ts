import { defineEventHandler, readBody, createError } from 'h3';
import mongoose from 'mongoose';
import { requireAuthSession } from '../../utils/auth';
import Bill from '../../models/Bill';
import StockReg from '../../models/StockReg';
import Stock from '../../models/Stock';

export default defineEventHandler(async (event) => {
  let firmId: mongoose.Types.ObjectId;
  try {
    const session = await requireAuthSession(event);
    firmId = session.firm_id;
  } catch {
    const firstFirm = await mongoose.model('Firm').findOne({});
    firmId = firstFirm ? firstFirm._id : new mongoose.Types.ObjectId();
  }

  const body = await readBody(event);
  const { originalBillId, returnCart, narration } = body;

  let originalBill = null;
  if (originalBillId && mongoose.Types.ObjectId.isValid(originalBillId)) {
    originalBill = await Bill.findById(originalBillId);
  }

  const billNo = `CN-${Math.floor(1000 + Math.random() * 9000)}`;
  const creditNote = new Bill({
    firmId: firmId,
    firm_id: firmId,
    btype: 'CREDIT_NOTE',
    bno: billNo,
    bdate: new Date().toISOString().split('T')[0],
    partyId: originalBill?.partyId,
    partyName: originalBill?.partyName || 'Customer',
    partyGstin: originalBill?.partyGstin,
    partyAddress: originalBill?.partyAddress,
    narration: narration || `Sales Return for Bill #${originalBill?.bno || ''}`,
    items: returnCart || [],
    grossTotal: (returnCart || []).reduce((sum: number, i: any) => sum + ((parseFloat(i.qty) || 0) * (parseFloat(i.rate) || 0)), 0),
    netTotal: Math.round((returnCart || []).reduce((sum: number, i: any) => sum + ((parseFloat(i.qty) || 0) * (parseFloat(i.rate) || 0)), 0))
  });

  await creditNote.save();

  // Create stock movements for returned items (inward stock return)
  if (Array.isArray(returnCart)) {
    for (const item of returnCart) {
      const qty = parseFloat(item.qty) || 0;
      if (qty <= 0) continue;

      const reg = new StockReg({
        firm_id: firmId,
        firmId: firmId,
        type: 'CREDIT_NOTE',
        bno: billNo,
        bdate: creditNote.bdate,
        supply: originalBill?.partyName || 'Customer',
        item: item.item,
        batch: item.batch || 'DEFAULT',
        qty: qty,
        uom: item.uom || 'PCS',
        rate: parseFloat(item.rate) || 0,
        total: qty * (parseFloat(item.rate) || 0),
        bill_id: creditNote._id,
        stock_id: item.stockId && mongoose.Types.ObjectId.isValid(item.stockId) ? new mongoose.Types.ObjectId(item.stockId) : null
      });
      await reg.save();

      // Return stock back to inventory
      if (item.stockId && mongoose.Types.ObjectId.isValid(item.stockId)) {
        const stock = await Stock.findById(item.stockId);
        if (stock) {
          stock.qty += qty;
          stock.total = stock.qty * stock.rate;
          await stock.save();
        }
      }
    }
  }

  return {
    success: true,
    statusCode: 201,
    message: 'Credit Note created successfully',
    data: creditNote
  };
});
