import { defineEventHandler, readBody, createError } from 'h3';
import mongoose from 'mongoose';
import Stock from '../../../models/Stock';

export default defineEventHandler(async (event) => {
  const id = event.context.params?.id;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid stock ID' });
  }

  const body = await readBody(event);
  const stock = await Stock.findById(id);
  if (!stock) {
    throw createError({ statusCode: 404, statusMessage: 'Stock item not found' });
  }

  if (body.item) stock.item = String(body.item).trim();
  if (body.hsn) stock.hsn = String(body.hsn).trim();
  if (body.pno !== undefined) stock.pno = String(body.pno || '').trim();
  if (body.oem !== undefined) stock.oem = String(body.oem || '').trim();
  if (body.uom) stock.uom = body.uom;
  if (body.minLevel !== undefined) stock.minLevel = parseFloat(body.minLevel) || 0;
  if (body.grate !== undefined) stock.grate = parseFloat(body.grate) || 0;
  if (body.mrp !== undefined) stock.mrp = parseFloat(body.mrp) || 0;

  // If batches are provided, recalculate stock balances
  if (Array.isArray(body.batches) && body.batches.length > 0) {
    stock.batches = body.batches.map((b: any) => ({
      batch: (b.batch || '').trim() || 'DEFAULT',
      qty: Math.max(0, parseFloat(b.qty) || 0),
      uom: b.uom || stock.uom || 'PCS',
      rate: Math.max(0, parseFloat(b.rate) || 0),
      sale_rate: Math.max(0, parseFloat(b.sale_rate || b.saleRate || b.rate) || 0),
      grate: b.grate !== undefined ? parseFloat(b.grate) : stock.grate,
      mrp: Math.max(0, parseFloat(b.mrp) || 0),
      expiry: b.expiry ? new Date(b.expiry) : undefined
    }));
    stock.qty = stock.batches.reduce((sum: number, b: any) => sum + b.qty, 0);
    stock.total = stock.batches.reduce((sum: number, b: any) => sum + (b.qty * b.rate), 0);
    if (stock.qty > 0) {
      stock.rate = stock.total / stock.qty;
    } else if (stock.batches[0]?.rate) {
      stock.rate = stock.batches[0].rate;
    }
  } else if (body.qty !== undefined) {
    stock.qty = parseFloat(body.qty) || 0;
    if (body.rate !== undefined) stock.rate = parseFloat(body.rate) || 0;
    stock.total = stock.qty * stock.rate;
  }

  await stock.save();

  return {
    success: true,
    message: 'Stock updated successfully',
    data: stock
  };
});
