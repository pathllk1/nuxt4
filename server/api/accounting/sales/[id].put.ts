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
import { connectDB } from '../../../plugins/mongodb';

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

  await connectDB();

  const firmIdObj = new mongoose.Types.ObjectId(String(user.firm_id));
  const username = user.username || user.email || 'system';

  const executeUpdate = async (session?: mongoose.ClientSession) => {
    const existingBillQuery = Bill.findOne({ _id: billId, firmId: firmIdObj });
    if (session) existingBillQuery.session(session);
    const existingBill = await existingBillQuery;

    if (!existingBill) {
      throw createError({ statusCode: 404, statusMessage: 'Bill not found' });
    }
    if (existingBill.status === 'CANCELLED') {
      throw createError({ statusCode: 400, statusMessage: 'Cancelled bills cannot be modified' });
    }
    if (existingBill.btype !== 'SALES') {
      throw createError({ statusCode: 400, statusMessage: 'Only sales bills can be updated' });
    }

    const partyId = party.id || party._id || party;
    const partyQuery = Party.findOne({ _id: partyId, firmId: firmIdObj });
    if (session) partyQuery.session(session);
    const partyDoc = await partyQuery.lean();

    if (!partyDoc) {
      throw createError({ statusCode: 404, statusMessage: 'Party not found' });
    }

    const requestBillNo = meta?.bno || meta?.billNo;
    if (requestBillNo && requestBillNo !== existingBill.bno) {
      throw createError({ statusCode: 400, statusMessage: 'Bill number cannot be changed' });
    }

    const partyInfo = await resolvePartyLocation(partyDoc, meta?.partyGstin);
    const { firmLoc, firmStateCode } = await resolveFirmLocation(firmIdObj, meta?.firmGstin);

    const billType = (meta?.billType || existingBill.billSubtype || 'intra-state').toLowerCase();
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

    // Rollback previous stock adjustments
    const oldStockRegsQuery = StockReg.find({ bill_id: existingBill._id });
    if (session) oldStockRegsQuery.session(session);
    const oldStockRegs = await oldStockRegsQuery;

    for (const reg of oldStockRegs) {
      if (reg.item_type !== 'SERVICE' && reg.stock_id) {
        await StockService.rollbackStockMovement({
          firmId: firmIdObj,
          movementType: 'SALE',
          itemData: {
            stockId: reg.stock_id,
            qty: reg.qty,
            rate: reg.rate,
            batch: reg.batch
          },
          session
        });
      }
    }

    if (session) {
      await StockReg.deleteMany({ bill_id: existingBill._id }, { session });
    } else {
      await StockReg.deleteMany({ bill_id: existingBill._id });
    }

    const cogsLines: Array<{ stockId: any; stockRegId: any; item: string; cogsValue: number }> = [];
    let taxableItemsTotal = 0;

    for (const item of processedItems) {
      const isService = isServiceItem(item);
      const qty = item.qty;
      const lineValue = item.total;
      taxableItemsTotal += lineValue;

      if (isService) {
        const sRegData = {
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
        };
        if (session) {
          await StockReg.create([sRegData], { session });
        } else {
          await StockReg.create(sRegData);
        }
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
        const regQuery = StockReg.findOne({ bill_id: existingBill._id, stock_id: item.stockId }).sort({ createdAt: -1 });
        if (session) regQuery.session(session);
        const reg = await regQuery;
        cogsLines.push({ stockId: item.stockId, stockRegId: reg?._id, item: item.item, cogsValue });
      }
    }

    // Update Bill
    existingBill.bdate = meta?.billDate || existingBill.bdate;
    existingBill.partyId = partyDoc._id;
    existingBill.partyName = partyDoc.name;
    existingBill.partyGstin = partyInfo.gstin;
    existingBill.partyAddress = partyInfo.address;
    existingBill.partyState = partyInfo.state;
    existingBill.partyStateCode = partyInfo.stateCode;
    existingBill.partyPin = partyInfo.pin;
    existingBill.firmGstin = firmLoc?.gst_number;
    existingBill.firmState = firmLoc?.state;
    existingBill.firmStateCode = firmStateCode;
    existingBill.grossTotal = totals.grossTotal;
    existingBill.netTotal = totals.netTotal;
    existingBill.roundOff = totals.roundOff;
    existingBill.cgst = totals.cgst;
    existingBill.sgst = totals.sgst;
    existingBill.igst = totals.igst;
    existingBill.billSubtype = billType.toUpperCase();
    existingBill.items = processedItems;
    existingBill.otherCharges = otherCharges || [];
    existingBill.orderNo = meta?.referenceNo;
    existingBill.vehicleNo = meta?.vehicleNo;
    existingBill.dispatchThrough = meta?.dispatchThrough;
    existingBill.consigneeName = consignee?.name;
    existingBill.consigneeGstin = consignee?.gstin;
    existingBill.consigneeAddress = consignee?.address;
    existingBill.consigneeState = consignee?.state;
    existingBill.consigneePin = consignee?.pin;
    existingBill.consigneeStateCode = consigneeStateCode;
    existingBill.narration = meta?.narration;
    existingBill.reverseCharge = !!meta?.reverseCharge;

    if (session) {
      await existingBill.save({ session });
      await Ledger.deleteMany({
        firmId: firmIdObj,
        voucherGroupId: existingBill.voucherId,
        voucherType: 'SALES'
      }, { session });
    } else {
      await existingBill.save();
      await Ledger.deleteMany({
        firmId: firmIdObj,
        voucherGroupId: existingBill.voucherId,
        voucherType: 'SALES'
      });
    }

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

    return existingBill;
  };

  let session: mongoose.ClientSession | null = null;
  try {
    session = await mongoose.connection.startSession();
    session.startTransaction();
    const updated = await executeUpdate(session);
    await session.commitTransaction();
    session.endSession();
    return {
      success: true,
      message: 'Sales invoice updated successfully',
      data: updated
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
      console.warn('Retrying sales invoice update without transaction session:', err.message);
      try {
        const updated = await executeUpdate(undefined);
        return {
          success: true,
          message: 'Sales invoice updated successfully',
          data: updated
        };
      } catch (retryErr: any) {
        throw createError({ statusCode: retryErr.statusCode || 500, statusMessage: retryErr.message });
      }
    }

    throw createError({ statusCode: err.statusCode || 500, statusMessage: err.message });
  }
});
