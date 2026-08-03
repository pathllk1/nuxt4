import mongoose from 'mongoose';
import Bill from '../../../../models/Bill';
import Party from '../../../../models/Party';
import StockReg from '../../../../models/StockReg';
import { LedgerService } from '../../../../utils/accounting/ledger.service';
import { getNextBillNumber, getNextVoucherNumber, isServiceItem } from '../../../../utils/accounting/bill-utils';
import { requireAuthSession } from '../../../../utils/auth';

export default defineEventHandler(async (event) => {
  const user = await requireAuthSession(event);
  const challanId = event.context.params?.id;
  if (!challanId || !mongoose.Types.ObjectId.isValid(challanId)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid delivery note ID' });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const firmIdObj = new mongoose.Types.ObjectId(String(user.firm_id));
    const username = user.username || user.email || 'system';
    const challanObjectId = new mongoose.Types.ObjectId(challanId);

    const deliveryNote = await (Bill as any).findOne({ _id: challanObjectId, firmId: firmIdObj }).session(session);
    if (!deliveryNote) throw createError({ statusCode: 404, statusMessage: 'Delivery note not found' });
    if (deliveryNote.btype !== 'DELIVERY_NOTE') throw createError({ statusCode: 400, statusMessage: 'This document is not a delivery note' });
    if (deliveryNote.status === 'CANCELLED') throw createError({ statusCode: 400, statusMessage: 'Cancelled delivery notes cannot be converted' });
    if (deliveryNote.status === 'CONVERTED') throw createError({ statusCode: 400, statusMessage: 'Delivery note is already converted' });

    const partyDoc = await (Party as any).findOne({ _id: deliveryNote.partyId, firmId: firmIdObj }).session(session).lean();
    if (!partyDoc) throw new Error('Party not found');

    const billNo = await getNextBillNumber(firmIdObj, 'SALES');
    const voucherId = await getNextVoucherNumber(firmIdObj);
    const [salesInvoice] = await (Bill as any).create([{
      firmId: firmIdObj,
      voucherId: String(voucherId),
      bno: billNo,
      bdate: new Date().toISOString().split('T')[0],
      partyId: deliveryNote.partyId,
      partyName: deliveryNote.partyName,
      partyGstin: deliveryNote.partyGstin,
      partyAddress: deliveryNote.partyAddress,
      partyState: deliveryNote.partyState,
      partyStateCode: deliveryNote.partyStateCode,
      partyPin: deliveryNote.partyPin,
      firmGstin: deliveryNote.firmGstin,
      firmState: deliveryNote.firmState,
      firmStateCode: deliveryNote.firmStateCode,
      grossTotal: deliveryNote.grossTotal,
      netTotal: deliveryNote.netTotal,
      roundOff: deliveryNote.roundOff,
      cgst: deliveryNote.cgst,
      sgst: deliveryNote.sgst,
      igst: deliveryNote.igst,
      btype: 'SALES',
      billSubtype: deliveryNote.billSubtype,
      items: deliveryNote.items,
      otherCharges: deliveryNote.otherCharges,
      orderNo: deliveryNote.orderNo,
      vehicleNo: deliveryNote.vehicleNo,
      dispatchThrough: deliveryNote.dispatchThrough,
      consigneeName: deliveryNote.consigneeName,
      consigneeGstin: deliveryNote.consigneeGstin,
      consigneeAddress: deliveryNote.consigneeAddress,
      consigneeState: deliveryNote.consigneeState,
      consigneePin: deliveryNote.consigneePin,
      consigneeStateCode: deliveryNote.consigneeStateCode,
      narration: deliveryNote.narration,
      reverseCharge: deliveryNote.reverseCharge,
      refBillId: deliveryNote._id,
      createdBy: username,
      status: 'ACTIVE'
    }], { session });

    await (StockReg as any).updateMany(
      { firm_id: firmIdObj, bill_id: deliveryNote._id },
      { $set: { bill_id: salesInvoice._id, bno: salesInvoice.bno, bdate: salesInvoice.bdate, type: 'SALE' } },
      { session }
    );

    const cogsLines: Array<{ stockId: any; stockRegId: any; item: string; cogsValue: number }> = [];
    let taxableItemsTotal = 0;
    for (const item of salesInvoice.items || []) {
      taxableItemsTotal += item.total || 0;
      if (isServiceItem(item) || !item.stockId) continue;
      const reg = await (StockReg as any).findOne({ bill_id: salesInvoice._id, stock_id: item.stockId }).session(session);
      cogsLines.push({
        stockId: item.stockId,
        stockRegId: reg?._id,
        item: item.item,
        cogsValue: reg ? Math.abs(reg.qty || 0) * (reg.cost_rate || 0) : 0
      });
    }

    await LedgerService.postSalesLedger({
      firmId: firmIdObj,
      billId: salesInvoice._id,
      voucherId: String(voucherId),
      billNo,
      billDate: salesInvoice.bdate,
      party: partyDoc,
      netTotal: salesInvoice.netTotal,
      cgst: salesInvoice.cgst,
      sgst: salesInvoice.sgst,
      igst: salesInvoice.igst,
      roundOff: salesInvoice.roundOff,
      otherCharges: salesInvoice.otherCharges || [],
      taxableItemsTotal,
      cogsLines,
      createdBy: username,
      session
    } as any);

    deliveryNote.status = 'CONVERTED';
    await deliveryNote.save({ session });

    await session.commitTransaction();
    return { success: true, message: 'Delivery note converted to sales invoice', data: salesInvoice };
  } catch (err: any) {
    await session.abortTransaction();
    throw createError({ statusCode: err.statusCode || 500, statusMessage: err.message || 'Failed to convert delivery note' });
  } finally {
    session.endSession();
  }
});