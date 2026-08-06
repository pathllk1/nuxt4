import mongoose from 'mongoose';
import Bill from '../../models/Bill';
import Party from '../../models/Party';
import StockReg from '../../models/StockReg';
import { LedgerService } from '../../utils/accounting/ledger.service';
import { StockService } from '../../utils/inventory/stock.service';
import { getNextBillNumber, getNextVoucherNumber, calcBillTotals, getEffectiveItemQty, isServiceItem } from '../../utils/accounting/bill-utils';
import { resolvePartyLocation, resolveFirmLocation, isGstEnabled } from '../../utils/accounting/bill-shared';
import { requireAuthSession } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  const user = await requireAuthSession(event);
  const body = await readBody(event) || {};
  const { meta, party, cart, otherCharges, consignee } = body;

  if (!cart?.length) {
    throw createError({ statusCode: 400, statusMessage: 'Cart cannot be empty' });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const firmIdObj = new mongoose.Types.ObjectId(user.firm_id as string);
    const partyId = party.id || party._id || party;
    const username = user.username || user.email || 'system';

    const partyDoc = await Party.findOne({ _id: partyId, firmId: firmIdObj }).session(session).lean();
    if (!partyDoc) {
      throw createError({ statusCode: 404, statusMessage: 'Party not found' });
    }

    const partyInfo = await resolvePartyLocation(partyDoc, meta?.partyGstin);
    const { firmLoc, firmStateCode } = await resolveFirmLocation(firmIdObj, meta?.firmGstin);

    const billType = (meta?.billType || 'intra-state').toLowerCase();
    const billNo = await getNextBillNumber(firmIdObj, 'SALES');
    const voucherId = await getNextVoucherNumber(firmIdObj);

    const gstEnabled = await isGstEnabled(firmIdObj);
    const totals = calcBillTotals(cart, otherCharges, gstEnabled, billType, !!meta?.reverseCharge, getEffectiveItemQty);

    const processedItems = cart.map((item: any) => {
      const qty = getEffectiveItemQty(item);
      const lineValue = qty * (item.rate || 0) * (1 - ((item.disc || 0) / 100));
      let itemCgst = 0, itemSgst = 0, itemIgst = 0;
      if (gstEnabled) {
        const taxRate = parseFloat(item.grate) || 0;
        if (billType === 'intra-state') {
          itemCgst = lineValue * (taxRate / 200);
          itemSgst = lineValue * (taxRate / 200);
        } else {
          itemIgst = lineValue * (taxRate / 100);
        }
      }
      return {
        ...item,
        qty,
        total: lineValue,
        cgst: itemCgst,
        sgst: itemSgst,
        igst: itemIgst
      };
    });

    const consigneeStateCode = consignee?.stateCode || 
      consignee?.state_code || 
      (consignee?.gstin && consignee.gstin !== 'UNREGISTERED' && consignee.gstin.length >= 2 ? consignee.gstin.substring(0, 2) : null);

    const newBill = (await Bill.create([{
      firmId: firmIdObj,
      voucherId: String(voucherId),
      bno: billNo,
      bdate: meta?.billDate || new Date().toISOString().split('T')[0],
      partyId: partyDoc._id,
      partyName: partyDoc.name,
      partyGstin: partyInfo.gstin,
      partyAddress: partyInfo.address,
      partyState: partyInfo.state,
      partyStateCode: partyInfo.stateCode,
      partyPin: partyInfo.pin,
      firmGstin: firmLoc?.gst_number,
      firmState: firmLoc?.state,
      firmStateCode: firmStateCode,
      grossTotal: totals.grossTotal,
      netTotal: totals.netTotal,
      roundOff: totals.roundOff,
      cgst: totals.cgst,
      sgst: totals.sgst,
      igst: totals.igst,
      btype: 'SALES',
      billSubtype: billType.toUpperCase(),
      items: processedItems,
      otherCharges: otherCharges || [],
      orderNo: meta?.referenceNo,
      vehicleNo: meta?.vehicleNo,
      dispatchThrough: meta?.dispatchThrough,
      consigneeName: consignee?.name,
      consigneeGstin: consignee?.gstin,
      consigneeAddress: consignee?.address,
      consigneeState: consignee?.state,
      consigneePin: consignee?.pin,
      consigneeStateCode,
      narration: meta?.narration,
      reverseCharge: !!meta?.reverseCharge,
      createdBy: username,
      status: 'ACTIVE'
    }], { session }))[0]!;

    const cogsLines: Array<{ stockId: any; stockRegId: any; item: string; cogsValue: number }> = [];
    let taxableItemsTotal = 0;

    for (const item of processedItems) {
      const isService = isServiceItem(item);
      const qty = item.qty;
      const lineValue = item.total;
      taxableItemsTotal += lineValue;

      if (isService) {
        await StockReg.create([{
          firm_id: firmIdObj,
          type: 'SALE',
          bno: billNo,
          bdate: newBill.bdate,
          supply: partyDoc.name,
          item: item.item,
          item_type: 'SERVICE',
          qty,
          uom: item.uom,
          hsn: item.hsn,
          rate: item.rate,
          grate: item.grate,
          disc: item.disc || 0,
          total: lineValue,
          bill_id: newBill._id,
          user: username,
          qtyh: 0,
          item_narration: item.narration
        }], { session });
        continue;
      }

      if (item.stockId) {
        const { cogsValue } = await StockService.updateStockOutward({
          firmId: firmIdObj,
          itemData: { ...item, stockId: new mongoose.Types.ObjectId(item.stockId), qty, narration: item.narration },
          billData: { bno: billNo, bdate: newBill.bdate, supply: partyDoc.name, billId: newBill._id as mongoose.Types.ObjectId, btype: 'SALE' },
          user: username,
          session
        });
        const reg = await StockReg.findOne({ bill_id: newBill._id, stock_id: item.stockId }).sort({ createdAt: -1 }).session(session);
        cogsLines.push({ stockId: item.stockId, stockRegId: reg?._id, item: item.item, cogsValue });
      }
    }

    // Post to Double-Entry Ledger
    const ledgerParams = {
      firmId: firmIdObj,
      billId: newBill._id,
      voucherId: String(voucherId),
      billNo,
      billDate: newBill.bdate,
      party: { _id: partyDoc._id, name: partyDoc.name },
      netTotal: totals.netTotal,
      cgst: totals.cgst,
      sgst: totals.sgst,
      igst: totals.igst,
      roundOff: totals.roundOff,
      otherCharges: otherCharges || [],
      taxableItemsTotal,
      cogsLines,
      createdBy: username,
      session
    };

    await LedgerService.postSalesLedger(ledgerParams as any);

    await session.commitTransaction();
    session.endSession();

    return {
      success: true,
      message: 'Sales invoice created successfully',
      data: newBill
    };
  } catch (err: any) {
    await session.abortTransaction();
    session.endSession();
    throw createError({ statusCode: err.statusCode || 500, statusMessage: err.message });
  }
});
