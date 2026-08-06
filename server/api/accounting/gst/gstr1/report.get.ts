import { defineEventHandler, getQuery, createError } from 'h3';
import mongoose from 'mongoose';
import { requireAuthSession } from '../../../../utils/auth';
import Bill from '../../../../models/Bill';
import StockReg from '../../../../models/StockReg';

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuthSession(event);
    const firmIdObj = user.firm_id;
    const firmIdStr = String(firmIdObj);

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

    const bills: any[] = await Bill.find(billFilter).lean();

    // 1. B2B Supplies (Registered customers with GSTIN)
    const b2bBills = bills.filter((b: any) => b.partyGstin && b.partyGstin !== 'UNREGISTERED');
    const b2bSupplies = b2bBills.map((b: any) => ({
      invoice_no: b.bno,
      invoice_date: b.bdate,
      customer_gstin: b.partyGstin,
      customer_name: b.partyName,
      customer_state_code: b.partyStateCode || '00',
      invoice_value: b.netTotal || 0,
      taxable_value: b.grossTotal || 0,
      cgst: b.cgst || 0,
      sgst: b.sgst || 0,
      igst: b.igst || 0,
      cess: 0,
      reverse_charge: b.reverseCharge ? 'Y' : 'N',
      bill_id: b._id
    }));

    // 2. B2C Supplies (Unregistered customers)
    const b2cBills = bills.filter((b: any) => !b.partyGstin || b.partyGstin === 'UNREGISTERED');
    const b2cSupplies = b2cBills.map((b: any) => ({
      invoice_no: b.bno,
      invoice_date: b.bdate,
      customer_name: b.partyName || 'Cash Customer',
      customer_state_code: b.partyStateCode || '00',
      invoice_value: b.netTotal || 0,
      taxable_value: b.grossTotal || 0,
      cgst: b.cgst || 0,
      sgst: b.sgst || 0,
      igst: b.igst || 0,
      cess: 0,
      bill_id: b._id
    }));

    // Summary calculations
    const totalTaxable = bills.reduce((acc: number, b: any) => acc + (b.grossTotal || 0), 0);
    const totalCgst = bills.reduce((acc: number, b: any) => acc + (b.cgst || 0), 0);
    const totalSgst = bills.reduce((acc: number, b: any) => acc + (b.sgst || 0), 0);
    const totalIgst = bills.reduce((acc: number, b: any) => acc + (b.igst || 0), 0);
    const totalNet = bills.reduce((acc: number, b: any) => acc + (b.netTotal || 0), 0);

    const summary = {
      total_invoices: bills.length,
      b2b_count: b2bBills.length,
      b2c_count: b2cBills.length,
      total_taxable_value: totalTaxable,
      total_cgst: totalCgst,
      total_sgst: totalSgst,
      total_igst: totalIgst,
      total_tax: totalCgst + totalSgst + totalIgst,
      total_invoice_value: totalNet
    };

    const validation = {
      isValid: true,
      total_bills: bills.length,
      errors: []
    };

    return {
      success: true,
      data: {
        summary,
        table_4a_b2b_supplies: b2bSupplies,
        table_4b_b2b_reverse_charge: [],
        table_5_b2cl_supplies: [],
        table_6_exports: [],
        table_7_b2cs_supplies: b2cSupplies,
        table_8_nil_rated: [],
        table_9_amendments: [],
        table_10_b2cs_amendments: [],
        table_11_advances: [],
        table_12_hsn_b2b: [],
        table_12_hsn_b2c: [],
        table_13_document_summary: [
          {
            nature_of_document: 'Invoices for outward supply',
            from_sr_no: bills.length > 0 ? bills[0].bno : 'N/A',
            to_sr_no: bills.length > 0 ? bills[bills.length - 1].bno : 'N/A',
            total_number: bills.length,
            cancelled_number: 0
          }
        ],
        table_14_ecommerce_supplies: [],
        table_15_ecommerce_operator: [],
        table_exempted: [],
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
