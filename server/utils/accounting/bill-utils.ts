import mongoose from 'mongoose';
import BillSequence from '../../models/BillSequence';
import VoucherSequence from '../../models/VoucherSequence';

export const getActorUsername = (request: any) => request?.user?.username ?? 'system';

export function getCurrentFinancialYear() {
  const d = new Date();
  const month = d.getMonth() + 1;
  const year = d.getFullYear();
  return month >= 4
    ? `${year}-${String(year + 1).slice(-2)}`
    : `${year - 1}-${String(year).slice(-2)}`;
}

export function normalizeOptionalText(value: any, maxLen = 120) {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim().replace(/\s+/g, ' ');
  if (!normalized) return null;
  return normalized.slice(0, maxLen);
}

export function normalizeOptionalMultilineText(value: any, maxLen = 2000) {
  if (value === undefined || value === null) return null;
  const normalized = String(value)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map(line => line.trim())
    .join('\n')
    .trim();
  if (!normalized) return null;
  return normalized.slice(0, maxLen);
}

export function isServiceItem(item: any) {
  return String(item?.itemType || item?.item_type || 'GOODS').toUpperCase() === 'SERVICE';
}

export function getEffectiveItemQty(item: any) {
  const qty = parseFloat(item?.qty);
  if (Number.isFinite(qty) && qty > 0) return qty;
  return 0;
}

export const BILL_PREFIX: any = {
  SALES: 'SI', PURCHASE: 'PI', CREDIT_NOTE: 'CN', DEBIT_NOTE: 'DN',
  PROFORMA: 'PFI', DELIVERY_NOTE: 'DC',
  PAYMENT: 'PV', RECEIPT: 'RV', JOURNAL: 'JV', CONTRA: 'CV',
  ACCOUNTING_SALES: 'ASI', ACCOUNTING_PURCHASE: 'API'
};

export async function getNextBillNumber(firmId: mongoose.Types.ObjectId, type: string = 'SALES') {
  const fy = getCurrentFinancialYear();
  const prefix = BILL_PREFIX[type.toUpperCase()] || type.slice(0, 3).toUpperCase();
  const seq = await BillSequence.findOneAndUpdate(
    { firmId, btype: type.toUpperCase() } as any,
    { $inc: { lastNo: 1 } },
    { returnDocument: 'after', upsert: true }
  );
  return `${prefix}/${fy}/${String((seq as any)?.lastNo || 1).padStart(4, '0')}`;
}

export async function previewNextBillNumber(firmId: mongoose.Types.ObjectId, type: string = 'SALES') {
  const fy = getCurrentFinancialYear();
  const prefix = BILL_PREFIX[type.toUpperCase()] || type.slice(0, 3).toUpperCase();
  const seq = await BillSequence.findOne({ firmId, btype: type.toUpperCase() } as any).lean();
  const nextNum = ((seq as any)?.lastNo ?? 0) + 1;
  return `${prefix}/${fy}/${String(nextNum).padStart(4, '0')}`;
}

export async function getNextVoucherNumber(firmId: mongoose.Types.ObjectId) {
  const seq = await VoucherSequence.findOneAndUpdate(
    { firmId, vtype: 'JOURNAL' } as any,
    { $inc: { lastNo: 1 } },
    { returnDocument: 'after', new: true, upsert: true }
  );
  return (seq as any)?.lastNo || 1;
}

export async function ensureUniqueSupplierBillNo(params: {
  firmId: mongoose.Types.ObjectId,
  partyId: mongoose.Types.ObjectId,
  supplierBillNo: string,
  excludeBillId?: mongoose.Types.ObjectId
}) {
  const { firmId, partyId, supplierBillNo, excludeBillId } = params;
  if (!supplierBillNo) return;

  const query: any = {
    firmId,
    partyId,
    btype: 'PURCHASE',
    status: { $ne: 'CANCELLED' },
    supplierBillNo: { $regex: `^${supplierBillNo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
  };
  if (excludeBillId) query._id = { $ne: excludeBillId };

  const duplicate = await mongoose.model('Bill').findOne(query).select('_id bno supplierBillNo').lean();
  if (duplicate) {
    throw new Error(
      `Supplier bill number "${supplierBillNo}" already exists for this supplier under purchase ${(duplicate as any).bno}`
    );
  }
}

export function calcBillTotals(
  cart: any[], 
  otherCharges: any[], 
  gstEnabled: boolean, 
  billType: string, 
  reverseCharge: boolean,
  qtyFn?: (item: any) => number
) {
  const getQty = qtyFn || ((item: any) => parseFloat(item.qty));

  let itemsGrossTotal = 0;
  let itemsTaxTotal = 0;

  cart.forEach(item => {
    const qty = getQty(item) || 0;
    const rate = parseFloat(item.rate) || 0;
    const disc = parseFloat(item.disc) || 0;
    const lineVal = Number((qty * rate * (1 - disc / 100)).toFixed(2));
    if (gstEnabled) {
      const grate = parseFloat(item.grate) || 0;
      itemsTaxTotal += Number(((lineVal * grate) / 100).toFixed(2));
    }
    itemsGrossTotal += lineVal;
  });

  itemsGrossTotal = Number(itemsGrossTotal.toFixed(2));
  itemsTaxTotal = Number(itemsTaxTotal.toFixed(2));

  let otherChargesTotal = 0;
  let otherChargesGstTotal = 0;
  if (otherCharges?.length > 0) {
    for (const charge of otherCharges) {
      const amt = Number((parseFloat(charge.amount) || 0).toFixed(2));
      otherChargesTotal += amt;
      if (gstEnabled) {
        const crate = parseFloat(charge.grate || charge.gstRate) || 0;
        otherChargesGstTotal += Number(((amt * crate) / 100).toFixed(2));
      }
    }
  }
  otherChargesTotal = Number(otherChargesTotal.toFixed(2));
  otherChargesGstTotal = Number(otherChargesGstTotal.toFixed(2));

  const grossTotal = Number((itemsGrossTotal + otherChargesTotal).toFixed(2));
  const totalTax = Number((itemsTaxTotal + otherChargesGstTotal).toFixed(2));

  let cgst = 0, sgst = 0, igst = 0;
  if (gstEnabled && (billType === 'intra-state' || billType === 'INTRA-STATE')) {
    const halfTax = Number((totalTax / 2).toFixed(2));
    cgst = halfTax;
    sgst = Number((totalTax - halfTax).toFixed(2)); // Guarantees cgst + sgst === totalTax to the exact paise
  } else if (gstEnabled) {
    igst = totalTax;
  }

  const taxSum = reverseCharge ? 0 : Number((cgst + sgst + igst).toFixed(2));
  const netTotalBeforeRoundOff = Number((grossTotal + taxSum).toFixed(2));
  const netTotal = Math.round(netTotalBeforeRoundOff);
  const roundOff = Number((netTotal - netTotalBeforeRoundOff).toFixed(2));

  return { grossTotal, totalTax, otherChargesTotal, otherChargesGstTotal, cgst, sgst, igst, netTotal, roundOff };
}

export function reverseWAC(existingTotal: number, existingQty: number, removedQty: number, costValue: number) {
  const newQty = Math.max(0, existingQty - removedQty);
  const newTotal = Math.max(0, (existingTotal ?? 0) - costValue);
  const newRate = newQty > 0
    ? newTotal / newQty
    : (existingQty > 0 ? (existingTotal ?? 0) / existingQty : 0);
  return { newRate: Number(newRate.toFixed(6)), newTotal, newQty };
}
