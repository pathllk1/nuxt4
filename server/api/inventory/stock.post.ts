import { defineEventHandler, readBody, createError } from 'h3';
import mongoose from 'mongoose';
import { requireAuthSession } from '../../utils/auth';
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
  if (!body || !body.item || !body.hsn) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Item name and HSN code are required'
    });
  }

  const qty = parseFloat(body.qty) || 0;
  const rate = parseFloat(body.rate) || 0;
  const grate = parseFloat(body.grate) || 18;
  const uom = body.uom || 'PCS';
  const total = parseFloat(body.total) || (qty * rate);

  const initialBatch = {
    batch: body.batch || 'DEFAULT',
    qty: qty,
    uom: uom,
    rate: rate,
    grate: grate,
    mrp: parseFloat(body.mrp) || rate,
    expiry: body.expiry ? new Date(body.expiry) : undefined
  };

  const newStock = new Stock({
    firm_id: firmId,
    firmId: firmId,
    item: body.item,
    hsn: body.hsn,
    pno: body.pno || '',
    oem: body.oem || '',
    qty: qty,
    uom: uom,
    rate: rate,
    grate: grate,
    total: total,
    mrp: parseFloat(body.mrp) || rate,
    batches: [initialBatch]
  });

  await newStock.save();

  return {
    success: true,
    statusCode: 201,
    message: 'Stock item created successfully',
    data: newStock
  };
});
