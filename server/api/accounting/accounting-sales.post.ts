import mongoose from 'mongoose';
import Bill from '../../models/Bill';
import Party from '../../models/Party';
import ChartOfAccounts from '../../models/ChartOfAccounts';
import { LedgerService } from '../../utils/accounting/ledger.service';
import { getNextBillNumber, getNextVoucherNumber } from '../../utils/accounting/bill-utils';
import { calcBillTotals } from '~~/shared/utils/tax-calc';
import { resolvePartyLocation, resolveFirmLocation, isGstEnabled } from '../../utils/accounting/bill-shared';
import { requireAuthSession } from '../../utils/auth';
import { connectDB } from '../../plugins/mongodb';
import { AccountingInvoiceMutationSchema } from '../../utils/accounting/schemas/accounting-mutation.schema';

export default defineEventHandler(async (event) => {
  const user = await requireAuthSession(event);
  const rawBody = (await readBody(event)) || {};
  const validationResult = AccountingInvoiceMutationSchema.safeParse(rawBody);

  if (!validationResult.success) {
    const firstIssue = validationResult.error.issues[0];
    const path = firstIssue?.path?.join('.') || 'body';
    throw createError({
      statusCode: 400,
      statusMessage: `Validation Error on ${path}: ${firstIssue?.message || 'Invalid request payload'}`
    });
  }

  const { meta, party, cart, otherCharges, consignee } = validationResult.data;

  await connectDB();

  const firmIdObj = new mongoose.Types.ObjectId(user.firm_id as string);
  const partyId = typeof party === 'string' ? party : (party.id || party._id);
  const username = user.username || user.email || 'system';

  const executeSave = async (session?: mongoose.ClientSession) => {
    const partyQuery = Party.findOne({ _id: partyId, firmId: firmIdObj });
    if (session) partyQuery.session(session);
    const partyDoc = await partyQuery.lean();

    if (!partyDoc) {
      throw createError({ statusCode: 404, statusMessage: 'Party not found' });
    }

    const partyInfo = await resolvePartyLocation(partyDoc, meta?.partyGstin);
    const { firmLoc, firmStateCode } = await resolveFirmLocation(firmIdObj, meta?.firmGstin);

    const billType = (meta?.billType || 'intra-state').toLowerCase();
    const billNo = await getNextBillNumber(firmIdObj, 'ACCOUNTING_SALES', meta?.billDate);
    const voucherId = await getNextVoucherNumber(firmIdObj);

    // Build virtual cart items for calcBillTotals compatibility
    const virtualCart = cart.map((item: any) => ({
      qty: 1,
      rate: parseFloat(item.amount) || 0,
      disc: 0,
      grate: parseFloat(item.gstRate) || 0,
    }));

    const gstEnabled = await isGstEnabled(firmIdObj);
    const totals = calcBillTotals(virtualCart, otherCharges, gstEnabled, billType, !!meta?.reverseCharge);

    // Process items for Bill storage
    const processedItems = cart.map((item: any) => {
      const amount = parseFloat(item.amount) || 0;
      const gstRate = parseFloat(item.gstRate) || 0;
      let itemCgst = 0, itemSgst = 0, itemIgst = 0;
      if (gstEnabled) {
        if (billType === 'intra-state') {
          itemCgst = amount * (gstRate / 200);
          itemSgst = amount * (gstRate / 200);
        } else {
          itemIgst = amount * (gstRate / 100);
        }
      }
      return {
        item: item.ledgerAccountHead || item.description || 'Service',
        hsn: item.sacCode || '',
        qty: 1,
        uom: 'NOS',
        rate: amount,
        grate: gstRate,
        disc: 0,
        total: amount,
        cgst: itemCgst,
        sgst: itemSgst,
        igst: itemIgst,
        itemType: 'SERVICE' as const,
        narration: item.narration || '',
        ledgerAccountId: item.ledgerAccountId ? new mongoose.Types.ObjectId(item.ledgerAccountId) : undefined,
        ledgerAccountHead: item.ledgerAccountHead || '',
      };
    });

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
      btype: 'SALES' as const,
      billSubtype: 'SERVICE',
      invoiceMode: 'ACCOUNTING' as const,
      items: processedItems,
      otherCharges: otherCharges || [],
      orderNo: meta?.referenceNo,
      consigneeName: consignee?.name || meta?.consigneeName || partyInfo.name || partyDoc.name,
      consigneeGstin: consignee?.gstin || meta?.consigneeGstin || partyInfo.gstin,
      consigneeAddress: consignee?.address || meta?.consigneeAddress || partyInfo.address,
      consigneeState: consignee?.state || meta?.consigneeState || partyInfo.state,
      consigneePin: consignee?.pin || meta?.consigneePin || partyInfo.pin,
      consigneeStateCode: consignee?.stateCode || meta?.consigneeStateCode || partyInfo.stateCode,
      narration: meta?.narration,
      reverseCharge: !!meta?.reverseCharge,
      createdBy: username,
      status: 'ACTIVE' as const,
    };

    const newBill: any = session
      ? (await (Bill as any).create([billData], { session }))[0]!
      : await (Bill as any).create(billData);

    // Build service items array for ledger posting
    const serviceItems = cart.map((item: any) => ({
      ledgerAccountHead: item.ledgerAccountHead,
      ledgerAccountId: item.ledgerAccountId,
      description: item.description || '',
      amount: parseFloat(item.amount) || 0,
      sacCode: item.sacCode || '',
    }));

    // Post to Double-Entry Ledger
    const postResult = await LedgerService.postAccountingSalesLedger({
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
      serviceItems,
      reverseCharge: !!meta?.reverseCharge,
      createdBy: username,
      session,
    });

    if (postResult?.voucherGroupId) {
      newBill.voucherId = postResult.voucherGroupId;
      const updateQuery = Bill.updateOne(
        { _id: newBill._id },
        { $set: { voucherId: postResult.voucherGroupId } }
      );
      if (session) updateQuery.session(session);
      await updateQuery.exec();
    }

    // Intelligent Master Learning: Sync SAC code, GST rate & description back to Chart of Accounts if empty
    for (const item of cart) {
      if (item.ledgerAccountId) {
        const updateFields: any = {};
        if (item.sacCode) updateFields.hsn_sac = item.sacCode;
        if (item.gstRate !== undefined && item.gstRate !== null) updateFields.gst_rate = parseFloat(item.gstRate) || 0;
        if (item.description) updateFields.description = item.description;

        if (Object.keys(updateFields).length > 0) {
          const coaUpdateQuery = ChartOfAccounts.updateOne(
            {
              _id: new mongoose.Types.ObjectId(item.ledgerAccountId),
              firm_id: firmIdObj,
              $or: [
                { hsn_sac: null },
                { hsn_sac: '' },
                { gst_rate: null },
                { description: null },
                { description: '' }
              ]
            },
            { $set: updateFields }
          );
          if (session) coaUpdateQuery.session(session);
          await coaUpdateQuery.exec();
        }
      }
    }

    return newBill;
  };

  // Try with Mongo transaction first if supported
  let session: mongoose.ClientSession | null = null;
  try {
    session = await mongoose.connection.startSession();
    session.startTransaction();
    const createdBill = await executeSave(session);
    await session.commitTransaction();
    session.endSession();
    return {
      success: true,
      message: 'Accounting sales invoice created successfully',
      data: createdBill,
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
      console.error('[Accounting Sales] MongoDB transaction unsupported:', err.message);
      throw createError({
        statusCode: 500,
        statusMessage: 'MongoDB replica set transactions are required for accounting sales posting to guarantee atomic execution across billing and financial General Ledger. Non-transactional execution is prohibited.'
      });
    }

    throw createError({ statusCode: err.statusCode || 500, statusMessage: err.message });
  }
});
