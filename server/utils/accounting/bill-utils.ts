import mongoose from 'mongoose';
import BillSequence from '../../models/BillSequence';
import VoucherSequence from '../../models/VoucherSequence';
import { getCurrentFinancialYear } from '../../../shared/utils/tax-calc';

export const getActorUsername = (request: any) => request?.user?.username ?? 'system';

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

export async function getNextBillNumber(
  firmId: mongoose.Types.ObjectId,
  type: string = 'SALES',
  billDate?: string | Date
) {
  const fy = getCurrentFinancialYear(billDate);
  const prefix = BILL_PREFIX[type.toUpperCase()] || type.slice(0, 3).toUpperCase();
  const seq = await BillSequence.findOneAndUpdate(
    { firmId, btype: type.toUpperCase(), financialYear: fy } as any,
    { $inc: { lastNo: 1 }, $setOnInsert: { prefix } },
    { returnDocument: 'after', upsert: true }
  );
  return `${prefix}/${fy}/${String((seq as any)?.lastNo || 1).padStart(4, '0')}`;
}

export async function previewNextBillNumber(
  firmId: mongoose.Types.ObjectId,
  type: string = 'SALES',
  billDate?: string | Date
) {
  const fy = getCurrentFinancialYear(billDate);
  const prefix = BILL_PREFIX[type.toUpperCase()] || type.slice(0, 3).toUpperCase();
  const seq = await BillSequence.findOne({ firmId, btype: type.toUpperCase(), financialYear: fy } as any).lean();
  const nextNum = ((seq as any)?.lastNo ?? 0) + 1;
  return `${prefix}/${fy}/${String(nextNum).padStart(4, '0')}`;
}

export async function getNextVoucherNumber(firmId: mongoose.Types.ObjectId) {
  const seq = await VoucherSequence.findOneAndUpdate(
    { firmId, vtype: 'JOURNAL' } as any,
    { $inc: { lastNo: 1 } },
    { returnDocument: 'after', upsert: true }
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


export function reverseWAC(existingTotal: number, existingQty: number, removedQty: number, costValue: number) {
  const newQty = Math.max(0, existingQty - removedQty);
  const newTotal = Math.max(0, (existingTotal ?? 0) - costValue);
  const newRate = newQty > 0
    ? newTotal / newQty
    : (existingQty > 0 ? (existingTotal ?? 0) / existingQty : 0);
  return { newRate: Number(newRate.toFixed(6)), newTotal, newQty };
}
