import mongoose from 'mongoose';
import Bill from '../../models/Bill';

export async function fetchFullGSTR3BData(firmIdStr: string, firmGstin: string, startDate: string, endDate: string) {
  const firmIdObj = mongoose.Types.ObjectId.isValid(firmIdStr) ? new mongoose.Types.ObjectId(firmIdStr) : firmIdStr;

  const billFilter: any = {
    $or: [
      { firmId: firmIdObj },
      { firmId: firmIdStr },
      { firm_id: firmIdObj },
      { firm_id: firmIdStr }
    ],
    status: { $ne: 'CANCELLED' }
  };
  if (startDate && endDate) billFilter.bdate = { $gte: startDate, $lte: endDate };
  if (firmGstin) billFilter.firmGstin = firmGstin;

  const bills: any[] = await Bill.find(billFilter).lean();

  const t31 = {
    a: { taxable_value: 0, igst: 0, cgst: 0, sgst: 0, cess: 0 },
    b: { taxable_value: 0, igst: 0, cess: 0 },
    c: { taxable_value: 0 },
    d: { taxable_value: 0, igst: 0, cgst: 0, sgst: 0, cess: 0 },
    e: { taxable_value: 0 }
  };

  const t4 = {
    a: {
      1: { igst: 0, cess: 0 },
      2: { igst: 0, cess: 0 },
      3: { igst: 0, cgst: 0, sgst: 0, cess: 0 },
      4: { igst: 0, cgst: 0, sgst: 0, cess: 0 },
      5: { igst: 0, cgst: 0, sgst: 0, cess: 0 }
    },
    b: {
      1: { igst: 0, cgst: 0, sgst: 0, cess: 0 },
      2: { igst: 0, cgst: 0, sgst: 0, cess: 0 }
    }
  };

  const t5 = { inter: 0, intra: 0 };
  const firmStateCode = firmGstin ? firmGstin.substring(0, 2) : '';

  bills.forEach((bill: any) => {
    if (bill.btype === 'SALES') {
      const isExport = bill.billSubtype && ['EXPORT', 'EXPORT_WITH_PAYMENT', 'EXPORT_WITHOUT_PAYMENT'].includes(bill.billSubtype);
      if (isExport) {
        t31.b.taxable_value += bill.grossTotal || 0;
        t31.b.igst += bill.igst || 0;
      } else {
        t31.a.taxable_value += bill.grossTotal || 0;
        t31.a.cgst += bill.cgst || 0;
        t31.a.sgst += bill.sgst || 0;
        t31.a.igst += bill.igst || 0;
      }
    } else if (bill.btype === 'PURCHASE') {
      const isTaxed = (bill.cgst || 0) + (bill.sgst || 0) + (bill.igst || 0) > 0;
      if (isTaxed) {
        if (bill.reverseCharge) {
          t31.d.taxable_value += bill.grossTotal || 0;
          t31.d.cgst += bill.cgst || 0;
          t31.d.sgst += bill.sgst || 0;
          t31.d.igst += bill.igst || 0;
          t4.a[3].cgst += bill.cgst || 0;
          t4.a[3].sgst += bill.sgst || 0;
          t4.a[3].igst += bill.igst || 0;
        } else {
          t4.a[5].cgst += bill.cgst || 0;
          t4.a[5].sgst += bill.sgst || 0;
          t4.a[5].igst += bill.igst || 0;
        }
      } else {
        const isInter = bill.partyStateCode && bill.partyStateCode !== firmStateCode;
        if (isInter) t5.inter += bill.grossTotal || 0;
        else t5.intra += bill.grossTotal || 0;
      }
    }
  });

  return {
    period_start: startDate,
    period_end: endDate,
    firm_gstin: firmGstin,
    table_3_1: t31,
    table_4: t4,
    table_5: t5
  };
}

export async function getTable31(firmId: string, firmGstin: string, startDate: string, endDate: string) {
  const data = await fetchFullGSTR3BData(firmId, firmGstin, startDate, endDate);
  return data.table_3_1;
}

export async function getTable4(firmId: string, firmGstin: string, startDate: string, endDate: string) {
  const data = await fetchFullGSTR3BData(firmId, firmGstin, startDate, endDate);
  return data.table_4;
}

export async function getTable5(firmId: string, firmGstin: string, startDate: string, endDate: string) {
  const data = await fetchFullGSTR3BData(firmId, firmGstin, startDate, endDate);
  return data.table_5;
}

export async function getGSTR3BReport(firmId: string, firmGstin: string, startDate: string, endDate: string) {
  return await fetchFullGSTR3BData(firmId, firmGstin, startDate, endDate);
}
