import { defineEventHandler, readBody, createError } from 'h3';
import mongoose from 'mongoose';
import { requireAuthSession } from '../../utils/auth';
import Stock from '../../models/Stock';
import StockReg from '../../models/StockReg';

export default defineEventHandler(async (event) => {
  let firmId: mongoose.Types.ObjectId;
  let userName = 'System';
  try {
    const session = await requireAuthSession(event);
    firmId = session.firm_id;
    userName = session.username || session.email || 'System';
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

  const itemTrimmed = String(body.item).trim();
  const hsnTrimmed = String(body.hsn).trim();

  // Check for duplicate item in this firm
  const existing = await Stock.findOne({
    $and: [
      { $or: [{ firm_id: firmId }, { firmId: firmId }] },
      { item: { $regex: `^${itemTrimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } }
    ]
  });
  if (existing) {
    throw createError({
      statusCode: 409,
      statusMessage: `Stock item "${itemTrimmed}" already exists in master catalog`
    });
  }

  // Parse batches array (or fallback to single-batch properties)
  let rawBatches = Array.isArray(body.batches) && body.batches.length > 0 ? body.batches : null;
  if (!rawBatches) {
    rawBatches = [{
      batch: body.batch || 'DEFAULT',
      qty: parseFloat(body.qty) || 0,
      uom: body.uom || 'PCS',
      rate: parseFloat(body.rate) || 0,
      sale_rate: parseFloat(body.sale_rate || body.saleRate || body.rate) || 0,
      grate: body.grate !== undefined ? parseFloat(body.grate) : 18,
      mrp: parseFloat(body.mrp) || parseFloat(body.rate) || 0,
      expiry: body.expiry ? new Date(body.expiry) : undefined
    }];
  }

  const formattedBatches = rawBatches.map((b: any) => ({
    batch: (b.batch || '').trim() || 'DEFAULT',
    qty: Math.max(0, parseFloat(b.qty) || 0),
    uom: b.uom || body.uom || 'PCS',
    rate: Math.max(0, parseFloat(b.rate) || 0),
    sale_rate: Math.max(0, parseFloat(b.sale_rate || b.saleRate || b.rate) || 0),
    grate: b.grate !== undefined ? parseFloat(b.grate) : (parseFloat(body.grate) || 18),
    mrp: Math.max(0, parseFloat(b.mrp) || parseFloat(b.rate) || 0),
    expiry: b.expiry ? new Date(b.expiry) : undefined
  }));

  const totalQty = formattedBatches.reduce((sum: number, b: any) => sum + b.qty, 0);
  const totalValuation = formattedBatches.reduce((sum: number, b: any) => sum + (b.qty * b.rate), 0);
  const avgRate = totalQty > 0 ? (totalValuation / totalQty) : (formattedBatches[0]?.rate || parseFloat(body.rate) || 0);
  const primaryGrate = body.grate !== undefined ? parseFloat(body.grate) : (formattedBatches[0]?.grate ?? 18);
  const primaryUom = body.uom || formattedBatches[0]?.uom || 'PCS';
  const primaryMrp = formattedBatches[0]?.mrp || parseFloat(body.mrp) || avgRate;

  const newStock = new Stock({
    firm_id: firmId,
    firmId: firmId,
    item: itemTrimmed,
    hsn: hsnTrimmed,
    pno: (body.pno || '').trim(),
    oem: (body.oem || '').trim(),
    qty: totalQty, // 0 is completely allowed for catalog registration!
    uom: primaryUom,
    rate: avgRate,
    grate: primaryGrate,
    total: totalValuation,
    mrp: primaryMrp,
    minLevel: parseFloat(body.minLevel) || 0,
    batches: formattedBatches,
    user: userName
  });

  await newStock.save();

  // If opening stock qty > 0, record initial StockReg opening movements for audit and ledger
  if (totalQty > 0) {
    for (const b of formattedBatches) {
      if (b.qty > 0) {
        const reg = new StockReg({
          firm_id: firmId,
          firmId: firmId,
          type: 'OPENING',
          bno: 'OPENING',
          bdate: new Date().toISOString().split('T')[0],
          supply: 'Opening Stock Balance',
          item: itemTrimmed,
          batch: b.batch,
          hsn: hsnTrimmed,
          qty: b.qty,
          uom: b.uom,
          rate: b.rate,
          grate: b.grate,
          total: b.qty * b.rate,
          stock_id: newStock._id,
          stockId: newStock._id,
          qtyh: b.qty,
          user: userName
        });
        await reg.save();
      }
    }
  }

  return {
    success: true,
    statusCode: 201,
    message: 'Stock item registered successfully',
    data: newStock
  };
});
