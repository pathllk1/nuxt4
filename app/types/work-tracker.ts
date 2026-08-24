export interface Client {
  id: number;
  name: string;
  phone?: string;
  email?: string;
  notes?: string;
  billingType?: 'per_work' | 'monthly_fixed' | 'retainer' | 'project';
  monthlyRate?: number | null;
  createdAt?: string;
}

export interface Work {
  id: number;
  clientId: number;
  workType: string;
  dateAssigned: string;
  dateSubmitted?: string | null;
  totalAmount?: number | null;
  description?: string;
  notes?: string;
  isRetainer?: boolean;
  createdAt?: string;
  // Computed / Expanded
  clientName?: string;
  totalPaid?: number;
  pendingAmount?: number | null;
  effectiveAmount?: number | null;
  totalDiscounts?: number;
  totalPenalties?: number;
  adjustments?: Adjustment[];
  paymentStatusObj?: PaymentStatusObj;
  workStatusObj?: WorkStatusObj;
}

export interface Payment {
  id: number;
  workId?: number | null;
  clientId: number;
  walletId?: number | null;
  amount: number;
  date: string;
  paymentType: string;
  method: string;
  reference?: string;
  note?: string;
  isAccountPayment?: boolean;
  createdAt?: string;
  // Expanded
  clientName?: string;
  workType?: string;
  workDescription?: string;
}

export interface Wallet {
  id: number;
  name: string;
  type: string;
  initialBalance: number;
  color: string;
  isArchived?: boolean;
  createdAt?: string;
  // Computed
  currentBalance?: number;
  transfersIn?: number;
  transfersOut?: number;
}

export interface Transfer {
  id: number;
  fromWalletId: number;
  toWalletId: number;
  amount: number;
  date: string;
  note?: string;
  createdAt?: string;
  fromWalletName?: string;
  toWalletName?: string;
}

export interface ExpenseCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export interface Expense {
  id: number;
  walletId: number;
  categoryId: string;
  amount: number;
  date: string;
  paidTo?: string;
  description?: string;
  notes?: string;
  tags?: string;
  isRecurring?: boolean;
  recurringInterval?: string;
  createdAt?: string;
  // Expanded
  walletName?: string;
  categoryName?: string;
  categoryIcon?: string;
  categoryColor?: string;
}

export interface Receipt {
  id: number;
  walletId: number;
  amount: number;
  date: string;
  category: string;
  receivedFrom?: string;
  reference?: string;
  notes?: string;
  createdAt?: string;
  // Computed
  walletName?: string;
  isClientPayment?: boolean;
}

export interface Budget {
  id: number;
  categoryId: string;
  limitAmount: number;
  month: string; // YYYY-MM
  createdAt?: string;
}

export interface Adjustment {
  id: number;
  workId: number;
  type: 'discount' | 'write_off' | 'credit_note' | 'penalty';
  amount: number;
  date: string;
  reason?: string;
  createdAt?: string;
}

export interface RecurringTemplate {
  id: number;
  clientId: number;
  workType: string;
  fixedAmount: number;
  frequency: string; // monthly, quarterly, etc.
  description?: string;
  isActive: boolean;
  createdAt?: string;
  clientName?: string;
}

export interface WorkStatusObj {
  status: 'assigned' | 'submitted' | 'closed';
  label: string;
  color: string;
  icon: string;
}

export interface PaymentStatusObj {
  status: 'amount_tbd' | 'advance_received' | 'unpaid' | 'partial' | 'paid';
  label: string;
  color: string;
  icon: string;
}

export interface ClientSummary {
  clientId: number;
  clientName: string;
  totalWorks: number;
  activeWorks: number;
  totalBilled: number;
  totalPaid: number;
  outstanding: number;
  surplus: number;
  totalDiscounts: number;
  totalPenalties: number;
}

export interface TimelineItem {
  id: string | number;
  date: string;
  type: 'work' | 'payment' | 'adjustment' | 'deposit';
  description: string;
  debit: number;
  credit: number;
  runningBalance?: number;
  icon: string;
  color?: string;
  statusBadge?: string;
}

export interface WalletTransaction {
  date: string;
  type: 'initial' | 'payment_in' | 'receipt_in' | 'transfer_in' | 'expense_out' | 'transfer_out';
  typeLabel: string;
  category: string;
  party: string;
  description: string;
  reference: string;
  inflow: number;
  outflow: number;
  runningBalance: number;
}

export interface ToastMessage {
  id: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

// System Constants
export const WORK_TYPES = [
  'Sales Entry',
  'Purchase Entry',
  'Expenses Entry',
  'Bank Entry',
  'Proforma Invoice',
  'Quotation',
  'GST Filing',
  'TDS Entry',
  'Journal Entry',
  'Stock Entry',
  'Payment Voucher',
  'Receipt Voucher',
  'Other'
];

export const PAYMENT_METHODS = [
  'Cash',
  'UPI',
  'Bank Transfer',
  'Cheque',
  'Google Pay',
  'PhonePe',
  'Paytm',
  'Other'
];

export const PAYMENT_TYPES = [
  'Advance',
  'Partial',
  'Balance',
  'Full',
  'Settlement'
];

export const BILLING_TYPES = [
  { value: 'per_work', label: 'Per Work (Default)', icon: '📋' },
  { value: 'monthly_fixed', label: 'Fixed Monthly', icon: '📅' },
  { value: 'retainer', label: 'Monthly Retainer', icon: '🤝' },
  { value: 'project', label: 'Project Based', icon: '🏗️' }
];

export const ADJUSTMENT_TYPES = [
  { value: 'discount', label: 'Discount', icon: '🏷️', color: '#f59e0b' },
  { value: 'write_off', label: 'Write Off', icon: '✂️', color: '#ef4444' },
  { value: 'credit_note', label: 'Credit Note', icon: '📝', color: '#3b82f6' },
  { value: 'penalty', label: 'Penalty / Late Fee', icon: '⚠️', color: '#dc2626' }
];

export const DEFAULT_EXPENSE_CATEGORIES: ExpenseCategory[] = [
  { id: 'food', name: 'Food & Dining', icon: '🍕', color: '#f97316' },
  { id: 'transport', name: 'Transport', icon: '🚗', color: '#3b82f6' },
  { id: 'rent', name: 'Rent', icon: '🏠', color: '#8b5cf6' },
  { id: 'utilities', name: 'Utilities', icon: '⚡', color: '#eab308' },
  { id: 'health', name: 'Health', icon: '🏥', color: '#ef4444' },
  { id: 'entertainment', name: 'Entertainment', icon: '🎬', color: '#ec4899' },
  { id: 'shopping', name: 'Shopping', icon: '🛒', color: '#06b6d4' },
  { id: 'phone_internet', name: 'Phone & Internet', icon: '📱', color: '#6366f1' },
  { id: 'education', name: 'Education', icon: '📚', color: '#14b8a6' },
  { id: 'business', name: 'Business', icon: '💼', color: '#a855f7' },
  { id: 'gifts', name: 'Gifts', icon: '🎁', color: '#f43f5e' },
  { id: 'travel', name: 'Travel', icon: '✈️', color: '#0ea5e9' },
  { id: 'emi_loans', name: 'EMI & Loans', icon: '🏦', color: '#dc2626' },
  { id: 'investment', name: 'Investment', icon: '💰', color: '#22c55e' },
  { id: 'maintenance', name: 'Maintenance', icon: '🔧', color: '#78716c' },
  { id: 'miscellaneous', name: 'Miscellaneous', icon: '📦', color: '#64748b' }
];

export const WALLET_TYPES = [
  { value: 'Cash', label: 'Cash', icon: '💵' },
  { value: 'Bank', label: 'Bank Account', icon: '🏦' },
  { value: 'UPI', label: 'UPI', icon: '📱' },
  { value: 'Credit Card', label: 'Credit Card', icon: '💳' },
  { value: 'Savings', label: 'Savings / Reserve', icon: '🐷' }
];

export const WALLET_COLORS = [
  '#8b5cf6',
  '#3b82f6',
  '#22c55e',
  '#eab308',
  '#ef4444',
  '#06b6d4',
  '#ec4899',
  '#f97316'
];
