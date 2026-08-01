import mongoose from 'mongoose';
import Bill from '../../models/Bill';
import Party from '../../models/Party';

export async function getB2BSupplies(firmId: string, firmGstin: string, startDate: string, endDate: string) {
  const query: any = {
    firmId: new mongoose.Types.ObjectId(firmId),
    btype: 'SALES',
    status: 'ACTIVE',
    bdate: { $gte: startDate, $lte: endDate },
    partyGstin: { $ne: 'UNREGISTERED', $exists: true }
  };
  if (firmGstin) query.firmGstin = firmGstin;

  const bills = await Bill.find(query).populate('partyId', 'gstin stateCode').lean();

  return bills.map((bill: any) => ({
    invoice_no: bill.bno,
    invoice_date: bill.bdate,
    customer_gstin: bill.partyGstin,
    customer_state_code: bill.partyStateCode,
    invoice_value: bill.netTotal,
    taxable_value: bill.grossTotal,
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
    firmId: new mongoose.Types.ObjectId(firmId),
    btype: 'SALES',
    status: 'ACTIVE',
    bdate: { $gte: startDate, $lte: endDate },
    $or: [
      { partyGstin: 'UNREGISTERED' },
      { partyGstin: { $exists: false } },
      { partyGstin: null },
    ],
  };
  if (firmGstin) query.firmGstin = firmGstin;

  const bills = await Bill.find(query).lean();

  const aggregated: Record<string, any> = {};

  bills.forEach((bill: any) => {
    const stateCode = bill.partyStateCode || '00';
    const items = bill.items || [];

    items.forEach((sr: any) => {
      const hsn = sr.hsn || '00000000';
      const key = `${stateCode}_${hsn}`;

      if (!aggregated[key]) {
        aggregated[key] = {
          state_code: stateCode,
          hsn: hsn,
          qty: 0,
          uom: sr.uom || 'PCS',
          taxable_value: 0,
          cgst: 0,
          sgst: 0,
          igst: 0,
          cess: 0,
        };
      }

      const itemQty = Math.abs(parseFloat(sr.qty)) || 0;
      const itemTotal = parseFloat(sr.total) || 0;

      aggregated[key].qty += itemQty;
      aggregated[key].taxable_value += itemTotal;

      const billTaxableValue = bill.grossTotal || 1;
      const itemProportion = itemTotal / billTaxableValue;
      aggregated[key].cgst += (bill.cgst || 0) * itemProportion;
      aggregated[key].sgst += (bill.sgst || 0) * itemProportion;
      aggregated[key].igst += (bill.igst || 0) * itemProportion;
    });
  });

  return Object.values(aggregated);
}

export async function getCreditDebitNotes(firmId: string, firmGstin: string, startDate: string, endDate: string) {
  const query: any = {
    firmId: new mongoose.Types.ObjectId(firmId),
    btype: { $in: ['CREDIT_NOTE', 'DEBIT_NOTE'] },
    status: 'ACTIVE',
    bdate: { $gte: startDate, $lte: endDate },
  };
  if (firmGstin) query.firmGstin = firmGstin;

  const notes = await Bill.find(query).populate('refBillId', 'bno bdate').lean();

  return notes.map((note: any) => ({
    note_type: note.btype === 'CREDIT_NOTE' ? 'C' : 'D',
    note_no: note.bno,
    note_date: note.bdate,
    original_invoice_no: note.refBillId?.bno || note.supplierBillNo || 'N/A',
    original_invoice_date: note.refBillId?.bdate || note.bdate,
    customer_gstin: note.partyGstin || 'UNREGISTERED',
    customer_name: note.partyName,
    note_value: note.netTotal,
    taxable_value: note.grossTotal,
    cgst: note.cgst || 0,
    sgst: note.sgst || 0,
    igst: note.igst || 0,
    reason: note.narration || 'Sales Return/Adjustment',
  }));
}
