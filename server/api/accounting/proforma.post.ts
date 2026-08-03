import mongoose from 'mongoose';
import Bill from '../../models/Bill';
import Party from '../../models/Party';
import { getNextBillNumber, calcBillTotals, getEffectiveItemQty } from '../../utils/accounting/bill-utils';
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
    const billNo = await getNextBillNumber(firmIdObj, 'PROFORMA');

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

    const [newBill] = await Bill.create([{
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
      firmStateCode: firmStateCode,
      grossTotal: totals.grossTotal,
      netTotal: totals.netTotal,
      roundOff: totals.roundOff,
      cgst: totals.cgst,
      sgst: totals.sgst,
      igst: totals.igst,
      btype: 'PROFORMA',
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
    }], { session });

    await session.commitTransaction();
    session.endSession();

    return {
      success: true,
      message: 'Proforma invoice created successfully',
      data: newBill
    };
  } catch (err: any) {
    await session.abortTransaction();
    session.endSession();
    throw createError({ statusCode: err.statusCode || 500, statusMessage: err.message });
  }
});
