import mongoose from 'mongoose';
import Bill from '../../../models/Bill';
import Party from '../../../models/Party';
import StockReg from '../../../models/StockReg';
import { StockService } from '../../../utils/inventory/stock.service';
import { calcBillTotals, getEffectiveItemQty, isServiceItem } from '../../../utils/accounting/bill-utils';
import { resolvePartyLocation, resolveFirmLocation, isGstEnabled } from '../../../utils/accounting/bill-shared';
import { requireAuthSession } from '../../../utils/auth';

export default defineEventHandler(async (event) => {
  const user = await requireAuthSession(event);
  const billId = event.context.params?.id;
  if (!billId || !mongoose.Types.ObjectId.isValid(billId)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid delivery note ID' });
  }

  const body = await readBody(event) || {};
  const { meta = {}, party, cart, otherCharges = [], consignee } = body;
  if (!cart?.length) throw createError({ statusCode: 400, statusMessage: 'Cart cannot be empty' });

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const firmIdObj = new mongoose.Types.ObjectId(String(user.firm_id));
    const billObjectId = new mongoose.Types.ObjectId(billId);
    const username = user.username || user.email || 'system';

    const existingBill = await (Bill as any).findOne({ _id: billObjectId, firmId: firmIdObj }).session(session);
    if (!existingBill) throw createError({ statusCode: 404, statusMessage: 'Delivery note not found' });
    if (existingBill.btype !== 'DELIVERY_NOTE') throw createError({ statusCode: 400, statusMessage: 'Only delivery notes can be updated' });
    if (existingBill.status === 'CANCELLED') throw createError({ statusCode: 400, statusMessage: 'Cancelled delivery notes cannot be modified' });
    if (existingBill.status === 'CONVERTED') throw createError({ statusCode: 400, statusMessage: 'Converted delivery notes cannot be modified' });

    const partyId = party?.id || party?._id || party;
    const partyDoc = await (Party as any).findOne({ _id: partyId, firmId: firmIdObj }).session(session).lean();
    if (!partyDoc) throw createError({ statusCode: 404, statusMessage: 'Party not found' });

    const partyInfo = await resolvePartyLocation(partyDoc, meta?.partyGstin);
    const { firmLoc, firmStateCode } = await resolveFirmLocation(firmIdObj, meta?.firmGstin);
    const billType = String(meta?.billType || 'intra-state').toLowerCase();
    const gstEnabled = await isGstEnabled(firmIdObj);
    const totals = calcBillTotals(cart, otherCharges, gstEnabled, billType, !!meta?.reverseCharge, getEffectiveItemQty);
    const processedItems = cart.map((item: any) => {
      const qty = getEffectiveItemQty(item);
      const lineValue = qty * (item.rate || 0) * (1 - ((item.disc || 0) / 100));
      const taxRate = parseFloat(item.grate) || 0;
      return {
        ...item,
        qty,
        total: lineValue,
        cgst: gstEnabled && billType === 'intra-state' ? lineValue * (taxRate / 200) : 0,
        sgst: gstEnabled && billType === 'intra-state' ? lineValue * (taxRate / 200) : 0,
        igst: gstEnabled && billType !== 'intra-state' ? lineValue * (taxRate / 100) : 0
      };
    });

    const stockRegFilter = { firm_id: firmIdObj, bill_id: billObjectId };
    const existingRegs = await (StockReg as any).find(stockRegFilter).session(session);
    for (const reg of existingRegs) {
      if (reg.stock_id) await StockService.reverseMovement(reg._id, username, session);
    }
    await (StockReg as any).deleteMany(stockRegFilter, { session });

    const consigneeStateCode = consignee?.stateCode || consignee?.state_code ||
      (consignee?.gstin && consignee.gstin !== 'UNREGISTERED' && consignee.gstin.length >= 2 ? consignee.gstin.substring(0, 2) : null);

    await (Bill as any).findOneAndUpdate(
      { _id: billObjectId, firmId: firmIdObj },
      { $set: {
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
        firmStateCode,
        grossTotal: totals.grossTotal,
        netTotal: totals.netTotal,
        roundOff: totals.roundOff,
        cgst: totals.cgst,
        sgst: totals.sgst,
        igst: totals.igst,
        billSubtype: billType.toUpperCase(),
        items: processedItems,
        otherCharges,
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
        reverseCharge: !!meta?.reverseCharge
      } },
      { session }
    );

    for (const item of processedItems) {
      const qty = item.qty;
      const lineValue = item.total;
      if (isServiceItem(item)) {
        await (StockReg as any).create([{
          firm_id: firmIdObj,
          type: 'DELIVERY_NOTE',
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
      if (!item.stockId) throw new Error(`Stock ID is required for ${item.item}`);
      await StockService.updateStockOutward({
        firmId: firmIdObj,
        itemData: { stockId: new mongoose.Types.ObjectId(item.stockId), qty, rate: item.rate, grate: item.grate, batch: item.batch, narration: item.narration },
        billData: { bno: existingBill.bno, bdate: meta?.billDate || existingBill.bdate, supply: partyDoc.name, billId: existingBill._id, btype: 'DELIVERY_NOTE' },
        user: username,
        session
      });
    }

    await session.commitTransaction();
    return { success: true, message: 'Delivery note updated successfully' };
  } catch (err: any) {
    await session.abortTransaction();
    throw createError({ statusCode: err.statusCode || 500, statusMessage: err.message || 'Failed to update delivery note' });
  } finally {
    session.endSession();
  }
});