import { ref, computed, reactive } from 'vue';
import { useAuth } from './useAuth';
import { useFirebaseAuth } from './useFirebaseAuth';
import {
  type Client,
  type Work,
  type Payment,
  type Wallet,
  type Transfer,
  type Expense,
  type Receipt,
  type Budget,
  type Adjustment,
  type RecurringTemplate,
  type ClientSummary,
  type TimelineItem,
  type WalletTransaction,
  type ToastMessage,
  type WorkStatusObj,
  type PaymentStatusObj,
  type ExpenseCategory,
  WORK_TYPES,
  PAYMENT_METHODS,
  PAYMENT_TYPES,
  DEFAULT_EXPENSE_CATEGORIES,
  WALLET_COLORS
} from '../types/work-tracker';

// Module-level reactive singleton state to share across tabs and modals
const activeTab = ref<string>('dashboard');
const activeReportTab = ref<string>('outstanding');
const loading = ref<boolean>(false);
const toasts = ref<ToastMessage[]>([]);

const rawClients = ref<Client[]>([]);
const rawWorks = ref<Work[]>([]);
const rawPayments = ref<Payment[]>([]);
const rawWallets = ref<Wallet[]>([]);
const rawTransfers = ref<Transfer[]>([]);
const rawExpenses = ref<Expense[]>([]);
const rawReceipts = ref<Receipt[]>([]);
const rawBudgets = ref<Budget[]>([]);
const rawAdjustments = ref<Adjustment[]>([]);
const rawRecurringTemplates = ref<RecurringTemplate[]>([]);

const customWorkTypes = ref<string[]>([]);
const customExpenseCategories = ref<ExpenseCategory[]>([]);

// Modals Visibility
const clientModalOpen = ref<boolean>(false);
const workModalOpen = ref<boolean>(false);
const paymentModalOpen = ref<boolean>(false);
const expenseModalOpen = ref<boolean>(false);
const receiptModalOpen = ref<boolean>(false);
const walletModalOpen = ref<boolean>(false);
const transferModalOpen = ref<boolean>(false);
const budgetModalOpen = ref<boolean>(false);
const bulkSettlementModalOpen = ref<boolean>(false);
const walletDetailModalOpen = ref<boolean>(false);
const workDetailModalOpen = ref<boolean>(false);
const setAmountModalOpen = ref<boolean>(false);
const templateModalOpen = ref<boolean>(false);
const adjustmentModalOpen = ref<boolean>(false);
const clientLedgerModalOpen = ref<boolean>(false);

// Detail Models
const selectedWorkDetail = ref<Work | null>(null);
const selectedWalletDetail = ref<{ wallet: Wallet; transactions: WalletTransaction[] } | null>(null);
const selectedClientLedger = ref<{ client: Client; summary: ClientSummary; timeline: TimelineItem[] } | null>(null);

// Forms
const clientForm = reactive<{ id: number; name: string; phone: string; email: string; notes: string; billingType: 'per_work' | 'monthly_fixed' | 'retainer' | 'project'; monthlyRate: number | string }>({
  id: 0,
  name: '',
  phone: '',
  email: '',
  notes: '',
  billingType: 'per_work',
  monthlyRate: ''
});

const workForm = reactive<{ id: number; clientId: number; workType: string; dateAssigned: string; dateSubmitted: string; totalAmount: number | string; description: string; notes: string; isRetainer: boolean }>({
  id: 0,
  clientId: 0,
  workType: '',
  dateAssigned: '',
  dateSubmitted: '',
  totalAmount: '',
  description: '',
  notes: '',
  isRetainer: false
});

const paymentForm = reactive<{ id: number; workId: number; clientId: number; amount: number; date: string; paymentType: string; method: string; reference: string; note: string; walletId: number | string; isAccountPayment: boolean }>({
  id: 0,
  workId: 0,
  clientId: 0,
  amount: 0,
  date: '',
  paymentType: 'Full',
  method: 'Cash',
  reference: '',
  note: '',
  walletId: '',
  isAccountPayment: false
});

const expenseForm = reactive<{ id: number; walletId: number; categoryId: string; amount: number; date: string; paidTo: string; description: string; notes: string; tags: string; isRecurring: boolean; recurringInterval: string }>({
  id: 0,
  walletId: 0,
  categoryId: '',
  amount: 0,
  date: '',
  paidTo: '',
  description: '',
  notes: '',
  tags: '',
  isRecurring: false,
  recurringInterval: ''
});

const receiptForm = reactive<{ id: number; walletId: number; amount: number; date: string; category: string; receivedFrom: string; reference: string; notes: string }>({
  id: 0,
  walletId: 0,
  amount: 0,
  date: '',
  category: '',
  receivedFrom: '',
  reference: '',
  notes: ''
});

const walletForm = reactive<{ id: number; name: string; type: string; initialBalance: number; color: string }>({
  id: 0,
  name: '',
  type: 'Cash',
  initialBalance: 0,
  color: '#3b82f6'
});

const transferForm = reactive<{ fromWalletId: number; toWalletId: number; amount: number; date: string; note: string }>({
  fromWalletId: 0,
  toWalletId: 0,
  amount: 0,
  date: '',
  note: ''
});

const budgetForm = reactive<{ categoryId: string; limitAmount: number; month: string }>({
  categoryId: '',
  limitAmount: 0,
  month: new Date().toISOString().substring(0, 7)
});

const setAmountForm = reactive<{ workId: number; amount: number }>({
  workId: 0,
  amount: 0
});

const templateForm = reactive<{ id: number; clientId: number; workType: string; fixedAmount: number; frequency: string; description: string; isActive: boolean }>({
  id: 0,
  clientId: 0,
  workType: '',
  fixedAmount: 0,
  frequency: 'monthly',
  description: '',
  isActive: true
});

const adjustmentForm = reactive<{ id: number; workId: number; type: 'discount' | 'write_off' | 'credit_note' | 'penalty'; amount: number; date: string; reason: string }>({
  id: 0,
  workId: 0,
  type: 'discount',
  amount: 0,
  date: '',
  reason: ''
});

const bulkSettlementForm = reactive<{
  clientId: number;
  date: string;
  amount: number;
  method: string;
  reference: string;
  walletId: number | string;
  note: string;
  selectedWorks: { id: number; pending: number; checked: boolean; title: string }[];
}>({
  clientId: 0,
  date: '',
  amount: 0,
  method: 'Cash',
  reference: '',
  walletId: '',
  note: '',
  selectedWorks: []
});

const selectedMonthForGeneration = ref<string>(new Date().toISOString().substring(0, 7));

// Search & Filter State
const workFilters = reactive({ clientId: '', workType: '', status: '', dateFrom: '', dateTo: '', search: '' });
const paymentFilters = reactive({ clientId: '', paymentType: '', method: '', dateFrom: '', dateTo: '', search: '' });
const expenseFilters = reactive({ walletId: '', categoryId: '', dateFrom: '', dateTo: '', search: '' });
const receiptFilters = reactive({ walletId: '', category: '', dateFrom: '', dateTo: '', search: '' });
const reportFilters = reactive({ dateFrom: '', dateTo: '' });

export const useWorkTracker = () => {
  const { apiFetch } = useAuth();
  const firebaseAuth = useFirebaseAuth();

  // Internal fetch helper - delegates session-authenticated requests to the backend
  const trackerFetch = <T = any>(url: string, opts: any = {}): Promise<T> => {
    return apiFetch<T>(url, opts);
  };

  const showToast = (message: string, type: ToastMessage['type'] = 'info') => {
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 9);
    toasts.value.push({ id, message, type });
    setTimeout(() => {
      toasts.value = toasts.value.filter(t => t.id !== id);
    }, 4000);
  };

  const getPaymentStatusObj = (work: Partial<Work>, paidAmount: number, effectiveAmount?: number | null): PaymentStatusObj => {
    const target = effectiveAmount !== undefined && effectiveAmount !== null ? effectiveAmount : work.totalAmount;
    if (target === null || target === undefined) {
      return paidAmount <= 0
        ? { status: 'amount_tbd', label: 'Amount TBD', color: 'slate', icon: '❓' }
        : { status: 'advance_received', label: 'Advance Received', color: 'sky', icon: '📥' };
    }
    const val = Number(target);
    if (paidAmount <= 0) return { status: 'unpaid', label: 'Unpaid', color: 'rose', icon: '⚠️' };
    if (paidAmount < val) return { status: 'partial', label: 'Partially Paid', color: 'amber', icon: '⏳' };
    return { status: 'paid', label: 'Fully Paid', color: 'emerald', icon: '✅' };
  };

  const getWorkStatusObj = (work: Partial<Work>, paymentStatus: string): WorkStatusObj => {
    if (work.dateSubmitted) {
      return paymentStatus === 'paid'
        ? { status: 'closed', label: 'Closed', color: 'emerald', icon: '🎉' }
        : { status: 'submitted', label: 'Submitted', color: 'violet', icon: '🚀' };
    }
    return { status: 'assigned', label: 'Assigned', color: 'indigo', icon: '📋' };
  };

  const getExpenseCategoryById = (id: string): ExpenseCategory => {
    const all = [...DEFAULT_EXPENSE_CATEGORIES, ...customExpenseCategories.value];
    return all.find(c => c.id === id) || { id, name: id, icon: '📦', color: '#64748b' };
  };

  const getWorkTypesList = (): string[] => {
    return [...WORK_TYPES.slice(0, -1), ...customWorkTypes.value, 'Other'];
  };

  const getPaymentMethodsList = (): string[] => PAYMENT_METHODS;
  const getPaymentTypesList = (): string[] => PAYMENT_TYPES;

  const getWalletName = (walletId: any): string => {
    const w = rawWallets.value.find(item => item.id === Number(walletId));
    return w ? w.name : 'Unknown Vault';
  };

  // Expanded Collections with Calculations
  const worksExpanded = computed<Work[]>(() => {
    const cls = rawClients.value;
    const pymts = rawPayments.value;
    const adjs = rawAdjustments.value;

    return rawWorks.value.map(w => {
      const client = cls.find(c => c.id === w.clientId);
      const workPayments = pymts.filter(p => p.workId === w.id);
      const totalPaid = workPayments.reduce((s, p) => s + Number(p.amount || 0), 0);
      const workAdjs = adjs.filter(a => a.workId === w.id);
      const discounts = workAdjs
        .filter(a => a.type === 'discount' || a.type === 'write_off' || a.type === 'credit_note')
        .reduce((s, a) => s + Number(a.amount || 0), 0);
      const penalties = workAdjs
        .filter(a => a.type === 'penalty')
        .reduce((s, a) => s + Number(a.amount || 0), 0);

      const effectiveAmount = w.totalAmount !== null && w.totalAmount !== undefined
        ? Number(w.totalAmount) - discounts + penalties
        : null;

      const paymentStatus = getPaymentStatusObj(w, totalPaid, effectiveAmount);
      const workStatus = getWorkStatusObj(w, paymentStatus.status);
      const pendingAmount = effectiveAmount !== null ? Math.max(0, effectiveAmount - totalPaid) : null;

      return {
        ...w,
        clientName: client ? client.name : 'Unknown Client',
        totalPaid,
        pendingAmount,
        effectiveAmount,
        totalDiscounts: discounts,
        totalPenalties: penalties,
        adjustments: workAdjs,
        paymentStatusObj: paymentStatus,
        workStatusObj: workStatus
      };
    });
  });

  const paymentsExpanded = computed<Payment[]>(() => {
    const cls = rawClients.value;
    const wks = worksExpanded.value;
    return rawPayments.value.map(p => {
      const client = cls.find(c => c.id === p.clientId);
      const work = p.workId ? wks.find(w => w.id === p.workId) : null;
      return {
        ...p,
        clientName: client ? client.name : 'Unknown Client',
        workType: work ? work.workType : p.workId ? 'Unknown Work' : 'Account Deposit',
        workDescription: work ? work.description || '' : 'Client account payment'
      };
    });
  });

  const expensesExpanded = computed<Expense[]>(() => {
    const wlts = rawWallets.value;
    return rawExpenses.value.map(e => {
      const wallet = wlts.find(w => w.id === e.walletId);
      const cat = getExpenseCategoryById(e.categoryId);
      return {
        ...e,
        walletName: wallet ? wallet.name : 'Unknown Vault',
        categoryName: cat.name,
        categoryIcon: cat.icon,
        categoryColor: cat.color
      };
    });
  });

  const walletsExpanded = computed<Wallet[]>(() => {
    const pymts = rawPayments.value;
    const rcpts = rawReceipts.value;
    const txfs = rawTransfers.value;
    const exps = rawExpenses.value;

    return rawWallets.value.map(w => {
      const init = Number(w.initialBalance) || 0;
      const pIn = pymts.filter(p => p.walletId === w.id).reduce((s, p) => s + Number(p.amount || 0), 0);
      const rIn = rcpts.filter(r => r.walletId === w.id).reduce((s, r) => s + Number(r.amount || 0), 0);
      const tIn = txfs.filter(t => t.toWalletId === w.id).reduce((s, t) => s + Number(t.amount || 0), 0);
      const eOut = exps.filter(e => e.walletId === w.id).reduce((s, e) => s + Number(e.amount || 0), 0);
      const tOut = txfs.filter(t => t.fromWalletId === w.id).reduce((s, t) => s + Number(t.amount || 0), 0);
      const currentBalance = init + pIn + rIn + tIn - eOut - tOut;

      return {
        ...w,
        currentBalance,
        transfersIn: tIn,
        transfersOut: tOut
      };
    });
  });

  const combinedReceipts = computed<Receipt[]>(() => {
    const dirReceipts = rawReceipts.value;
    const clientPaymentsAsReceipts: Receipt[] = paymentsExpanded.value.map(p => ({
      id: p.id,
      walletId: p.walletId || 0,
      amount: p.amount,
      date: p.date,
      category: 'Client Payment',
      receivedFrom: p.clientName || 'Unknown Client',
      reference: p.reference || '—',
      notes: p.note || '—',
      createdAt: p.createdAt,
      isClientPayment: true
    }));
    return [...dirReceipts, ...clientPaymentsAsReceipts].sort(
      (a, b) => new Date(b.date || b.createdAt || 0).getTime() - new Date(a.date || a.createdAt || 0).getTime()
    );
  });

  const dashboardStats = computed(() => {
    const allWorks = worksExpanded.value;
    const allPayments = rawPayments.value;
    const allExpenses = rawExpenses.value;
    const allReceipts = rawReceipts.value;
    const allWallets = walletsExpanded.value;

    const totalIncome = allPayments.reduce((s, p) => s + Number(p.amount || 0), 0) +
      allReceipts.reduce((s, r) => s + Number(r.amount || 0), 0);
    const totalExpenses = allExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);
    const netProfit = totalIncome - totalExpenses;

    const totalBilled = allWorks.reduce((s, w) => s + Number(w.effectiveAmount || w.totalAmount || 0), 0);
    const totalPaidOnWorks = allWorks.reduce((s, w) => s + Number(w.totalPaid || 0), 0);
    const totalOutstanding = allWorks
      .filter(w => w.paymentStatusObj?.status !== 'paid')
      .reduce((s, w) => s + Number(w.pendingAmount || 0), 0);

    const totalVaultBalance = allWallets.reduce((s, w) => s + Number(w.currentBalance || 0), 0);
    const activeWorksCount = allWorks.filter(w => w.workStatusObj?.status !== 'closed').length;

    return {
      income: totalIncome,
      expenses: totalExpenses,
      netProfit,
      totalBilled,
      totalPaid: totalPaidOnWorks,
      outstanding: totalOutstanding,
      vaultBalance: totalVaultBalance,
      activeWorks: activeWorksCount
    };
  });

  const bulkAllocations = computed(() => {
    const totalAmount = Number(bulkSettlementForm.amount) || 0;
    const checkedWorks = bulkSettlementForm.selectedWorks.filter(w => w.checked);
    let remainingToAllocate = totalAmount;
    const allocations: { workId: number; title: string; allocated: number; pending: number }[] = [];

    for (const w of checkedWorks) {
      if (remainingToAllocate <= 0) {
        allocations.push({
          workId: w.id,
          title: w.title,
          allocated: 0,
          pending: w.pending
        });
        continue;
      }
      const toAllocate = Math.min(remainingToAllocate, w.pending);
      remainingToAllocate -= toAllocate;
      allocations.push({
        workId: w.id,
        title: w.title,
        allocated: toAllocate,
        pending: w.pending - toAllocate
      });
    }
    return allocations;
  });

  // Client Summaries & Ledger
  const getClientSummary = (clientId: number, dateFrom?: string, dateTo?: string): ClientSummary => {
    const client = rawClients.value.find(c => c.id === clientId);
    let cWorks = worksExpanded.value.filter(w => w.clientId === clientId);
    let cPayments = rawPayments.value.filter(p => p.clientId === clientId);

    if (dateFrom) {
      cWorks = cWorks.filter(w => w.dateAssigned >= dateFrom);
      cPayments = cPayments.filter(p => p.date >= dateFrom);
    }
    if (dateTo) {
      cWorks = cWorks.filter(w => w.dateAssigned <= dateTo);
      cPayments = cPayments.filter(p => p.date <= dateTo);
    }

    const totalBilled = cWorks.reduce((s, w) => s + Number(w.effectiveAmount || w.totalAmount || 0), 0);
    const totalPaid = cPayments.reduce((s, p) => s + Number(p.amount || 0), 0);
    const outstanding = Math.max(0, totalBilled - totalPaid);
    const surplus = Math.max(0, totalPaid - totalBilled);

    return {
      clientId,
      clientName: client ? client.name : 'Unknown Client',
      totalWorks: cWorks.length,
      activeWorks: cWorks.filter(w => w.workStatusObj?.status !== 'closed').length,
      totalBilled,
      totalPaid,
      outstanding,
      surplus,
      totalDiscounts: cWorks.reduce((s, w) => s + (w.totalDiscounts || 0), 0),
      totalPenalties: cWorks.reduce((s, w) => s + (w.totalPenalties || 0), 0)
    };
  };

  const filterClientWorks = (clientId: any): Work[] => {
    const id = Number(clientId);
    if (!id) return [];
    return worksExpanded.value
      .filter(w => w.clientId === id && w.paymentStatusObj?.status !== 'paid')
      .sort((a, b) => new Date(a.dateAssigned).getTime() - new Date(b.dateAssigned).getTime());
  };

  // Data Loading
  const loadAllData = async () => {
    loading.value = true;
    try {
      // Ensure Google connection status is checked
      const status = await firebaseAuth.fetchAuthStatus();
      if (!status?.isLinked) {
        rawClients.value = [];
        rawWorks.value = [];
        rawPayments.value = [];
        rawWallets.value = [];
        rawTransfers.value = [];
        rawExpenses.value = [];
        rawReceipts.value = [];
        rawBudgets.value = [];
        rawAdjustments.value = [];
        rawRecurringTemplates.value = [];
        return;
      }

      const [cls, wks, pymts, wlts, txfs, exps, rcpts, bdgts, adjs, tmpls] = await Promise.all([
        trackerFetch<Client[]>('/api/work-tracker/clients'),
        trackerFetch<Work[]>('/api/work-tracker/works'),
        trackerFetch<Payment[]>('/api/work-tracker/payments'),
        trackerFetch<Wallet[]>('/api/work-tracker/wallets?includeArchived=true'),
        trackerFetch<Transfer[]>('/api/work-tracker/transfers'),
        trackerFetch<Expense[]>('/api/work-tracker/expenses'),
        trackerFetch<Receipt[]>('/api/work-tracker/receipts'),
        trackerFetch<Budget[]>('/api/work-tracker/budgets'),
        trackerFetch<Adjustment[]>('/api/work-tracker/adjustments'),
        trackerFetch<RecurringTemplate[]>('/api/work-tracker/templates')
      ]);

      rawClients.value = cls || [];
      rawWorks.value = wks || [];
      rawPayments.value = pymts || [];
      rawWallets.value = wlts || [];
      rawTransfers.value = txfs || [];
      rawExpenses.value = exps || [];
      rawReceipts.value = rcpts || [];
      rawBudgets.value = bdgts || [];
      rawAdjustments.value = adjs || [];
      rawRecurringTemplates.value = tmpls || [];
    } catch (err: any) {
      if (err?.data?.code !== 'FIREBASE_NOT_LINKED') {
        showToast('Failed to load tracker data: ' + (err?.data?.statusMessage || err?.message || err), 'error');
      }
    } finally {
      loading.value = false;
    }
  };

  // Modal Openers
  const openAddClientModal = () => {
    Object.assign(clientForm, { id: 0, name: '', phone: '', email: '', notes: '', billingType: 'per_work', monthlyRate: '' });
    clientModalOpen.value = true;
  };

  const openEditClientModal = (client: Client) => {
    Object.assign(clientForm, {
      id: client.id,
      name: client.name,
      phone: client.phone || '',
      email: client.email || '',
      notes: client.notes || '',
      billingType: client.billingType || 'per_work',
      monthlyRate: client.monthlyRate ?? ''
    });
    clientModalOpen.value = true;
  };

  const openAddWorkModal = (clientId?: number) => {
    const defaultClientId = clientId || (rawClients.value.length > 0 ? (rawClients.value[0]?.id || 0) : 0);
    const client = rawClients.value.find(c => c.id === defaultClientId);
    Object.assign(workForm, {
      id: 0,
      clientId: defaultClientId,
      workType: getWorkTypesList()[0] || 'Other',
      dateAssigned: new Date().toISOString().split('T')[0],
      dateSubmitted: '',
      totalAmount: client?.monthlyRate ? client.monthlyRate : '',
      description: '',
      notes: '',
      isRetainer: false
    });
    workModalOpen.value = true;
  };

  const openEditWorkModal = (work: Work) => {
    Object.assign(workForm, {
      id: work.id,
      clientId: work.clientId,
      workType: work.workType,
      dateAssigned: work.dateAssigned,
      dateSubmitted: work.dateSubmitted || '',
      totalAmount: work.totalAmount ?? '',
      description: work.description || '',
      notes: work.notes || '',
      isRetainer: !!work.isRetainer
    });
    workModalOpen.value = true;
  };

  const openAddPaymentModal = (clientId?: number, workId?: number) => {
    const cId = clientId || (rawClients.value.length > 0 ? (rawClients.value[0]?.id || 0) : 0);
    const defaultWalletId = rawWallets.value.length > 0 ? (rawWallets.value[0]?.id || '') : '';
    const pendingWorks = filterClientWorks(cId);
    const selectedWorkId = workId || (pendingWorks.length > 0 ? (pendingWorks[0]?.id || 0) : 0);

    Object.assign(paymentForm, {
      id: 0,
      clientId: cId,
      workId: selectedWorkId,
      amount: 0,
      date: new Date().toISOString().split('T')[0],
      paymentType: 'Full',
      method: 'Cash',
      reference: '',
      note: '',
      walletId: defaultWalletId,
      isAccountPayment: false
    });

    if (selectedWorkId) {
      const work = worksExpanded.value.find(w => w.id === selectedWorkId);
      if (work && work.pendingAmount) {
        paymentForm.amount = work.pendingAmount;
      }
    }
    paymentModalOpen.value = true;
  };

  const openEditPaymentModal = (payment: Payment) => {
    Object.assign(paymentForm, {
      id: payment.id,
      clientId: payment.clientId,
      workId: payment.workId || 0,
      amount: payment.amount,
      date: payment.date,
      paymentType: payment.paymentType,
      method: payment.method,
      reference: payment.reference || '',
      note: payment.note || '',
      walletId: payment.walletId || '',
      isAccountPayment: !payment.workId
    });
    paymentModalOpen.value = true;
  };

  const onPaymentClientChange = () => {
    const pendingWorks = filterClientWorks(paymentForm.clientId);
    if (pendingWorks.length > 0 && pendingWorks[0]) {
      paymentForm.workId = pendingWorks[0].id;
      paymentForm.amount = pendingWorks[0].pendingAmount || 0;
      paymentForm.paymentType = 'Full';
    } else {
      paymentForm.workId = 0;
      paymentForm.amount = 0;
    }
  };

  const onPaymentWorkChange = () => {
    if (paymentForm.workId) {
      const work = worksExpanded.value.find(w => w.id === Number(paymentForm.workId));
      if (work && work.pendingAmount) {
        paymentForm.amount = work.pendingAmount;
        paymentForm.paymentType = 'Full';
      }
    }
  };

  const openBulkSettlementModal = (clientId?: number) => {
    const firstClient = clientId || (rawClients.value.length > 0 ? (rawClients.value[0]?.id || 0) : 0);
    const defaultWalletId = rawWallets.value.length > 0 ? (rawWallets.value[0]?.id || '') : '';
    Object.assign(bulkSettlementForm, {
      clientId: firstClient,
      date: new Date().toISOString().split('T')[0],
      amount: 0,
      method: 'Cash',
      reference: '',
      walletId: defaultWalletId,
      note: '',
      selectedWorks: []
    });
    onBulkClientChange();
    bulkSettlementModalOpen.value = true;
  };

  const onBulkClientChange = () => {
    const cId = Number(bulkSettlementForm.clientId);
    if (!cId) {
      bulkSettlementForm.selectedWorks = [];
      bulkSettlementForm.amount = 0;
      return;
    }

    const pendingWorks = worksExpanded.value
      .filter(w => w.clientId === cId && w.paymentStatusObj?.status !== 'paid' && w.totalAmount !== null)
      .sort((a, b) => new Date(a.dateAssigned).getTime() - new Date(b.dateAssigned).getTime());

    bulkSettlementForm.selectedWorks = pendingWorks.map(w => ({
      id: w.id,
      pending: w.pendingAmount || 0,
      checked: true,
      title: `${w.workType}${w.description ? ' (' + w.description + ')' : ''}`
    }));

    recalculateBulkTotalPending();
  };

  const recalculateBulkTotalPending = () => {
    const sum = bulkSettlementForm.selectedWorks
      .filter(w => w.checked)
      .reduce((s, w) => s + w.pending, 0);
    bulkSettlementForm.amount = sum;
  };

  const openAddExpenseModal = () => {
    const defaultWalletId = rawWallets.value.length > 0 ? (rawWallets.value[0]?.id || 0) : 0;
    const defaultCategory = DEFAULT_EXPENSE_CATEGORIES[0]?.id || 'miscellaneous';
    Object.assign(expenseForm, {
      id: 0,
      walletId: defaultWalletId,
      categoryId: defaultCategory,
      amount: 0,
      date: new Date().toISOString().split('T')[0],
      paidTo: '',
      description: '',
      notes: '',
      tags: '',
      isRecurring: false,
      recurringInterval: ''
    });
    expenseModalOpen.value = true;
  };

  const openEditExpenseModal = (exp: Expense) => {
    Object.assign(expenseForm, {
      id: exp.id,
      walletId: exp.walletId,
      categoryId: exp.categoryId,
      amount: exp.amount,
      date: exp.date,
      paidTo: exp.paidTo || '',
      description: exp.description || '',
      notes: exp.notes || '',
      tags: exp.tags || '',
      isRecurring: !!exp.isRecurring,
      recurringInterval: exp.recurringInterval || ''
    });
    expenseModalOpen.value = true;
  };

  const openAddReceiptModal = () => {
    const defaultWalletId = rawWallets.value.length > 0 ? (rawWallets.value[0]?.id || 0) : 0;
    Object.assign(receiptForm, {
      id: 0,
      walletId: defaultWalletId,
      amount: 0,
      date: new Date().toISOString().split('T')[0],
      category: 'Direct Income',
      receivedFrom: '',
      reference: '',
      notes: ''
    });
    receiptModalOpen.value = true;
  };

  const openEditReceiptModal = (r: Receipt) => {
    Object.assign(receiptForm, {
      id: r.id,
      walletId: r.walletId,
      amount: r.amount,
      date: r.date,
      category: r.category,
      receivedFrom: r.receivedFrom || '',
      reference: r.reference || '',
      notes: r.notes || ''
    });
    receiptModalOpen.value = true;
  };

  const openAddWalletModal = () => {
    Object.assign(walletForm, { id: 0, name: '', type: 'Cash', initialBalance: 0, color: WALLET_COLORS[0] || '#3b82f6' });
    walletModalOpen.value = true;
  };

  const openEditWalletModal = (w: Wallet) => {
    Object.assign(walletForm, { id: w.id, name: w.name, type: w.type, initialBalance: w.initialBalance || 0, color: w.color || (WALLET_COLORS[0] || '#3b82f6') });
    walletModalOpen.value = true;
  };

  const openTransferModal = () => {
    const fromId = rawWallets.value.length > 0 ? (rawWallets.value[0]?.id || 0) : 0;
    const toId = rawWallets.value.length > 1 ? (rawWallets.value[1]?.id || fromId) : fromId;
    Object.assign(transferForm, { fromWalletId: fromId, toWalletId: toId, amount: 0, date: new Date().toISOString().split('T')[0], note: '' });
    transferModalOpen.value = true;
  };

  const openAddAdjustmentModal = (workId: number) => {
    Object.assign(adjustmentForm, { id: 0, workId, type: 'discount', amount: 0, date: new Date().toISOString().split('T')[0], reason: '' });
    adjustmentModalOpen.value = true;
  };

  const openSetAmountModal = (workId: number, currentAmount?: number | null) => {
    Object.assign(setAmountForm, { workId, amount: currentAmount || 0 });
    setAmountModalOpen.value = true;
  };

  const openWorkDetails = (work: Work) => {
    selectedWorkDetail.value = work;
    workDetailModalOpen.value = true;
  };

  const openClientLedger = (client: Client) => {
    const summary = getClientSummary(client.id);
    const clientWorks = worksExpanded.value.filter(w => w.clientId === client.id);
    const clientPayments = rawPayments.value.filter(p => p.clientId === client.id);

    const timeline: TimelineItem[] = [];
    for (const w of clientWorks) {
      timeline.push({
        id: `work-${w.id}`,
        date: w.dateAssigned,
        type: 'work',
        description: `${w.workType}: ${w.description || 'Contract order'}`,
        debit: Number(w.effectiveAmount || w.totalAmount || 0),
        credit: 0,
        icon: '📋',
        statusBadge: w.paymentStatusObj?.label
      });
    }

    for (const p of clientPayments) {
      timeline.push({
        id: `pmt-${p.id}`,
        date: p.date,
        type: 'payment',
        description: `Payment via ${p.method} (${p.paymentType}) ${p.reference ? 'Ref: ' + p.reference : ''}`,
        debit: 0,
        credit: Number(p.amount),
        icon: '💰',
        statusBadge: 'Received'
      });
    }

    timeline.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    let running = 0;
    const finalTimeline = timeline.map(item => {
      running += item.debit - item.credit;
      return { ...item, runningBalance: running };
    });

    selectedClientLedger.value = { client, summary, timeline: finalTimeline.reverse() };
    clientLedgerModalOpen.value = true;
  };

  const openWalletDetails = async (wallet: Wallet) => {
    try {
      loading.value = true;
      const txs = await trackerFetch<WalletTransaction[]>(`/api/work-tracker/wallets/${wallet.id}/transactions`);
      selectedWalletDetail.value = { wallet, transactions: txs };
      walletDetailModalOpen.value = true;
    } catch (e: any) {
      showToast('Failed to load wallet ledger: ' + e.message, 'error');
    } finally {
      loading.value = false;
    }
  };

  const openAddTemplateModal = () => {
    const defaultClientId = rawClients.value.length > 0 ? (rawClients.value[0]?.id || 0) : 0;
    Object.assign(templateForm, {
      id: 0,
      clientId: defaultClientId,
      workType: getWorkTypesList()[0] || 'Other',
      fixedAmount: 0,
      frequency: 'monthly',
      description: '',
      isActive: true
    });
    templateModalOpen.value = true;
  };

  const openEditTemplateModal = (tmpl: RecurringTemplate) => {
    Object.assign(templateForm, {
      id: tmpl.id,
      clientId: tmpl.clientId,
      workType: tmpl.workType,
      fixedAmount: tmpl.fixedAmount,
      frequency: tmpl.frequency,
      description: tmpl.description || '',
      isActive: tmpl.isActive
    });
    templateModalOpen.value = true;
  };

  const openBudgetModal = () => {
    const defaultCategory = DEFAULT_EXPENSE_CATEGORIES[0]?.id || 'miscellaneous';
    Object.assign(budgetForm, {
      categoryId: defaultCategory,
      limitAmount: 0,
      month: new Date().toISOString().substring(0, 7)
    });
    budgetModalOpen.value = true;
  };

  // CRUD Submissions
  const saveClient = async () => {
    try {
      loading.value = true;
      if (clientForm.id) {
        await trackerFetch(`/api/work-tracker/clients/${clientForm.id}`, { method: 'PUT', body: clientForm });
        showToast('Client updated successfully!', 'success');
      } else {
        await trackerFetch('/api/work-tracker/clients', { method: 'POST', body: clientForm });
        showToast('Client created successfully!', 'success');
      }
      clientModalOpen.value = false;
      await loadAllData();
    } catch (e: any) {
      showToast('Failed to save client: ' + e.message, 'error');
    } finally {
      loading.value = false;
    }
  };

  const deleteClient = async (id: number) => {
    if (!confirm('Are you sure you want to delete this client? All associated works and payments will be removed.')) return;
    try {
      loading.value = true;
      await trackerFetch(`/api/work-tracker/clients/${id}`, { method: 'DELETE' });
      showToast('Client deleted successfully', 'info');
      await loadAllData();
    } catch (e: any) {
      showToast('Failed to delete client: ' + e.message, 'error');
    } finally {
      loading.value = false;
    }
  };

  const saveWork = async () => {
    try {
      loading.value = true;
      if (workForm.id) {
        await trackerFetch(`/api/work-tracker/works/${workForm.id}`, { method: 'PUT', body: workForm });
        showToast('Work order updated successfully!', 'success');
      } else {
        await trackerFetch('/api/work-tracker/works', { method: 'POST', body: workForm });
        showToast('Work order created successfully!', 'success');
      }
      workModalOpen.value = false;
      await loadAllData();
    } catch (e: any) {
      showToast('Failed to save work order: ' + e.message, 'error');
    } finally {
      loading.value = false;
    }
  };

  const deleteWork = async (id: number) => {
    if (!confirm('Are you sure you want to delete this work order?')) return;
    try {
      loading.value = true;
      await trackerFetch(`/api/work-tracker/works/${id}`, { method: 'DELETE' });
      showToast('Work order deleted', 'info');
      await loadAllData();
    } catch (e: any) {
      showToast('Failed to delete work: ' + e.message, 'error');
    } finally {
      loading.value = false;
    }
  };

  const savePayment = async () => {
    try {
      loading.value = true;
      if (paymentForm.id) {
        await trackerFetch(`/api/work-tracker/payments/${paymentForm.id}`, { method: 'PUT', body: paymentForm });
        showToast('Payment updated successfully!', 'success');
      } else {
        await trackerFetch('/api/work-tracker/payments', { method: 'POST', body: paymentForm });
        showToast('Payment recorded successfully!', 'success');
      }
      paymentModalOpen.value = false;
      await loadAllData();
    } catch (e: any) {
      showToast('Failed to save payment: ' + e.message, 'error');
    } finally {
      loading.value = false;
    }
  };

  const deletePayment = async (id: number) => {
    if (!confirm('Are you sure you want to delete this payment?')) return;
    try {
      loading.value = true;
      await trackerFetch(`/api/work-tracker/payments/${id}`, { method: 'DELETE' });
      showToast('Payment deleted', 'info');
      await loadAllData();
    } catch (e: any) {
      showToast('Failed to delete payment: ' + e.message, 'error');
    } finally {
      loading.value = false;
    }
  };

  const submitBulkSettlement = async () => {
    try {
      loading.value = true;
      const checkedWorks = bulkAllocations.value.filter(a => a.allocated > 0);
      const res = await trackerFetch<{ success: boolean; message?: string }>('/api/work-tracker/bulk-settlement', {
        method: 'POST',
        body: {
          clientId: bulkSettlementForm.clientId,
          date: bulkSettlementForm.date,
          amount: bulkSettlementForm.amount,
          method: bulkSettlementForm.method,
          reference: bulkSettlementForm.reference,
          walletId: bulkSettlementForm.walletId,
          note: bulkSettlementForm.note,
          allocations: checkedWorks
        }
      });
      showToast(res?.message || 'Bulk settlement completed successfully!', 'success');
      bulkSettlementModalOpen.value = false;
      await loadAllData();
    } catch (e: any) {
      showToast('Bulk settlement failed: ' + e.message, 'error');
    } finally {
      loading.value = false;
    }
  };

  const saveExpense = async () => {
    try {
      loading.value = true;
      if (expenseForm.id) {
        await trackerFetch(`/api/work-tracker/expenses/${expenseForm.id}`, { method: 'PUT', body: expenseForm });
        showToast('Expense updated successfully!', 'success');
      } else {
        await trackerFetch('/api/work-tracker/expenses', { method: 'POST', body: expenseForm });
        showToast('Expense recorded successfully!', 'success');
      }
      expenseModalOpen.value = false;
      await loadAllData();
    } catch (e: any) {
      showToast('Failed to save expense: ' + e.message, 'error');
    } finally {
      loading.value = false;
    }
  };

  const deleteExpense = async (id: number) => {
    if (!confirm('Are you sure you want to delete this expense?')) return;
    try {
      loading.value = true;
      await trackerFetch(`/api/work-tracker/expenses/${id}`, { method: 'DELETE' });
      showToast('Expense deleted', 'info');
      await loadAllData();
    } catch (e: any) {
      showToast('Failed to delete expense: ' + e.message, 'error');
    } finally {
      loading.value = false;
    }
  };

  const saveReceipt = async () => {
    try {
      loading.value = true;
      if (receiptForm.id) {
        await trackerFetch(`/api/work-tracker/receipts/${receiptForm.id}`, { method: 'PUT', body: receiptForm });
        showToast('Receipt updated successfully!', 'success');
      } else {
        await trackerFetch('/api/work-tracker/receipts', { method: 'POST', body: receiptForm });
        showToast('Receipt recorded successfully!', 'success');
      }
      receiptModalOpen.value = false;
      await loadAllData();
    } catch (e: any) {
      showToast('Failed to save receipt: ' + e.message, 'error');
    } finally {
      loading.value = false;
    }
  };

  const deleteReceipt = async (id: number) => {
    if (!confirm('Are you sure you want to delete this receipt?')) return;
    try {
      loading.value = true;
      await trackerFetch(`/api/work-tracker/receipts/${id}`, { method: 'DELETE' });
      showToast('Receipt deleted', 'info');
      await loadAllData();
    } catch (e: any) {
      showToast('Failed to delete receipt: ' + e.message, 'error');
    } finally {
      loading.value = false;
    }
  };

  const saveWallet = async () => {
    try {
      loading.value = true;
      if (walletForm.id) {
        await trackerFetch(`/api/work-tracker/wallets/${walletForm.id}`, { method: 'PUT', body: walletForm });
        showToast('Vault updated successfully!', 'success');
      } else {
        await trackerFetch('/api/work-tracker/wallets', { method: 'POST', body: walletForm });
        showToast('Vault created successfully!', 'success');
      }
      walletModalOpen.value = false;
      await loadAllData();
    } catch (e: any) {
      showToast('Failed to save vault: ' + e.message, 'error');
    } finally {
      loading.value = false;
    }
  };

  const deleteWallet = async (id: number, hard: boolean = false) => {
    if (!confirm(hard ? 'Permanently delete this vault?' : 'Archive this vault?')) return;
    try {
      loading.value = true;
      await trackerFetch(`/api/work-tracker/wallets/${id}?hard=${hard}`, { method: 'DELETE' });
      showToast('Vault status updated', 'info');
      await loadAllData();
    } catch (e: any) {
      showToast('Failed to update vault: ' + e.message, 'error');
    } finally {
      loading.value = false;
    }
  };

  const saveTransfer = async () => {
    try {
      loading.value = true;
      await trackerFetch('/api/work-tracker/transfers', { method: 'POST', body: transferForm });
      showToast('Inter-vault transfer executed successfully!', 'success');
      transferModalOpen.value = false;
      await loadAllData();
    } catch (e: any) {
      showToast('Transfer failed: ' + e.message, 'error');
    } finally {
      loading.value = false;
    }
  };

  const saveAdjustment = async () => {
    try {
      loading.value = true;
      await trackerFetch('/api/work-tracker/adjustments', { method: 'POST', body: adjustmentForm });
      showToast('Adjustment recorded successfully!', 'success');
      adjustmentModalOpen.value = false;
      await loadAllData();
    } catch (e: any) {
      showToast('Failed to save adjustment: ' + e.message, 'error');
    } finally {
      loading.value = false;
    }
  };

  const saveSetAmount = async () => {
    try {
      loading.value = true;
      await trackerFetch(`/api/work-tracker/works/${setAmountForm.workId}`, {
        method: 'PUT',
        body: { totalAmount: setAmountForm.amount }
      });
      showToast('Work order amount updated successfully!', 'success');
      setAmountModalOpen.value = false;
      await loadAllData();
    } catch (e: any) {
      showToast('Failed to set amount: ' + e.message, 'error');
    } finally {
      loading.value = false;
    }
  };

  const saveTemplate = async () => {
    try {
      loading.value = true;
      if (templateForm.id) {
        await trackerFetch(`/api/work-tracker/templates/${templateForm.id}`, { method: 'PUT', body: templateForm });
        showToast('Template updated successfully!', 'success');
      } else {
        await trackerFetch('/api/work-tracker/templates', { method: 'POST', body: templateForm });
        showToast('Template created successfully!', 'success');
      }
      templateModalOpen.value = false;
      await loadAllData();
    } catch (e: any) {
      showToast('Failed to save template: ' + e.message, 'error');
    } finally {
      loading.value = false;
    }
  };

  const deleteTemplate = async (id: number) => {
    if (!confirm('Are you sure you want to delete this template?')) return;
    try {
      loading.value = true;
      await trackerFetch(`/api/work-tracker/templates/${id}`, { method: 'DELETE' });
      showToast('Template deleted', 'info');
      await loadAllData();
    } catch (e: any) {
      showToast('Failed to delete template: ' + e.message, 'error');
    } finally {
      loading.value = false;
    }
  };

  const generateWorksFromTemplates = async () => {
    try {
      loading.value = true;
      const res = await trackerFetch<{ success: boolean; message?: string }>('/api/work-tracker/templates/generate', {
        method: 'POST',
        body: { month: selectedMonthForGeneration.value }
      });
      showToast(res?.message || 'Auto-billing generation complete!', 'success');
      await loadAllData();
    } catch (e: any) {
      showToast('Generation failed: ' + e.message, 'error');
    } finally {
      loading.value = false;
    }
  };

  const saveBudget = async () => {
    try {
      loading.value = true;
      await trackerFetch('/api/work-tracker/budgets', { method: 'POST', body: budgetForm });
      showToast('Budget cap set successfully!', 'success');
      budgetModalOpen.value = false;
      await loadAllData();
    } catch (e: any) {
      showToast('Failed to save budget: ' + e.message, 'error');
    } finally {
      loading.value = false;
    }
  };

  const deleteBudget = async (id: number) => {
    if (!confirm('Are you sure you want to remove this budget?')) return;
    try {
      loading.value = true;
      await trackerFetch(`/api/work-tracker/budgets/${id}`, { method: 'DELETE' });
      showToast('Budget removed', 'info');
      await loadAllData();
    } catch (e: any) {
      showToast('Failed to delete budget: ' + e.message, 'error');
    } finally {
      loading.value = false;
    }
  };

  const seedSampleData = async () => {
    try {
      loading.value = true;
      const res = await trackerFetch<{ success: boolean; message?: string }>('/api/work-tracker/seed', { method: 'POST' });
      showToast(res?.message || 'Seeded initial database records!', 'success');
      await loadAllData();
    } catch (e: any) {
      showToast('Seed failed: ' + e.message, 'error');
    } finally {
      loading.value = false;
    }
  };

  return {
    activeTab,
    activeReportTab,
    loading,
    toasts,
    firebaseAuth,
    clients: rawClients,
    works: worksExpanded,
    payments: paymentsExpanded,
    wallets: walletsExpanded,
    transfers: rawTransfers,
    expenses: expensesExpanded,
    receipts: rawReceipts,
    combinedReceipts,
    budgets: rawBudgets,
    adjustments: rawAdjustments,
    recurringTemplates: rawRecurringTemplates,
    customWorkTypes,
    customExpenseCategories,
    workFilters,
    paymentFilters,
    expenseFilters,
    receiptFilters,
    reportFilters,
    dashboardStats,
    bulkAllocations,
    clientModalOpen,
    workModalOpen,
    paymentModalOpen,
    expenseModalOpen,
    receiptModalOpen,
    walletModalOpen,
    transferModalOpen,
    budgetModalOpen,
    bulkSettlementModalOpen,
    walletDetailModalOpen,
    workDetailModalOpen,
    setAmountModalOpen,
    templateModalOpen,
    adjustmentModalOpen,
    clientLedgerModalOpen,
    selectedWorkDetail,
    selectedWalletDetail,
    selectedClientLedger,
    clientForm,
    workForm,
    paymentForm,
    expenseForm,
    receiptForm,
    walletForm,
    transferForm,
    budgetForm,
    setAmountForm,
    templateForm,
    adjustmentForm,
    bulkSettlementForm,
    selectedMonthForGeneration,
    showToast,
    loadAllData,
    getPaymentStatusObj,
    getWorkStatusObj,
    getExpenseCategoryById,
    getWorkTypesList,
    getPaymentMethodsList,
    getPaymentTypesList,
    getWalletName,
    getClientSummary,
    filterClientWorks,
    openAddClientModal,
    openEditClientModal,
    openAddWorkModal,
    openEditWorkModal,
    openAddPaymentModal,
    openEditPaymentModal,
    onPaymentClientChange,
    onPaymentWorkChange,
    openBulkSettlementModal,
    onBulkClientChange,
    recalculateBulkTotalPending,
    openAddExpenseModal,
    openEditExpenseModal,
    openAddReceiptModal,
    openEditReceiptModal,
    openAddWalletModal,
    openEditWalletModal,
    openTransferModal,
    openAddAdjustmentModal,
    openSetAmountModal,
    openWorkDetails,
    openClientLedger,
    openWalletDetails,
    openAddTemplateModal,
    openEditTemplateModal,
    openBudgetModal,
    saveClient,
    deleteClient,
    saveWork,
    deleteWork,
    savePayment,
    deletePayment,
    submitBulkSettlement,
    saveExpense,
    deleteExpense,
    saveReceipt,
    deleteReceipt,
    saveWallet,
    deleteWallet,
    saveTransfer,
    saveAdjustment,
    saveSetAmount,
    saveTemplate,
    deleteTemplate,
    generateWorksFromTemplates,
    saveBudget,
    deleteBudget,
    seedSampleData
  };
};
