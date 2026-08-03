import { defineEventHandler, readBody, createError } from 'h3';
import mongoose from 'mongoose';
import Bill from '../../../models/Bill';

export default defineEventHandler(async (event) => {
  const id = event.context.params?.id;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid bill ID' });
  }

  const body = await readBody(event);
  const bill = await Bill.findById(id);
  if (!bill) {
    throw createError({ statusCode: 404, statusMessage: 'Purchase bill not found' });
  }

  if (body.meta) {
    if (body.meta.billDate) bill.bdate = body.meta.billDate;
    if (body.meta.supplierBillNo !== undefined) bill.orderNo = body.meta.supplierBillNo;
    if (body.meta.referenceNo !== undefined) bill.referenceNo = body.meta.referenceNo;
    if (body.meta.dispatchThrough !== undefined) bill.dispatchThrough = body.meta.dispatchThrough;
    if (body.meta.narration !== undefined) bill.narration = body.meta.narration;
    if (body.meta.reverseCharge !== undefined) bill.reverseCharge = Boolean(body.meta.reverseCharge);
  }

  if (body.party) {
    bill.partyId = body.party._id || bill.partyId;
    bill.partyName = body.party.name || body.party.firm || bill.partyName;
    bill.partyAddress = body.party.address || bill.partyAddress;
    bill.partyGstin = body.meta?.partyGstin || body.party.gstin || bill.partyGstin;
  }

  if (Array.isArray(body.cart)) {
    bill.items = body.cart;
    bill.grossTotal = body.cart.reduce((sum: number, item: any) => sum + (parseFloat(item.total || item.lineVal) || 0), 0);
    bill.netTotal = Math.round(bill.grossTotal);
  }

  if (Array.isArray(body.otherCharges)) {
    bill.otherCharges = body.otherCharges;
  }

  await bill.save();

  return {
    success: true,
    message: 'Purchase bill updated successfully',
    data: bill
  };
});
