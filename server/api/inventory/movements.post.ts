import { defineEventHandler, readBody, createError } from 'h3';
import mongoose from 'mongoose';
import { requireAuthSession } from '../../utils/auth';
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
  if (!body || !body.item || !body.type || body.qty === undefined) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Item, movement type, and quantity are required'
    });
  }

  const qty = parseFloat(body.qty) || 0;
  const rate = parseFloat(body.rate) || 0;

  const movement = new StockReg({
    firm_id: firmId,
    firmId: firmId,
    type: body.type,
    bno: body.bno || 'MANUAL',
    bdate: body.bdate || new Date().toISOString().split('T')[0],
    supply: body.supply || 'Manual Adjustment',
    item: body.item,
    batch: body.batch || 'DEFAULT',
    hsn: body.hsn || '',
    qty: qty,
    uom: body.uom || 'PCS',
    rate: rate,
    grate: parseFloat(body.grate) || 0,
    total: parseFloat(body.total) || (qty * rate),
    stock_id: body.stockId && mongoose.Types.ObjectId.isValid(body.stockId) ? new mongoose.Types.ObjectId(body.stockId) : null,
    stockId: body.stockId && mongoose.Types.ObjectId.isValid(body.stockId) ? new mongoose.Types.ObjectId(body.stockId) : null,
    qtyh: parseFloat(body.qtyh) || 0
  });

  await movement.save();

  // If linked to a stock record, update current stock balance
  if (movement.stock_id) {
    const stock = await Stock.findById(movement.stock_id);
    if (stock) {
      if (body.type === 'INWARD' || body.type === 'PURCHASE') {
        stock.qty += qty;
      } else if (body.type === 'OUTWARD' || body.type === 'SALES') {
        stock.qty = Math.max(0, stock.qty - qty);
      }
      stock.total = stock.qty * stock.rate;
      await stock.save();
    }
  }

  return {
    success: true,
    statusCode: 201,
    message: 'Stock movement recorded successfully',
    data: movement
  };
});
