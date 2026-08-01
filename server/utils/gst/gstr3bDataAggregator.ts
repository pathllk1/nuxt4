import mongoose from 'mongoose';
import Bill from '../../models/Bill';

export async function getTable31(firmId: string, firmGstin: string, startDate: string, endDate: string) {
  const query: any = {
    firmId: new mongoose.Types.ObjectId(firmId),
    status: 'ACTIVE',
    bdate: { $gte: startDate, $lte: endDate },
  };
  if (firmGstin) query.firmGstin = firmGstin;

  const bills = await Bill.find(query).lean();

  const outwardTaxableTypes = ['SALES'];

  const stats = {
    a: { taxable_value: 0, igst: 0, cgst: 0, sgst: 0, cess: 0 },
    b: { taxable_value: 0, igst: 0, cgst: 0, sgst: 0, cess: 0 },
    c: { taxable_value: 0, igst: 0, cgst: 0, sgst: 0, cess: 0 },
    d: { taxable_value: 0, igst: 0, cgst: 0, sgst: 0, cess: 0 },
    e: { taxable_value: 0, igst: 0, cgst: 0, sgst: 0, cess: 0 },
  };

  bills.forEach((bill: any) => {
    const isExempt = (bill.cgst + bill.sgst + bill.igst === 0) && (bill.supply_type === 'exempted' || bill.supply_type === 'nil_rated');
    const isNonGst = bill.supply_type === 'non_gst';
    const isExport = bill.billSubtype && ['EXPORT', 'EXPORT_WITH_PAYMENT', 'EXPORT_WITHOUT_PAYMENT', 'SEZ_WITH_PAYMENT', 'SEZ_WITHOUT_PAYMENT', 'DEEMED_EXPORT'].includes(bill.billSubtype);

    if (outwardTaxableTypes.includes(bill.btype)) {
      if (isExport) {
        stats.b.taxable_value += bill.grossTotal || 0;
        stats.b.igst += bill.igst || 0;
      } else if (isExempt) {
        stats.c.taxable_value += bill.grossTotal || 0;
      } else if (isNonGst) {
        stats.e.taxable_value += bill.grossTotal || 0;
      } else {
        stats.a.taxable_value += bill.grossTotal || 0;
        stats.a.cgst += bill.cgst || 0;
        stats.a.sgst += bill.sgst || 0;
        stats.a.igst += bill.igst || 0;
      }
    } else if (bill.btype === 'PURCHASE' && bill.reverseCharge === true) {
      stats.d.taxable_value += bill.grossTotal || 0;
      stats.d.cgst += bill.cgst || 0;
      stats.d.sgst += bill.sgst || 0;
      stats.d.igst += bill.igst || 0;
    }
  });

  return stats;
}

export async function getTable4(firmId: string, firmGstin: string, startDate: string, endDate: string) {
  const query: any = {
    firmId: new mongoose.Types.ObjectId(firmId),
    btype: 'PURCHASE',
    status: 'ACTIVE',
    bdate: { $gte: startDate, $lte: endDate },
  };
  if (firmGstin) query.firmGstin = firmGstin;

  const purchases = await Bill.find(query).lean();

  const itc = {
    a: {
      1: { igst: 0, cgst: 0, sgst: 0, cess: 0 },
      2: { igst: 0, cgst: 0, sgst: 0, cess: 0 },
      3: { igst: 0, cgst: 0, sgst: 0, cess: 0 },
      4: { igst: 0, cgst: 0, sgst: 0, cess: 0 },
      5: { igst: 0, cgst: 0, sgst: 0, cess: 0 },
    },
    b: {
      1: { igst: 0, cgst: 0, sgst: 0, cess: 0 },
      2: { igst: 0, cgst: 0, sgst: 0, cess: 0 },
    }
  };

  purchases.forEach((p: any) => {
    if ((p.cgst || 0) + (p.sgst || 0) + (p.igst || 0) === 0) return;

    if (p.billSubtype === 'IMPORT') {
      itc.a[1].igst += p.igst || 0;
    } else if (p.reverseCharge === true) {
      itc.a[3].igst += p.igst || 0;
      itc.a[3].cgst += p.cgst || 0;
      itc.a[3].sgst += p.sgst || 0;
    } else {
      itc.a[5].igst += p.igst || 0;
      itc.a[5].cgst += p.cgst || 0;
      itc.a[5].sgst += p.sgst || 0;
    }
  });

  const dnQuery: any = {
    firmId: new mongoose.Types.ObjectId(firmId),
    btype: 'DEBIT_NOTE',
    status: 'ACTIVE',
    bdate: { $gte: startDate, $lte: endDate },
  };
  if (firmGstin) dnQuery.firmGstin = firmGstin;

  const debitNotes = await Bill.find(dnQuery).lean();

  debitNotes.forEach((dn: any) => {
    itc.b[2].igst += dn.igst || 0;
    itc.b[2].cgst += dn.cgst || 0;
    itc.b[2].sgst += dn.sgst || 0;
  });

  return itc;
}
