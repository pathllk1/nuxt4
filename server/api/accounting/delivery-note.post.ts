import mongoose from 'mongoose';
import Bill from '../../models/Bill';
import Party from '../../models/Party';
import StockReg from '../../models/StockReg';
import { StockService } from '../../utils/inventory/stock.service';
import { getNextBillNumber, calcBillTotals, getEffectiveItemQty, isServiceItem } from '../../utils/accounting/bill-utils';
import { resolvePartyLocation, resolveFirmLocation, isGstEnabled } from '../../utils/accounting/bill-shared';
import { requireAuthSession } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  const user = await requireAuthSession(event);
  const body = await readBody(event) || {};
  const { meta = {}, party, cart, otherCharges = [], consignee } = body;

  if (!cart?.length) {
    throw createError({ statusCode: 400, statusMessage: 'Cart cannot be empty' });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const firmIdObj = new mongoose.Types.ObjectId(String(user.firm_id));
    const username = user.username || user.email || 'system';
    const partyId = party?.id || party?._id || party;

    const partyDoc = await (Party as any).findOne({ _id: partyId, firmId: firmIdObj }).session(session).lean();
    if (!partyDoc) throw createError({ statusCode: 404, statusMessage: 'Party not found' });

    const partyInfo = await resolvePartyLocation(partyDoc, meta?.partyGstin);
    const { firmLoc, firmStateCode } = await resolveFirmLocation(firmIdObj, meta?.firmGstin);
    const billType = String(meta?.billType || 'intra-state').toLowerCase();
    const billNo = await getNextBillNumber(firmIdObj, 'DELIVERY_NOTE');
    const gstEnabled = await isGstEnabled(firmIdObj);
    const totals = calcBillTotals(cart, otherCharges, gstEnabled, billType, !!meta?.reverseCharge, getEffectiveItemQty);

    const processedItems = cart.map((item: any) => {
      const qty = getEffectiveItemQty(item);
      const lineValue = qty * (item.rate || 0) * (1 - ((item.disc || 0) / 100));
      const taxRate = parseFloat(item.grate) || 0;
      const cgst = gstEnabled && billType === 'intra-state' ? lineValue * (taxRate / 200) : 0;
      const sgst = gstEnabled && billType === 'intra-state' ? lineValue * (taxRate / 200) : 0;
      const igst = gstEnabled && billType !== 'intra-state' ? lineValue * (taxRate / 100) : 0;
      return { ...item, qty, total: lineValue, cgst, sgst, igst };
    });

    const consigneeStateCode = consignee?.stateCode || consignee?.state_code ||
      (consignee?.gstin && consignee.gstin !== 'UNREGISTERED' && consignee.gstin.length >= 2 ? consignee.gstin.substring(0, 2) : null);

    const [newBill] = await (Bill as any).create([{
      firmId: firmIdObj,
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
      firmStateCode,
      grossTotal: totals.grossTotal,
      netTotal: totals.netTotal,
      roundOff: totals.roundOff,
      cgst: totals.cgst,
      sgst: totals.sgst,
      igst: totals.igst,
      btype: 'DELIVERY_NOTE',
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
      reverseCharge: !!meta?.reverseCharge,
      createdBy: username,
      status: 'ACTIVE'
    }], { session });

    for (const item of processedItems) {
      const qty = item.qty;
      const lineValue = item.total;
      if (isServiceItem(item)) {
        await (StockReg as any).create([{
          firm_id: firmIdObj,
          type: 'DELIVERY_NOTE',
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

      if (!item.stockId) throw new Error(`Stock ID is required for ${item.item}`);
      await StockService.updateStockOutward({
        firmId: firmIdObj,
        itemData: { stockId: new mongoose.Types.ObjectId(item.stockId), qty, rate: item.rate, grate: item.grate, batch: item.batch, narration: item.narration },
        billData: { bno: billNo, bdate: newBill.bdate, supply: partyDoc.name, billId: newBill._id, btype: 'DELIVERY_NOTE' },
        user: username,
        session
      });
    }

    await session.commitTransaction();
    return { success: true, message: 'Delivery note created successfully', data: newBill };
  } catch (err: any) {
    await session.abortTransaction();
    throw createError({ statusCode: err.statusCode || 500, statusMessage: err.message || 'Failed to create delivery note' });
  } finally {
    session.endSession();
  }
});