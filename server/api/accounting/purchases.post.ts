import mongoose from 'mongoose';
import Bill from '../../models/Bill';
import Party from '../../models/Party';
import StockReg from '../../models/StockReg';
import { LedgerService } from '../../utils/accounting/ledger.service';
import { StockService } from '../../utils/inventory/stock.service';
import { getNextBillNumber, getNextVoucherNumber, calcBillTotals, getEffectiveItemQty, ensureUniqueSupplierBillNo, isServiceItem } from '../../utils/accounting/bill-utils';
import { resolvePartyLocation, resolveFirmLocation, isGstEnabled } from '../../utils/accounting/bill-shared';
import { requireAuthSession } from '../../utils/auth';
import { connectDB } from '../../plugins/mongodb';

export default defineEventHandler(async (event) => {
  const user = await requireAuthSession(event);
  const body = await readBody(event) || {};
  const { meta, party, cart, otherCharges, consignee } = body;

  if (!cart?.length) {
    throw createError({ statusCode: 400, statusMessage: 'Cart cannot be empty' });
  }

  await connectDB();

  const firmIdObj = new mongoose.Types.ObjectId(user.firm_id as string);
  const partyId = party.id || party._id || party;
  const username = user.username || user.email || 'system';

  const executeSave = async (session?: mongoose.ClientSession) => {
    const partyQuery = Party.findOne({ _id: partyId, firmId: firmIdObj });
    if (session) partyQuery.session(session);
    const partyDoc = await partyQuery.lean();

    if (!partyDoc) {
      throw createError({ statusCode: 404, statusMessage: 'Party not found' });
    }

    if (meta?.supplierBillNo) {
      await ensureUniqueSupplierBillNo({
        firmId: firmIdObj,
        partyId: partyDoc._id as mongoose.Types.ObjectId,
        supplierBillNo: meta.supplierBillNo
      });
    }

    const partyInfo = await resolvePartyLocation(partyDoc, meta?.partyGstin);
    const { firmLoc, firmStateCode } = await resolveFirmLocation(firmIdObj, meta?.firmGstin);

    const billType = (meta?.billType || 'intra-state').toLowerCase();
    const billNo = await getNextBillNumber(firmIdObj, 'PURCHASE');
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

    const billData = {
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
      btype: 'PURCHASE',
      billSubtype: billType.toUpperCase(),
      items: processedItems,
      otherCharges: otherCharges || [],
      supplierBillNo: meta?.supplierBillNo,
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
    };

    const newBill = session
      ? (await Bill.create([billData], { session }))[0]!
      : await Bill.create(billData);

    const purchasedItems: Array<{ stockId: any; stockRegId: any; item: string; lineValue: number }> = [];

    for (const item of processedItems) {
      const isService = isServiceItem(item);
      const qty = item.qty;
      const lineValue = item.total;

      if (isService) {
        const sRegData = {
          firm_id: firmIdObj,
          type: 'PURCHASE',
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
        };
        if (session) {
          await StockReg.create([sRegData], { session });
        } else {
          await StockReg.create(sRegData);
        }
        continue;
      }

      await StockService.updateStockInward({
        firmId: firmIdObj,
        itemData: { ...item, qty, rate: item.rate * (1 - ((item.disc || 0) / 100)), narration: item.narration },
        billData: { bno: billNo, bdate: newBill.bdate, supply: partyDoc.name, billId: newBill._id as mongoose.Types.ObjectId, btype: 'PURCHASE' },
        user: username,
        session
      });
      const regQuery = StockReg.findOne({ bill_id: newBill._id, item: item.item }).sort({ createdAt: -1 });
      if (session) regQuery.session(session);
      const reg = await regQuery;
      purchasedItems.push({ stockId: reg?.stock_id, stockRegId: reg?._id, item: item.item, lineValue });
    }

    // Post Purchase to Double-Entry Ledger
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
      purchasedItems,
      createdBy: username,
      session
    };

    await LedgerService.postPurchaseLedger(ledgerParams as any);

    return newBill;
  };

  let session: mongoose.ClientSession | null = null;
  try {
    session = await mongoose.connection.startSession();
    session.startTransaction();
    const createdBill = await executeSave(session);
    await session.commitTransaction();
    session.endSession();
    return {
      success: true,
      message: 'Purchase bill created successfully',
      data: createdBill
    };
  } catch (err: any) {
    if (session) {
      try { await session.abortTransaction(); } catch (_) {}
      try { session.endSession(); } catch (_) {}
    }

    if (
      err.message?.includes('ClientSession must be from the same MongoClient') ||
      err.message?.includes('replica set') ||
      err.message?.includes('Transaction numbers')
    ) {
      console.warn('Retrying purchase bill post without transaction session:', err.message);
      try {
        const createdBill = await executeSave(undefined);
        return {
          success: true,
          message: 'Purchase bill created successfully',
          data: createdBill
        };
      } catch (retryErr: any) {
        throw createError({ statusCode: retryErr.statusCode || 500, statusMessage: retryErr.message });
      }
    }

    throw createError({ statusCode: err.statusCode || 500, statusMessage: err.message });
  }
});
