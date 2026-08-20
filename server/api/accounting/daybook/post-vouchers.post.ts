import { defineEventHandler, readBody, createError } from 'h3';
import mongoose from 'mongoose';
import Firm from '../../../models/Firm';
import Party from '../../../models/Party';
import Bill from '../../../models/Bill';
import Stock from '../../../models/Stock';
import StockReg from '../../../models/StockReg';
import GstinCache from '../../../models/GstinCache';
import { LedgerService } from '../../../utils/accounting/ledger.service';
import { StockService } from '../../../utils/inventory/stock.service';
import { resolveFirmLocation } from '../../../utils/accounting/bill-shared';
import { getNextBillNumber, getNextVoucherNumber } from '../../../utils/accounting/bill-utils';
import { resolveLedgerPostingAccount } from '../../../utils/accounting/ledger-account-resolver';
import { extractGstDetails, GST_STATE_CODE_MAP } from '../../../utils/accounting/gst-address-helper';
import { requireAuthSession } from '../../../utils/auth';
import { connectDB } from '../../../plugins/mongodb';

export default defineEventHandler(async (event) => {
  const user = await requireAuthSession(event);
  const body = await readBody(event) || {};
  const { vouchers, firmGstin, options = {} } = body;

  if (!Array.isArray(vouchers) || vouchers.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No vouchers provided for posting.' });
  }

  await connectDB();

  const firmIdObj = new mongoose.Types.ObjectId(String(user.firm_id));
  const username = user.username || user.email || 'system';

  // 1. Resolve Selected Firm Location & GSTIN Context
  const { firmLoc, firmStateCode } = await resolveFirmLocation(firmIdObj, firmGstin);
  const resolvedFirmGstin = firmLoc?.gst_number || firmGstin || '';
  const resolvedFirmState = firmLoc?.state || (firmStateCode ? (GST_STATE_CODE_MAP[firmStateCode] || '') : '');

  // 2. Pre-flight Chart of Accounts bootstrap
  try {
    await LedgerService.initializeChartOfAccounts(firmIdObj, user._id);
  } catch (coaInitErr: any) {
    console.warn('[DAYBOOK_POST] COA Init note:', coaInitErr.message);
  }

  const {
    voucherNumbering = 'EXCEL', // 'EXCEL' | 'AUTO_ERP'
    skipDuplicates = true
  } = options;

  const results: Array<{
    voucherNumber: string;
    status: 'POSTED' | 'SKIPPED' | 'FAILED';
    billId?: string;
    billNo: string;
    partyName: string;
    netTotal: number;
    message: string;
  }> = [];

  let postedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  // 3. Process Each Voucher with Transaction Isolation
  for (const v of vouchers) {
    const voucherNo = String(v.voucherNumber || '').trim();
    if (!voucherNo) {
      results.push({
        voucherNumber: 'UNKNOWN',
        status: 'FAILED',
        billNo: '',
        partyName: v.partyName || 'Unknown',
        netTotal: v.grandTotal || 0,
        message: 'Missing voucher number'
      });
      failedCount++;
      continue;
    }

    const executeVoucherPost = async (session?: mongoose.ClientSession) => {
      // Step A: Duplicate check in Bill collection
      const existingQuery: any = {
        firmId: firmIdObj,
        btype: 'SALES',
        status: { $ne: 'CANCELLED' }
      };

      if (voucherNumbering === 'EXCEL') {
        existingQuery.bno = voucherNo;
      } else {
        existingQuery.orderNo = voucherNo;
      }

      if (resolvedFirmGstin) {
        existingQuery.$or = [
          { firmGstin: resolvedFirmGstin },
          { firmGstin: { $exists: false } },
          { firmGstin: null },
          { firmGstin: '' }
        ];
      }

      const existingBill = await (Bill as any).findOne(existingQuery).session(session || null).lean();

      if (existingBill) {
        if (skipDuplicates) {
          return {
            status: 'SKIPPED' as const,
            billId: existingBill._id.toString(),
            billNo: existingBill.bno,
            message: `Bill already exists as #${existingBill.bno}`
          };
        }
      }

      // Step B: Party Resolution & Auto-Creation Engine
      const normGstin = String(v.gstin || '').trim().toUpperCase();
      const isUnregistered = !normGstin || normGstin === 'UNREGISTERED' || v.partyName.toLowerCase() === 'cash';
      let partyDoc: any = null;

      if (isUnregistered) {
        // Find or create standardized Cash Customer
        partyDoc = await (Party as any).findOne({
          firmId: firmIdObj,
          name: { $regex: /^Cash Customer$/i }
        }).session(session || null).lean();

        if (!partyDoc) {
          const cashPartyData = {
            firmId: firmIdObj,
            name: 'Cash Customer',
            gstin: 'UNREGISTERED',
            state: resolvedFirmState || 'West Bengal',
            stateCode: firmStateCode || '19',
            address: 'Counter Sales',
            partyType: 'CUSTOMER',
            openingBalance: 0,
            balanceType: 'DR',
            createdBy: username
          };
          const created = session
            ? (await (Party as any).create([cashPartyData], { session }))[0]
            : await (Party as any).create(cashPartyData);
          partyDoc = created.toObject ? created.toObject() : created;
        }
      } else {
        // Registered GST Party: Search by exact GSTIN or secondary locations
        partyDoc = await (Party as any).findOne({
          firmId: firmIdObj,
          $or: [
            { gstin: normGstin },
            { 'gstLocations.gstin': normGstin }
          ]
        }).session(session || null).lean();

        if (!partyDoc) {
          // Check PAN match for multi-state branch reuse
          const pan = normGstin.substring(2, 12);
          if (pan.length === 10) {
            partyDoc = await (Party as any).findOne({
              firmId: firmIdObj,
              pan
            }).session(session || null).lean();
          }
        }

        // Fetch / Retrieve cached GST details
        let cachedGst = await (GstinCache as any).findOne({ gstin: normGstin }).session(session || null).lean();
        const rawGstData = cachedGst?.rawData?.data || cachedGst?.rawData?.result || cachedGst?.rawData;
        const gstDetails = rawGstData ? extractGstDetails(rawGstData) : null;

        const targetStateCode = normGstin.substring(0, 2);
        const targetStateName = gstDetails?.state || GST_STATE_CODE_MAP[targetStateCode] || '';
        const targetAddress = gstDetails?.address || '';
        const targetPin = gstDetails?.pincode || '';
        const verifiedName = gstDetails?.tradeName || gstDetails?.legalName || v.partyName || `Customer ${normGstin}`;

        if (partyDoc) {
          // If existing party, append branch GSTIN if missing
          const hasBranch = partyDoc.gstin === normGstin ||
            (Array.isArray(partyDoc.gstLocations) && partyDoc.gstLocations.some((l: any) => l.gstin === normGstin));

          if (!hasBranch) {
            await (Party as any).updateOne(
              { _id: partyDoc._id },
              {
                $push: {
                  gstLocations: {
                    gstin: normGstin,
                    stateCode: targetStateCode,
                    state: targetStateName,
                    address: targetAddress,
                    pincode: targetPin,
                    isPrimary: false
                  }
                }
              },
              session ? { session } : {}
            );
          }
        } else {
          // Create brand new customer in Party Master
          const newPartyData = {
            firmId: firmIdObj,
            name: verifiedName,
            gstin: normGstin,
            state: targetStateName,
            stateCode: targetStateCode,
            address: targetAddress,
            pin: targetPin,
            pan: normGstin.substring(2, 12),
            gstLocations: [
              {
                gstin: normGstin,
                stateCode: targetStateCode,
                state: targetStateName,
                address: targetAddress,
                pincode: targetPin,
                isPrimary: true
              }
            ],
            primaryGstinIndex: 0,
            partyType: 'CUSTOMER',
            openingBalance: 0,
            balanceType: 'DR',
            createdBy: username
          };

          const createdParty = session
            ? (await (Party as any).create([newPartyData], { session }))[0]
            : await (Party as any).create(newPartyData);

          partyDoc = createdParty.toObject ? createdParty.toObject() : createdParty;

          // Provision Party account in Chart of Accounts
          await resolveLedgerPostingAccount({
            firmId: firmIdObj,
            accountHead: partyDoc.name,
            fallbackType: 'SUNDRY_DEBTORS',
            partyId: partyDoc._id,
            session
          });
        }
      }

      // Step C: Determine Bill Number & Sequence
      let assignedBillNo = voucherNo;
      if (voucherNumbering === 'AUTO_ERP') {
        assignedBillNo = await getNextBillNumber(firmIdObj, 'SALES');
      }
      const voucherId = await getNextVoucherNumber(firmIdObj);

      // Step D: Calculate Dynamic Supply Type relative to Selected Firm Branch
      const partyStateCode = isUnregistered
        ? (firmStateCode || '19')
        : (normGstin.substring(0, 2) || partyDoc.stateCode || firmStateCode || '19');

      const isIntraState = partyStateCode === firmStateCode;
      const billSubtype = isIntraState ? 'INTRA-STATE' : 'INTER-STATE';

      // Step E: Process Items, Taxes & Stock Deductions
      const processedItems: any[] = [];
      const cogsLines: Array<{ stockId: any; stockRegId: any; item: string; cogsValue: number }> = [];
      let totalTaxable = 0;
      let billCgst = 0;
      let billSgst = 0;
      let billIgst = 0;

      for (const rowItem of (v.items || [])) {
        const qty = Number(rowItem.billedQty || rowItem.actualQty || 0);
        const rate = Number(rowItem.rate || 0);
        const lineTaxable = Number((rowItem.amount || (qty * rate)).toFixed(2));
        const gstRate = Number(rowItem.gstRate || 0);
        const purchaseCost = Number(rowItem.purchaseRate || 0);

        totalTaxable += lineTaxable;

        let lineCgst = 0;
        let lineSgst = 0;
        let lineIgst = 0;

        if (gstRate > 0) {
          const lineTax = Number(((lineTaxable * gstRate) / 100).toFixed(2));
          if (isIntraState) {
            lineCgst = Number((lineTax / 2).toFixed(2));
            lineSgst = Number((lineTax / 2).toFixed(2));
          } else {
            lineIgst = lineTax;
          }
        }

        billCgst += lineCgst;
        billSgst += lineSgst;
        billIgst += lineIgst;

        // Stock Outward Deduction via StockService
        const stockResult = await StockService.updateStockOutward({
          firmId: firmIdObj,
          itemData: {
            item: rowItem.itemName || 'Item',
            qty,
            rate,
            grate: gstRate,
            batch: rowItem.batch || undefined,
            narration: rowItem.narration || undefined,
            hsn: rowItem.hsn || '9999',
            uom: rowItem.unit || 'PCS'
          },
          billData: {
            bno: assignedBillNo,
            bdate: v.date || new Date().toISOString().split('T')[0],
            supply: partyDoc.name,
            billId: new mongoose.Types.ObjectId(), // placeholder, updated upon bill create
            btype: 'SALE'
          },
          user: username,
          session
        });

        const stockId = stockResult.stock._id;
        const lineCogs = Number((qty * purchaseCost).toFixed(2)) || stockResult.cogsValue;

        // Find created StockReg entry for audit trace
        const regDoc = await (StockReg as any).findOne({
          firm_id: firmIdObj,
          bno: assignedBillNo,
          item: rowItem.itemName
        }).sort({ createdAt: -1 }).session(session || null);

        cogsLines.push({
          stockId,
          stockRegId: regDoc?._id,
          item: rowItem.itemName,
          cogsValue: lineCogs
        });

        processedItems.push({
          stockId,
          item: rowItem.itemName,
          hsn: rowItem.hsn || '9999',
          qty,
          uom: rowItem.unit || 'PCS',
          rate,
          grate: gstRate,
          disc: rowItem.discount || 0,
          total: lineTaxable,
          cgst: lineCgst,
          sgst: lineSgst,
          igst: lineIgst,
          batch: rowItem.batch || '',
          narration: rowItem.narration || ''
        });
      }

      totalTaxable = Number(totalTaxable.toFixed(2));
      billCgst = Number(billCgst.toFixed(2));
      billSgst = Number(billSgst.toFixed(2));
      billIgst = Number(billIgst.toFixed(2));

      const unroundedNet = Number((totalTaxable + billCgst + billSgst + billIgst).toFixed(2));
      const roundedNetTotal = Math.round(unroundedNet);
      const roundOff = Number((roundedNetTotal - unroundedNet).toFixed(2));

      // Step F: Insert Sales Bill Document
      const billData = {
        firmId: firmIdObj,
        voucherId: String(voucherId),
        bno: assignedBillNo,
        bdate: v.date || new Date().toISOString().split('T')[0],
        partyId: partyDoc._id,
        partyName: partyDoc.name,
        partyGstin: isUnregistered ? 'UNREGISTERED' : normGstin,
        partyAddress: partyDoc.address || '',
        partyState: partyDoc.state || '',
        partyStateCode: partyStateCode,
        partyPin: partyDoc.pin || '',
        firmGstin: resolvedFirmGstin,
        firmState: resolvedFirmState,
        firmStateCode: firmStateCode,
        grossTotal: totalTaxable,
        netTotal: roundedNetTotal,
        roundOff,
        cgst: billCgst,
        sgst: billSgst,
        igst: billIgst,
        btype: 'SALES',
        billSubtype,
        items: processedItems,
        otherCharges: [],
        orderNo: voucherNumbering === 'AUTO_ERP' ? voucherNo : undefined,
        narration: v.narration || `Imported DayBook Voucher #${voucherNo}`,
        reverseCharge: false,
        createdBy: username,
        status: 'ACTIVE',
        gstr1FilingStatus: v.gstr1Status === 'MATCHED' ? 'FILED' : 'UNFILED'
      };

      const newBill: any = session
        ? (await (Bill as any).create([billData], { session }))[0]
        : await (Bill as any).create(billData);

      // Update bill_id on StockReg documents
      await (StockReg as any).updateMany(
        { firm_id: firmIdObj, bno: assignedBillNo },
        { $set: { bill_id: newBill._id } },
        session ? { session } : {}
      );

      // Step G: Post Double-Entry Ledger
      const ledgerParams = {
        firmId: firmIdObj,
        billId: newBill._id,
        voucherId: String(voucherId),
        billNo: assignedBillNo,
        billDate: newBill.bdate,
        party: { _id: partyDoc._id, name: partyDoc.name },
        netTotal: roundedNetTotal,
        cgst: billCgst,
        sgst: billSgst,
        igst: billIgst,
        roundOff,
        otherCharges: [],
        taxableItemsTotal: totalTaxable,
        cogsLines,
        reverseCharge: false,
        createdBy: username,
        session
      };

      await LedgerService.postSalesLedger(ledgerParams as any);

      return {
        status: 'POSTED' as const,
        billId: newBill._id.toString(),
        billNo: assignedBillNo,
        message: `Successfully posted to Sales, Inventory & Accounts as #${assignedBillNo}`
      };
    };

    // Execute with ClientSession transaction
    let session: mongoose.ClientSession | null = null;
    try {
      session = await mongoose.connection.startSession();
      session.startTransaction();

      const outcome = await executeVoucherPost(session);
      await session.commitTransaction();

      results.push({
        voucherNumber: voucherNo,
        status: outcome.status,
        billId: outcome.billId,
        billNo: outcome.billNo,
        partyName: v.partyName,
        netTotal: v.grandTotal,
        message: outcome.message
      });

      if (outcome.status === 'POSTED') postedCount++;
      else if (outcome.status === 'SKIPPED') skippedCount++;
    } catch (err: any) {
      if (session) {
        try { await session.abortTransaction(); } catch (_) {}
      }

      // Handle standalone MongoDB retry without transaction session if transactions not supported
      if (
        err.message?.includes('ClientSession must be from the same MongoClient') ||
        err.message?.includes('replica set') ||
        err.message?.includes('Transaction numbers')
      ) {
        try {
          const outcome = await executeVoucherPost(undefined);
          results.push({
            voucherNumber: voucherNo,
            status: outcome.status,
            billId: outcome.billId,
            billNo: outcome.billNo,
            partyName: v.partyName,
            netTotal: v.grandTotal,
            message: outcome.message
          });
          if (outcome.status === 'POSTED') postedCount++;
          else if (outcome.status === 'SKIPPED') skippedCount++;
        } catch (retryErr: any) {
          results.push({
            voucherNumber: voucherNo,
            status: 'FAILED',
            billNo: voucherNo,
            partyName: v.partyName,
            netTotal: v.grandTotal,
            message: retryErr.message
          });
          failedCount++;
        }
      } else {
        results.push({
          voucherNumber: voucherNo,
          status: 'FAILED',
          billNo: voucherNo,
          partyName: v.partyName,
          netTotal: v.grandTotal,
          message: err.message
        });
        failedCount++;
      }
    } finally {
      if (session) {
        try { session.endSession(); } catch (_) {}
      }
    }
  }

  return {
    success: true,
    summary: {
      total: vouchers.length,
      posted: postedCount,
      skipped: skippedCount,
      failed: failedCount
    },
    results
  };
});
