import mongoose from 'mongoose';
import Bill from '../../../models/Bill';
import Party from '../../../models/Party';
import StockReg from '../../../models/StockReg';
import Ledger from '../../../models/Ledger';
import { LedgerService } from '../../../utils/accounting/ledger.service';
import { StockService } from '../../../utils/inventory/stock.service';
import { calcBillTotals, getEffectiveItemQty, isServiceItem } from '../../../utils/accounting/bill-utils';
import { resolvePartyLocation, resolveFirmLocation, isGstEnabled } from '../../../utils/accounting/bill-shared';
import { requireAuthSession } from '../../../utils/auth';

export default defineEventHandler(async (event) => {
  const user = await requireAuthSession(event);
  const billId = event.context.params?.id;

  if (!billId || !mongoose.Types.ObjectId.isValid(billId)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid bill ID' });
  }

  const body = await readBody(event) || {};
  const { meta, party, cart, otherCharges, consignee } = body;

  if (!cart?.length) {
    throw createError({ statusCode: 400, statusMessage: 'Cart cannot be empty' });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const firmIdObj = new mongoose.Types.ObjectId(String(user.firm_id));
    const username = user.username || user.email || 'system';

    const existingBill = await Bill.findOne({ _id: billId, firmId: firmIdObj }).session(session);
    if (!existingBill) {
      await session.abortTransaction();
      throw createError({ statusCode: 404, statusMessage: 'Bill not found' });
    }
    if (existingBill.status === 'CANCELLED') {
      await session.abortTransaction();
      throw createError({ statusCode: 400, statusMessage: 'Cancelled bills cannot be modified' });
    }
    if (existingBill.btype !== 'SALES') {
      await session.abortTransaction();
      throw createError({ statusCode: 400, statusMessage: 'Only sales bills can be updated' });
    }

    const partyId = party.id || party._id || party;
    const partyDoc = await Party.findOne({ _id: partyId, firmId: firmIdObj }).session(session).lean();
    if (!partyDoc) {
      await session.abortTransaction();
      throw createError({ statusCode: 404, statusMessage: 'Party not found' });
    }

    const requestBillNo = meta?.bno || meta?.billNo;
    if (requestBillNo && requestBillNo !== existingBill.bno) {
      await session.abortTransaction();
      throw createError({ statusCode: 400, statusMessage: 'Bill number cannot be changed' });
    }

    const partyInfo = await resolvePartyLocation(partyDoc, meta?.partyGstin);
    const { firmLoc, firmStateCode } = await resolveFirmLocation(firmIdObj, meta?.firmGstin);

    const billType = (meta?.billType || 'intra-state').toLowerCase();
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

    // Step 1: Restore stock from old sale (add back atomically)
    const billObjectId = new mongoose.Types.ObjectId(billId);
    const stockRegFilter = {
      firm_id: firmIdObj,
      bill_id: billObjectId
    };
    const existingItems = await (StockReg as any).find(stockRegFilter).session(session);

    for (const ei of existingItems) {
      if (!ei.stock_id) continue;
      await StockService.reverseMovement(ei._id as mongoose.Types.ObjectId, username, session);
    }

    // Step 2: Update bill header
    await Bill.findOneAndUpdate(
      { _id: billId, firmId: firmIdObj },
      {
        $set: {
          bdate: meta?.billDate || existingBill.bdate,
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
        }
      },
      { session }
    );

    // Step 3: Delete old StockReg entries
    await (StockReg as any).deleteMany(stockRegFilter, { session });

    // Step 4: Apply new stock outward and create new StockReg entries
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
          bno: existingBill.bno,
          bdate: meta?.billDate || existingBill.bdate,
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
          bill_id: existingBill._id,
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
          billData: { bno: existingBill.bno, bdate: meta?.billDate || existingBill.bdate, supply: partyDoc.name, billId: existingBill._id as mongoose.Types.ObjectId, btype: 'SALE' },
          user: username,
          session
        });
        const reg = await (StockReg as any).findOne({ bill_id: existingBill._id, stock_id: item.stockId }).sort({ createdAt: -1 }).session(session);
        cogsLines.push({ stockId: item.stockId, stockRegId: reg?._id, item: item.item, cogsValue });
      }
    }

    // Step 5: Delete old ledger entries and post new ones
    await Ledger.deleteMany({
      firmId: firmIdObj,
      voucherGroupId: existingBill.voucherId,
      voucherType: 'SALES'
    }, { session });

    await LedgerService.postSalesLedger({
      firmId: firmIdObj,
      billId: existingBill._id as mongoose.Types.ObjectId,
      voucherId: String(existingBill.voucherId),
      billNo: existingBill.bno,
      billDate: meta?.billDate || existingBill.bdate,
      party: partyDoc,
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
    } as any);

    await session.commitTransaction();
    session.endSession();

    return {
      success: true,
      message: 'Sales invoice updated successfully'
    };
  } catch (err: any) {
    await session.abortTransaction();
    session.endSession();
    throw createError({ statusCode: err.statusCode || 500, statusMessage: err.message });
  }
});
