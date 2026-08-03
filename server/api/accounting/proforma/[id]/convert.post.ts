import mongoose from 'mongoose';
import Bill from '../../../../models/Bill';
import Party from '../../../../models/Party';
import StockReg from '../../../../models/StockReg';
import { LedgerService } from '../../../../utils/accounting/ledger.service';
import { StockService } from '../../../../utils/inventory/stock.service';
import { getNextBillNumber, getNextVoucherNumber, isServiceItem } from '../../../../utils/accounting/bill-utils';
import { requireAuthSession } from '../../../../utils/auth';

export default defineEventHandler(async (event) => {
  const user = await requireAuthSession(event);
  const proformaId = event.context.params?.id;

  if (!proformaId || !mongoose.Types.ObjectId.isValid(proformaId)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid proforma ID' });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const firmIdObj = new mongoose.Types.ObjectId(user.firm_id as string);
    const username = user.username || user.email || 'system';

    const proformaBill = await Bill.findOne({ _id: proformaId, firmId: firmIdObj }).session(session);
    if (!proformaBill) {
      await session.abortTransaction();
      throw createError({ statusCode: 404, statusMessage: 'Proforma bill not found' });
    }
    if (proformaBill.btype !== 'PROFORMA') {
      await session.abortTransaction();
      throw createError({ statusCode: 400, statusMessage: 'This document is not a Proforma Invoice' });
    }
    if (proformaBill.status === 'CANCELLED') {
      await session.abortTransaction();
      throw createError({ statusCode: 400, statusMessage: 'Cancelled proforma bills cannot be converted' });
    }
    if (proformaBill.status === 'CONVERTED') {
      await session.abortTransaction();
      throw createError({ statusCode: 400, statusMessage: 'This proforma has already been converted to a Sales Invoice' });
    }

    const billNo = await getNextBillNumber(firmIdObj, 'SALES');
    const voucherId = await getNextVoucherNumber(firmIdObj);

    const partyDoc = await Party.findOne({ _id: proformaBill.partyId, firmId: firmIdObj }).session(session).lean();
    if (!partyDoc) {
      await session.abortTransaction();
      throw createError({ statusCode: 404, statusMessage: 'Party not found' });
    }

    const [salesInvoice] = await Bill.create([{
      firmId: proformaBill.firmId,
      voucherId: String(voucherId),
      bno: billNo,
      bdate: new Date().toISOString().split('T')[0],
      partyId: proformaBill.partyId,
      partyName: proformaBill.partyName,
      partyGstin: proformaBill.partyGstin,
      partyAddress: proformaBill.partyAddress,
      partyState: proformaBill.partyState,
      partyStateCode: proformaBill.partyStateCode,
      partyPin: proformaBill.partyPin,
      firmGstin: proformaBill.firmGstin,
      firmState: proformaBill.firmState,
      firmStateCode: proformaBill.firmStateCode,
      grossTotal: proformaBill.grossTotal,
      netTotal: proformaBill.netTotal,
      roundOff: proformaBill.roundOff,
      cgst: proformaBill.cgst,
      sgst: proformaBill.sgst,
      igst: proformaBill.igst,
      btype: 'SALES',
      billSubtype: proformaBill.billSubtype,
      items: proformaBill.items,
      otherCharges: proformaBill.otherCharges,
      orderNo: proformaBill.orderNo,
      vehicleNo: proformaBill.vehicleNo,
      dispatchThrough: proformaBill.dispatchThrough,
      consigneeName: proformaBill.consigneeName,
      consigneeGstin: proformaBill.consigneeGstin,
      consigneeAddress: proformaBill.consigneeAddress,
      consigneeState: proformaBill.consigneeState,
      consigneePin: proformaBill.consigneePin,
      consigneeStateCode: proformaBill.consigneeStateCode,
      narration: proformaBill.narration,
      reverseCharge: proformaBill.reverseCharge,
      refBillId: proformaBill._id,
      createdBy: username,
      status: 'ACTIVE'
    }], { session });

    const cogsLines: Array<{ stockId: any; stockRegId: any; item: string; cogsValue: number }> = [];
    let taxableItemsTotal = 0;

    for (const item of salesInvoice.items) {
      const isService = isServiceItem(item);
      const qty = item.qty;
      const lineValue = item.total;
      taxableItemsTotal += lineValue;

      if (isService) {
        await StockReg.create([{
          firm_id: firmIdObj,
          type: 'SALE',
          bno: billNo,
          bdate: salesInvoice.bdate,
          supply: salesInvoice.partyName,
          item: item.item,
          item_type: 'SERVICE',
          qty,
          uom: item.uom,
          hsn: item.hsn,
          rate: item.rate,
          grate: item.grate,
          disc: item.disc || 0,
          total: lineValue,
          bill_id: salesInvoice._id,
          user: username,
          qtyh: 0,
          item_narration: item.narration
        }], { session });
        continue;
      }

      if (item.stockId) {
        const { cogsValue } = await StockService.updateStockOutward({
          firmId: firmIdObj,
          itemData: {
            stockId: new mongoose.Types.ObjectId(item.stockId),
            qty,
            rate: item.rate,
            grate: item.grate,
            batch: item.batch,
            narration: item.narration
          },
          billData: { bno: billNo, bdate: salesInvoice.bdate, supply: salesInvoice.partyName, billId: salesInvoice._id as mongoose.Types.ObjectId, btype: 'SALE' },
          user: username,
          session
        });
        const reg = await StockReg.findOne({ bill_id: salesInvoice._id, stock_id: item.stockId }).sort({ createdAt: -1 }).session(session);
        cogsLines.push({ stockId: item.stockId, stockRegId: reg?._id, item: item.item, cogsValue });
      }
    }

    await LedgerService.postSalesLedger({
      firmId: firmIdObj,
      billId: salesInvoice._id as mongoose.Types.ObjectId,
      voucherId: String(voucherId),
      billNo,
      billDate: salesInvoice.bdate,
      party: partyDoc,
      netTotal: salesInvoice.netTotal,
      cgst: salesInvoice.cgst,
      sgst: salesInvoice.sgst,
      igst: salesInvoice.igst,
      roundOff: salesInvoice.roundOff,
      otherCharges: salesInvoice.otherCharges,
      taxableItemsTotal,
      cogsLines,
      createdBy: username,
      session
    } as any);

    proformaBill.status = 'CONVERTED';
    await proformaBill.save({ session });

    await session.commitTransaction();
    session.endSession();

    return {
      success: true,
      message: 'Proforma converted to Sales Invoice successfully',
      data: salesInvoice
    };
  } catch (err: any) {
    await session.abortTransaction();
    session.endSession();
    throw createError({ statusCode: err.statusCode || 500, statusMessage: err.message });
  }
});
