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

  if (body.item) stock.item = body.item;
  if (body.hsn) stock.hsn = body.hsn;
  if (body.pno !== undefined) stock.pno = body.pno;
  if (body.oem !== undefined) stock.oem = body.oem;
  if (body.qty !== undefined) stock.qty = parseFloat(body.qty) || 0;
  if (body.uom) stock.uom = body.uom;
  if (body.rate !== undefined) stock.rate = parseFloat(body.rate) || 0;
  if (body.grate !== undefined) stock.grate = parseFloat(body.grate) || 0;
  if (body.mrp !== undefined) stock.mrp = parseFloat(body.mrp) || 0;

  stock.total = stock.qty * stock.rate;

  await stock.save();

  return {
    success: true,
    message: 'Stock updated successfully',
    data: stock
  };
});
