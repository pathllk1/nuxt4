import { z } from 'zod';

/**
 * Commercial Invoice Item Schema (Goods / Standard Products)
 */
export const CommercialInvoiceItemSchema = z.object({
  item: z.string().min(1, 'Item name is required'),
  qty: z.union([z.number(), z.string()]).refine((val) => {
    const n = parseFloat(String(val));
    return Number.isFinite(n) && n > 0;
  }, { message: 'Quantity must be a positive number greater than 0' }),
  rate: z.union([z.number(), z.string()]).refine((val) => {
    const n = parseFloat(String(val));
    return Number.isFinite(n) && n >= 0;
  }, { message: 'Rate must be a non-negative number' }),
  disc: z.union([z.number(), z.string()]).optional().nullable().refine((val) => {
    if (val === undefined || val === null || val === '') return true;
    const n = parseFloat(String(val));
    return Number.isFinite(n) && n >= 0 && n <= 100;
  }, { message: 'Discount percentage must be between 0 and 100' }),
  grate: z.union([z.number(), z.string()]).optional().nullable().refine((val) => {
    if (val === undefined || val === null || val === '') return true;
    const n = parseFloat(String(val));
    return Number.isFinite(n) && n >= 0 && n <= 100;
  }, { message: 'GST rate must be between 0 and 100' }),
  hsn: z.string().optional().nullable(),
  stockId: z.any().optional().nullable(),
  uom: z.string().optional().nullable(),
}).passthrough();

/**
 * Accounting Service Item Schema
 */
export const AccountingInvoiceItemSchema = z.object({
  ledgerAccountId: z.any().optional().nullable(),
  amount: z.union([z.number(), z.string()]).refine((val) => {
    const n = parseFloat(String(val));
    return Number.isFinite(n) && n > 0;
  }, { message: 'Amount must be a positive number greater than 0' }),
  gstRate: z.union([z.number(), z.string()]).optional().nullable().refine((val) => {
    if (val === undefined || val === null || val === '') return true;
    const n = parseFloat(String(val));
    return Number.isFinite(n) && n >= 0 && n <= 100;
  }, { message: 'GST rate must be between 0 and 100' }),
  sacCode: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  narration: z.string().optional().nullable(),
}).passthrough();

/**
 * Invoice Metadata Schema
 */
export const InvoiceMetaSchema = z.object({
  billDate: z.string().optional().nullable().refine((val) => {
    if (!val) return true;
    return /^\d{4}-\d{2}-\d{2}$/.test(val) && !Number.isNaN(new Date(val).getTime());
  }, { message: 'Bill date must be in valid YYYY-MM-DD format' }),
  billType: z.string().optional().nullable(),
  partyGstin: z.string().optional().nullable(),
  firmGstin: z.string().optional().nullable(),
  reverseCharge: z.boolean().optional().nullable(),
  supplierBillNo: z.string().optional().nullable(),
}).passthrough();

/**
 * Other Charges Schema
 */
export const OtherChargeSchema = z.object({
  name: z.string().optional().nullable(),
  amount: z.union([z.number(), z.string()]).optional().nullable(),
  grate: z.union([z.number(), z.string()]).optional().nullable(),
  gstRate: z.union([z.number(), z.string()]).optional().nullable(),
}).passthrough();

/**
 * Party Identifier Schema (ObjectId string or object containing id / _id)
 */
export const PartyIdentifierSchema = z.union([
  z.string().min(1, 'Party ID is required'),
  z.object({
    id: z.string().optional(),
    _id: z.any().optional()
  }).refine((p) => Boolean(p.id || p._id), { message: 'Party ID is required' })
]);

/**
 * Commercial Invoice Mutation Schema (Sales / Purchase)
 */
export const CommercialInvoiceMutationSchema = z.object({
  party: PartyIdentifierSchema,
  cart: z.array(CommercialInvoiceItemSchema).min(1, 'Cart cannot be empty and must contain at least 1 valid item'),
  meta: InvoiceMetaSchema.optional().nullable(),
  otherCharges: z.array(OtherChargeSchema).optional().nullable(),
  consignee: z.any().optional().nullable(),
}).passthrough();

/**
 * Accounting Invoice Mutation Schema (Service Sales / Service Purchase)
 */
export const AccountingInvoiceMutationSchema = z.object({
  party: PartyIdentifierSchema,
  cart: z.array(AccountingInvoiceItemSchema).min(1, 'Cart cannot be empty and must contain at least 1 valid service item'),
  meta: InvoiceMetaSchema.optional().nullable(),
  otherCharges: z.array(OtherChargeSchema).optional().nullable(),
  consignee: z.any().optional().nullable(),
}).passthrough();

/**
 * Voucher Mutation Schema
 */
export const VoucherMutationSchema = z.object({
  vtype: z.string().refine((val) => ['PAYMENT', 'RECEIPT', 'JOURNAL', 'CONTRA'].includes(String(val).toUpperCase()), {
    message: 'Voucher type must be one of PAYMENT, RECEIPT, JOURNAL, CONTRA'
  }),
  vdate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Valid transaction date in YYYY-MM-DD format is required'),
  idempotencyKey: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'A valid UUID idempotency key is required'),
  narration: z.string().optional().nullable(),
  mainAccount: z.any().optional().nullable(),
  entries: z.array(z.object({
    accountHead: z.string().optional().nullable(),
    amount: z.union([z.number(), z.string()]).optional().nullable(),
    debitAmount: z.union([z.number(), z.string()]).optional().nullable(),
    creditAmount: z.union([z.number(), z.string()]).optional().nullable(),
  }).passthrough()).min(1, 'At least one voucher entry is required')
}).passthrough();
