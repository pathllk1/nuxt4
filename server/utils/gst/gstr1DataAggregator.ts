import mongoose from 'mongoose';
import Bill from '../../models/Bill';
import StockReg from '../../models/StockReg';

export async function getB2BSupplies(firmId: string, firmGstin: string, startDate: string, endDate: string) {
  const query: any = {
    $or: [{ firmId: new mongoose.Types.ObjectId(firmId) }, { firm_id: firmId }],
    btype: 'SALES',
    status: { $ne: 'CANCELLED' },
    partyGstin: { $ne: 'UNREGISTERED', $exists: true }
  };
  if (startDate && endDate) query.bdate = { $gte: startDate, $lte: endDate };
  if (firmGstin) query.firmGstin = firmGstin;

  const bills = await Bill.find(query).lean();

  return bills.map((bill: any) => ({
    invoice_no: bill.bno,
    invoice_date: bill.bdate,
    customer_gstin: bill.partyGstin,
    customer_name: bill.partyName,
    customer_state_code: bill.partyStateCode || '00',
    invoice_value: bill.netTotal || 0,
    taxable_value: bill.grossTotal || 0,
    cgst: bill.cgst || 0,
    sgst: bill.sgst || 0,
    igst: bill.igst || 0,
    cess: 0,
    reverse_charge: bill.reverseCharge ? 'Y' : 'N',
    bill_id: bill._id,
  }));
}

export async function getB2CSupplies(firmId: string, firmGstin: string, startDate: string, endDate: string) {
  const query: any = {
    $or: [{ firmId: new mongoose.Types.ObjectId(firmId) }, { firm_id: firmId }],
    btype: 'SALES',
    status: { $ne: 'CANCELLED' },
    $or2: [
      { partyGstin: 'UNREGISTERED' },
      { partyGstin: { $exists: false } },
      { partyGstin: null },
    ],
  };
  delete query.$or2;
  query.$or = [
    { partyGstin: 'UNREGISTERED' },
    { partyGstin: { $exists: false } },
    { partyGstin: null },
  ];
  if (startDate && endDate) query.bdate = { $gte: startDate, $lte: endDate };
  if (firmGstin) query.firmGstin = firmGstin;

  const bills = await Bill.find(query).lean();

  return bills.map((bill: any) => ({
    invoice_no: bill.bno,
    invoice_date: bill.bdate,
    customer_name: bill.partyName || 'Cash Customer',
    customer_state_code: bill.partyStateCode || '00',
    invoice_value: bill.netTotal || 0,
    taxable_value: bill.grossTotal || 0,
    cgst: bill.cgst || 0,
    sgst: bill.sgst || 0,
    igst: bill.igst || 0,
    cess: 0,
    bill_id: bill._id,
  }));
}

export async function getCreditDebitNotes(firmId: string, firmGstin: string, startDate: string, endDate: string) {
  const query: any = {
    $or: [{ firmId: new mongoose.Types.ObjectId(firmId) }, { firm_id: firmId }],
    btype: { $in: ['CREDIT_NOTE', 'DEBIT_NOTE'] },
    status: { $ne: 'CANCELLED' }
  };
  if (startDate && endDate) query.bdate = { $gte: startDate, $lte: endDate };
  if (firmGstin) query.firmGstin = firmGstin;

  const notes = await Bill.find(query).lean();

  return notes.map((note: any) => ({
    note_type: note.btype === 'CREDIT_NOTE' ? 'C' : 'D',
    note_no: note.bno,
    note_date: note.bdate,
    original_invoice_no: note.supplierBillNo || 'N/A',
    original_invoice_date: note.bdate,
    customer_gstin: note.partyGstin || 'UNREGISTERED',
    customer_name: note.partyName,
    note_value: note.netTotal || 0,
    taxable_value: note.grossTotal || 0,
    cgst: note.cgst || 0,
    sgst: note.sgst || 0,
    igst: note.igst || 0,
    reason: note.narration || 'Adjustment',
  }));
}

export async function fetchFullGSTR1Data(firmIdStr: string, firmGstin: string, startDate: string, endDate: string) {
  const b2bSupplies = await getB2BSupplies(firmIdStr, firmGstin, startDate, endDate);
  const b2cSupplies = await getB2CSupplies(firmIdStr, firmGstin, startDate, endDate);
  const cdnSupplies = await getCreditDebitNotes(firmIdStr, firmGstin, startDate, endDate);

  const firmIdObj = mongoose.Types.ObjectId.isValid(firmIdStr) ? new mongoose.Types.ObjectId(firmIdStr) : firmIdStr;
  const billFilter: any = {
    $or: [
      { firmId: firmIdObj },
      { firmId: firmIdStr },
      { firm_id: firmIdObj },
      { firm_id: firmIdStr }
    ],
    btype: 'SALES',
    status: { $ne: 'CANCELLED' }
  };
  if (startDate && endDate) billFilter.bdate = { $gte: startDate, $lte: endDate };
  if (firmGstin) billFilter.firmGstin = firmGstin;

  const bills: any[] = await Bill.find(billFilter).lean();
  const billIds = bills.map((b: any) => b._id);
  const stockRegs: any[] = billIds.length > 0 ? await StockReg.find({ billId: { $in: billIds } }).lean() : [];

  const hsnMap = new Map<string, any>();
  stockRegs.forEach((sr: any) => {
    const hsn = sr.hsn || '9999';
    if (!hsnMap.has(hsn)) {
      hsnMap.set(hsn, {
        hsn,
        description: sr.item || 'Item',
        uqc: sr.uom || 'PCS',
        total_quantity: 0,
        total_value: 0,
        taxable_value: 0,
        integrated_tax: 0,
        central_tax: 0,
        state_ut_tax: 0,
        cess: 0
      });
    }
    const rec = hsnMap.get(hsn);
    rec.total_quantity += Math.abs(parseFloat(sr.qty)) || 0;
    rec.total_value += parseFloat(sr.total) || 0;
    rec.taxable_value += parseFloat(sr.total) || 0;
    rec.integrated_tax += parseFloat(sr.igst) || 0;
    rec.central_tax += parseFloat(sr.cgst) || 0;
    rec.state_ut_tax += parseFloat(sr.sgst) || 0;
  });

  const hsnB2B = Array.from(hsnMap.values());

  const totalTaxable = bills.reduce((acc: number, b: any) => acc + (b.grossTotal || 0), 0);
  const totalCgst = bills.reduce((acc: number, b: any) => acc + (b.cgst || 0), 0);
  const totalSgst = bills.reduce((acc: number, b: any) => acc + (b.sgst || 0), 0);
  const totalIgst = bills.reduce((acc: number, b: any) => acc + (b.igst || 0), 0);
  const totalNet = bills.reduce((acc: number, b: any) => acc + (b.netTotal || 0), 0);

  const summary = {
    period_start: startDate,
    period_end: endDate,
    firm_gstin: firmGstin,
    total_invoices: bills.length,
    b2b_invoices: b2bSupplies.length,
    b2c_invoices: b2cSupplies.length,
    b2b_count: b2bSupplies.length,
    b2c_count: b2cSupplies.length,
    total_taxable_value: totalTaxable,
    total_cgst: totalCgst,
    total_sgst: totalSgst,
    total_igst: totalIgst,
    total_tax: totalCgst + totalSgst + totalIgst,
    total_gst: totalCgst + totalSgst + totalIgst,
    total_invoice_value: totalNet
  };

  const tables = {
    table_4a_b2b_supplies: b2bSupplies,
    table_4b_b2b_reverse_charge: [],
    table_5_b2cl_supplies: [],
    table_6_exports: [],
    table_7_b2cs_supplies: b2cSupplies,
    table_8_nil_rated: [],
    table_9_amendments: [],
    table_10_b2cs_amendments: [],
    table_11_advances: [],
    table_12_hsn_b2b: hsnB2B,
    table_12_hsn_b2c: [],
    table_13_document_summary: [
      {
        nature_of_document: 'Invoices for outward supply',
        sr_no_from: bills.length > 0 ? bills[0].bno : 'N/A',
        sr_no_to: bills.length > 0 ? bills[bills.length - 1].bno : 'N/A',
        total_number: bills.length,
        cancelled: 0
      }
    ],
    table_14_ecommerce_supplies: [],
    table_15_ecommerce_operator: [],
    table_exempted: [],
    validation: {
      valid: true,
      total_bills: bills.length,
      total_items: stockRegs.length,
      errors: [],
      warnings: []
    }
  };

  return { summary, tables };
}
