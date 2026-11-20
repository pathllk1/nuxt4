import { defineEventHandler, getQuery, createError } from 'h3';
import mongoose from 'mongoose';
import { requireAuthSession } from '../../../../utils/auth';
import Bill from '../../../../models/Bill';
import Ledger from '../../../../models/Ledger';

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuthSession(event);
    const firmIdObj = new mongoose.Types.ObjectId(String(user.firm_id));
    const firmIdStr = String(user.firm_id);

    const query = getQuery(event);
    const startDate = query.startDate ? String(query.startDate) : '';
    const endDate = query.endDate ? String(query.endDate) : '';
    const firmGstin = query.firmGstin ? String(query.firmGstin) : '';

    if (!startDate || !endDate) {
      throw createError({ statusCode: 400, statusMessage: 'startDate and endDate are required' });
    }

    const billFilter: any = {
      $or: [
        { firmId: firmIdObj },
        { firmId: firmIdStr },
        { firm_id: firmIdObj },
        { firm_id: firmIdStr }
      ],
      btype: 'SALES',
      status: { $ne: 'CANCELLED' },
      bdate: { $gte: startDate, $lte: endDate }
    };

    if (firmGstin) {
      billFilter.firmGstin = firmGstin;
    }

    const [bills, cancelledBills] = await Promise.all([
      Bill.find(billFilter).sort({ bdate: 1, bno: 1 }).lean(),
      Bill.find({
        $or: [
          { firmId: firmIdObj },
          { firmId: firmIdStr },
          { firm_id: firmIdObj },
          { firm_id: firmIdStr }
        ],
        btype: 'SALES',
        status: 'CANCELLED',
        bdate: { $gte: startDate, $lte: endDate }
      }).lean()
    ]);

    // 1. Registered Customers (B2B)
    const b2bBills = bills.filter((b: any) => b.partyGstin && b.partyGstin !== 'UNREGISTERED' && b.partyGstin.trim().length >= 15);
    const regularB2bBills = b2bBills.filter((b: any) => !b.reverseCharge);
    const rcmB2bBills = b2bBills.filter((b: any) => Boolean(b.reverseCharge));

    const mapSupplyRow = (b: any) => ({
      invoice_no: b.bno,
      invoice_date: b.bdate,
      customer_gstin: b.partyGstin,
      customer_name: b.partyName || 'Registered Customer',
      customer_state_code: b.partyStateCode || (b.partyGstin ? b.partyGstin.slice(0, 2) : '00'),
      invoice_value: Number((b.netTotal || 0).toFixed(2)),
      taxable_value: Number((b.grossTotal || 0).toFixed(2)),
      cgst: Number((b.cgst || 0).toFixed(2)),
      sgst: Number((b.sgst || 0).toFixed(2)),
      igst: Number((b.igst || 0).toFixed(2)),
      cess: 0,
      reverse_charge: b.reverseCharge ? 'Y' : 'N',
      bill_id: b._id
    });

    const b2bSupplies = regularB2bBills.map(mapSupplyRow);
    const b2bReverseChargeSupplies = rcmB2bBills.map(mapSupplyRow);

    // 2. Unregistered Customers (B2C)
    const b2cBills = bills.filter((b: any) => !b.partyGstin || b.partyGstin === 'UNREGISTERED' || b.partyGstin.trim().length < 15);

    // Table 5: B2CL (Inter-state unregistered supplies with invoice value > ₹2,50,000)
    const isInterState = (b: any) => String(b.billSubtype || '').toLowerCase().includes('inter') || (b.igst || 0) > 0;
    const b2clBills = b2cBills.filter((b: any) => isInterState(b) && (b.netTotal || 0) > 250000);
    const b2clSupplies = b2clBills.map((b: any) => ({
      invoice_no: b.bno,
      invoice_date: b.bdate,
      customer_name: b.partyName || 'Cash Customer',
      customer_state_code: b.partyStateCode || '00',
      invoice_value: Number((b.netTotal || 0).toFixed(2)),
      taxable_value: Number((b.grossTotal || 0).toFixed(2)),
      cgst: 0,
      sgst: 0,
      igst: Number((b.igst || 0).toFixed(2)),
      cess: 0,
      bill_id: b._id
    }));

    // Table 7: B2CS (Intra-state unregistered supplies + inter-state <= ₹2,50,000)
    const b2csBills = b2cBills.filter((b: any) => !(isInterState(b) && (b.netTotal || 0) > 250000));
    const b2cSupplies = b2csBills.map((b: any) => ({
      invoice_no: b.bno,
      invoice_date: b.bdate,
      customer_name: b.partyName || 'Cash Customer',
      customer_state_code: b.partyStateCode || '00',
      invoice_value: Number((b.netTotal || 0).toFixed(2)),
      taxable_value: Number((b.grossTotal || 0).toFixed(2)),
      cgst: Number((b.cgst || 0).toFixed(2)),
      sgst: Number((b.sgst || 0).toFixed(2)),
      igst: Number((b.igst || 0).toFixed(2)),
      cess: 0,
      bill_id: b._id
    }));

    // Table 12: HSN Summary Aggregation
    const aggregateHsn = (sourceBills: any[]) => {
      const hsnMap = new Map<string, {
        hsn_sc: string;
        description: string;
        uom: string;
        total_qty: number;
        total_value: number;
        taxable_value: number;
        cgst: number;
        sgst: number;
        igst: number;
        cess: number;
      }>();

      for (const bill of sourceBills) {
        const isIntra = !isInterState(bill);
        if (Array.isArray(bill.items)) {
          for (const item of bill.items) {
            const hsnCode = item.hsn || item.sacCode || '9999';
            const qty = parseFloat(item.qty) || 1;
            const rate = parseFloat(item.rate || item.amount) || 0;
            const disc = parseFloat(item.disc) || 0;
            const taxable = Number((qty * rate * (1 - disc / 100)).toFixed(2));
            const taxRate = parseFloat(item.grate || item.gstRate) || 0;
            const totalTax = Number(((taxable * taxRate) / 100).toFixed(2));
            const cgst = isIntra ? Number((totalTax / 2).toFixed(2)) : 0;
            const sgst = isIntra ? Number((totalTax - cgst).toFixed(2)) : 0;
            const igst = !isIntra ? totalTax : 0;

            const existing = hsnMap.get(hsnCode) || {
              hsn_sc: hsnCode,
              description: item.item || item.description || 'Goods / Services',
              uom: item.uom || 'PCS',
              total_qty: 0,
              total_value: 0,
              taxable_value: 0,
              cgst: 0,
              sgst: 0,
              igst: 0,
              cess: 0
            };

            existing.total_qty += qty;
            existing.taxable_value = Number((existing.taxable_value + taxable).toFixed(2));
            existing.cgst = Number((existing.cgst + cgst).toFixed(2));
            existing.sgst = Number((existing.sgst + sgst).toFixed(2));
            existing.igst = Number((existing.igst + igst).toFixed(2));
            existing.total_value = Number((existing.total_value + taxable + cgst + sgst + igst).toFixed(2));
            hsnMap.set(hsnCode, existing);
          }
        }
      }

      return Array.from(hsnMap.values());
    };

    const table12HsnB2b = aggregateHsn(b2bBills);
    const table12HsnB2c = aggregateHsn(b2cBills);

    // Summary calculations
    const totalTaxable = Number(bills.reduce((acc: number, b: any) => acc + (b.grossTotal || 0), 0).toFixed(2));
    const totalCgst = Number(bills.reduce((acc: number, b: any) => acc + (b.cgst || 0), 0).toFixed(2));
    const totalSgst = Number(bills.reduce((acc: number, b: any) => acc + (b.sgst || 0), 0).toFixed(2));
    const totalIgst = Number(bills.reduce((acc: number, b: any) => acc + (b.igst || 0), 0).toFixed(2));
    const totalNet = Number(bills.reduce((acc: number, b: any) => acc + (b.netTotal || 0), 0).toFixed(2));

    const summary = {
      total_invoices: bills.length,
      b2b_count: regularB2bBills.length,
      b2b_rcm_count: rcmB2bBills.length,
      b2cl_count: b2clBills.length,
      b2cs_count: b2csBills.length,
      total_taxable_value: totalTaxable,
      total_cgst: totalCgst,
      total_sgst: totalSgst,
      total_igst: totalIgst,
      total_tax: Number((totalCgst + totalSgst + totalIgst).toFixed(2)),
      total_invoice_value: totalNet
    };

    // Table 13 Document Summary
    const totalBillsCount = bills.length + cancelledBills.length;
    const documentSummary = [
      {
        nature_of_document: 'Invoices for outward supply',
        from_sr_no: bills.length > 0 ? bills[0].bno : (cancelledBills.length > 0 ? cancelledBills[0].bno : 'N/A'),
        to_sr_no: bills.length > 0 ? bills[bills.length - 1].bno : (cancelledBills.length > 0 ? cancelledBills[cancelledBills.length - 1].bno : 'N/A'),
        total_number: totalBillsCount,
        cancelled_number: cancelledBills.length,
        net_issued_number: bills.length
      }
    ];

    // GL Tax Accounts Reconciliation
    const glOutputLegs = await Ledger.find({
      $or: [
        { firmId: firmIdObj },
        { firmId: firmIdStr },
        { firm_id: firmIdObj },
        { firm_id: firmIdStr }
      ],
      isReversed: { $ne: true },
      transactionDate: { $gte: startDate, $lte: endDate },
      accountHead: { $in: ['CGST Payable', 'SGST Payable', 'IGST Payable', 'OUTPUT CGST', 'OUTPUT SGST', 'OUTPUT IGST'] }
    }).lean();

    let glCgst = 0;
    let glSgst = 0;
    let glIgst = 0;
    for (const leg of glOutputLegs) {
      const netTaxCredit = (leg.creditAmount || 0) - (leg.debitAmount || 0);
      const head = String(leg.accountHead).toUpperCase();
      if (head.includes('CGST')) glCgst += netTaxCredit;
      else if (head.includes('SGST')) glSgst += netTaxCredit;
      else if (head.includes('IGST')) glIgst += netTaxCredit;
    }

    glCgst = Number(glCgst.toFixed(2));
    glSgst = Number(glSgst.toFixed(2));
    glIgst = Number(glIgst.toFixed(2));
    const glTotalTax = Number((glCgst + glSgst + glIgst).toFixed(2));
    const taxVariance = Number(Math.abs(glTotalTax - summary.total_tax).toFixed(2));

    const glReconciliation = {
      gl_cgst: glCgst,
      gl_sgst: glSgst,
      gl_igst: glIgst,
      gl_total_tax: glTotalTax,
      bill_total_tax: summary.total_tax,
      variance: taxVariance,
      isReconciled: taxVariance < 1.00
    };

    const errors: string[] = [];
    if (!glReconciliation.isReconciled && bills.length > 0) {
      errors.push(`General Ledger tax liability (₹${glTotalTax}) does not match outward sales tax (₹${summary.total_tax}) within ₹1.00 tolerance (Variance: ₹${taxVariance}).`);
    }

    const validation = {
      isValid: errors.length === 0,
      total_bills: bills.length,
      cancelled_bills: cancelledBills.length,
      errors
    };

    return {
      success: true,
      data: {
        summary,
        table_4a_b2b_supplies: b2bSupplies,
        table_4b_b2b_reverse_charge: b2bReverseChargeSupplies,
        table_5_b2cl_supplies: b2clSupplies,
        table_6_exports: [],
        table_7_b2cs_supplies: b2cSupplies,
        table_8_nil_rated: [],
        table_9_amendments: [],
        table_10_b2cs_amendments: [],
        table_11_advances: [],
        table_12_hsn_b2b: table12HsnB2b,
        table_12_hsn_b2c: table12HsnB2c,
        table_13_document_summary: documentSummary,
        table_14_ecommerce_supplies: [],
        table_15_ecommerce_operator: [],
        table_exempted: [],
        gl_reconciliation: glReconciliation,
        validation
      }
    };
  } catch (error: any) {
    console.error('GSTR1 report error:', error);
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Error generating GSTR-1 report'
    });
  }
});
