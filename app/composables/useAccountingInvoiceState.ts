import { ref, computed, type Ref } from 'vue';
import { useApi } from '@/utils/api';

// ─── SAC Auto-Suggest Dictionary ───
export const SAC_DICTIONARY: Record<string, { sac: string; description: string; gstRate: number }> = {
  'consulting': { sac: '998311', description: 'Management & IT Consulting Services', gstRate: 18 },
  'it': { sac: '998311', description: 'IT Consulting Services', gstRate: 18 },
  'software': { sac: '998314', description: 'IT Design & Development Services', gstRate: 18 },
  'development': { sac: '998314', description: 'Software Development Services', gstRate: 18 },
  'legal': { sac: '998211', description: 'Legal Services', gstRate: 18 },
  'audit': { sac: '998211', description: 'Accounting & Audit Services', gstRate: 18 },
  'professional': { sac: '998211', description: 'Professional Services', gstRate: 18 },
  'rent': { sac: '997212', description: 'Renting of Immovable Property', gstRate: 18 },
  'lease': { sac: '997212', description: 'Leasing Services', gstRate: 18 },
  'transport': { sac: '996511', description: 'Goods Transport Services', gstRate: 5 },
  'freight': { sac: '996511', description: 'Freight Services', gstRate: 5 },
  'courier': { sac: '996812', description: 'Courier Services', gstRate: 18 },
  'maintenance': { sac: '998719', description: 'Maintenance & Repair Services', gstRate: 18 },
  'repair': { sac: '998719', description: 'Repair & Maintenance Services', gstRate: 18 },
  'amc': { sac: '998719', description: 'Annual Maintenance Contract', gstRate: 18 },
  'marketing': { sac: '998361', description: 'Marketing Services', gstRate: 18 },
  'advertising': { sac: '998361', description: 'Advertising Services', gstRate: 18 },
  'security': { sac: '998525', description: 'Security & Detective Services', gstRate: 18 },
  'commission': { sac: '996111', description: 'Commission & Brokerage Services', gstRate: 18 },
  'brokerage': { sac: '996111', description: 'Brokerage Services', gstRate: 18 },
  'insurance': { sac: '997159', description: 'Insurance Services', gstRate: 18 },
  'training': { sac: '999293', description: 'Training & Coaching Services', gstRate: 18 },
  'education': { sac: '999293', description: 'Education Support Services', gstRate: 18 },
  'hosting': { sac: '998315', description: 'Hosting & IT Infrastructure', gstRate: 18 },
  'cloud': { sac: '998315', description: 'Cloud Computing Services', gstRate: 18 },
  'design': { sac: '998391', description: 'Design & Creative Services', gstRate: 18 },
  'cleaning': { sac: '998531', description: 'Cleaning & Housekeeping Services', gstRate: 18 },
  'labour': { sac: '998513', description: 'Labour Supply Services', gstRate: 18 },
  'labor': { sac: '998513', description: 'Labour Supply Services', gstRate: 18 },
  'manpower': { sac: '998513', description: 'Manpower Supply Services', gstRate: 18 },
  'telecom': { sac: '998412', description: 'Telecommunication Services', gstRate: 18 },
  'photography': { sac: '998382', description: 'Photography Services', gstRate: 18 },
  'printing': { sac: '998912', description: 'Printing Services', gstRate: 18 },
  'catering': { sac: '996331', description: 'Catering Services', gstRate: 5 },
  'hotel': { sac: '996311', description: 'Hotel Accommodation Services', gstRate: 12 },
  'construction': { sac: '995411', description: 'Construction Services', gstRate: 18 },
  'architect': { sac: '998341', description: 'Architectural Services', gstRate: 18 },
  'testing': { sac: '998346', description: 'Technical Testing Services', gstRate: 18 },
};

// ─── Types ───
export interface AccountingCartItem {
  id: string;
  ledgerAccountId: string;
  ledgerAccountHead: string;
  sacCode: string;
  description: string;
  amount: number;
  gstRate: number;
  narration: string;
}

export interface COAAccount {
  _id: string;
  account_name: string;
  account_type: string;
  hsn_sac?: string;
  gst_rate?: number;
  description?: string;
  current_balance?: number;
  current_balance_type?: string;
}

// ─── SAC Suggestion Helper ───
export function suggestSAC(accountName: string): { sac: string; gstRate: number; description: string } | null {
  const lower = accountName.toLowerCase().trim();
  for (const [keyword, entry] of Object.entries(SAC_DICTIONARY)) {
    if (lower.includes(keyword)) {
      return entry;
    }
  }
  return null;
}

// ─── Composable ───
export function useAccountingInvoiceState(invoiceType: 'SALES' | 'PURCHASE') {
  const api = useApi();

  // ─── Reactive State ───
  const cart: Ref<AccountingCartItem[]> = ref([]);
  const coaAccounts: Ref<COAAccount[]> = ref([]);
  const loadingCOA = ref(false);
  const saving = ref(false);
  const saveError = ref('');

  // ─── Cart Operations ───
  let _nextId = 1;

  function createEmptyItem(): AccountingCartItem {
    return {
      id: `acct-item-${_nextId++}`,
      ledgerAccountId: '',
      ledgerAccountHead: '',
      sacCode: '',
      description: '',
      amount: 0,
      gstRate: 18,
      narration: '',
    };
  }

  function addItem(account?: COAAccount): number {
    const item = createEmptyItem();
    if (account) {
      item.ledgerAccountId = account._id;
      item.ledgerAccountHead = account.account_name;
      item.sacCode = account.hsn_sac || '';
      item.description = account.description || account.account_name || '';
      item.gstRate = account.gst_rate !== undefined && account.gst_rate !== null ? account.gst_rate : 18;

      // Auto-suggest SAC & Description from dictionary if COA has none
      if (!item.sacCode) {
        const suggestion = suggestSAC(account.account_name);
        if (suggestion) {
          item.sacCode = suggestion.sac;
          if (!account.description) item.description = suggestion.description;
          if (account.gst_rate === undefined || account.gst_rate === null) item.gstRate = suggestion.gstRate;
        }
      }
    }
    cart.value.push(item);
    return cart.value.length - 1;
  }

  function removeItem(index: number) {
    if (index >= 0 && index < cart.value.length) {
      cart.value.splice(index, 1);
    }
  }

  function updateItem(index: number, field: keyof AccountingCartItem, value: any) {
    if (index >= 0 && index < cart.value.length) {
      (cart.value[index] as any)[field] = value;
    }
  }

  function clearCart() {
    cart.value = [];
  }

  // ─── Computed Totals ───
  const taxableTotal = computed(() => {
    return cart.value.reduce((sum, item) => sum + (parseFloat(String(item.amount)) || 0), 0);
  });

  const totalGstAmount = computed(() => {
    return cart.value.reduce((sum, item) => {
      const amt = parseFloat(String(item.amount)) || 0;
      const rate = parseFloat(String(item.gstRate)) || 0;
      return sum + (amt * rate / 100);
    }, 0);
  });

  const grossTotal = computed(() => taxableTotal.value);

  // These depend on billType — we compute them with a function
  function computeTotals(billType: string, reverseCharge: boolean) {
    let cgst = 0, sgst = 0, igst = 0;
    const isIntra = billType.toLowerCase() === 'intra-state';
    
    cart.value.forEach(item => {
      const amt = parseFloat(String(item.amount)) || 0;
      const rate = parseFloat(String(item.gstRate)) || 0;
      const tax = amt * rate / 100;
      if (isIntra) {
        cgst += tax / 2;
        sgst += tax / 2;
      } else {
        igst += tax;
      }
    });

    const netTotalBeforeRoundOff = grossTotal.value + (reverseCharge ? 0 : cgst + sgst + igst);
    const netTotal = Math.round(netTotalBeforeRoundOff);
    const roundOff = Number((netTotal - netTotalBeforeRoundOff).toFixed(2));

    return { cgst, sgst, igst, netTotal, roundOff, taxableTotal: taxableTotal.value };
  }

  // ─── COA Data ───
  async function fetchCOAAccounts(typeFilter?: string) {
    loadingCOA.value = true;
    try {
      const params = new URLSearchParams();
      if (typeFilter) params.append('type', typeFilter);
      const response = await api.get(`/accounting/coa?${params.toString()}`);
      coaAccounts.value = response.data || [];
    } catch (err: any) {
      console.error('Failed to fetch COA accounts:', err);
    } finally {
      loadingCOA.value = false;
    }
  }

  // ─── Save ───
  async function saveInvoice(params: {
    party: any;
    meta: any;
    otherCharges: any[];
  }) {
    saving.value = true;
    saveError.value = '';

    try {
      const endpoint = invoiceType === 'SALES'
        ? '/accounting/accounting-sales'
        : '/accounting/accounting-purchases';

      const payload = {
        party: params.party,
        meta: params.meta,
        otherCharges: params.otherCharges,
        cart: cart.value.map(item => ({
          ledgerAccountId: item.ledgerAccountId,
          ledgerAccountHead: item.ledgerAccountHead,
          sacCode: item.sacCode,
          description: item.description,
          amount: parseFloat(String(item.amount)) || 0,
          gstRate: parseFloat(String(item.gstRate)) || 0,
          narration: item.narration,
        })),
      };

      const response = await api.post(endpoint, payload);
      return response;
    } catch (err: any) {
      saveError.value = err?.response?.data?.statusMessage || err?.message || 'Failed to save invoice';
      throw err;
    } finally {
      saving.value = false;
    }
  }

  return {
    // State
    cart,
    coaAccounts,
    loadingCOA,
    saving,
    saveError,

    // Cart operations
    createEmptyItem,
    addItem,
    removeItem,
    updateItem,
    clearCart,

    // Computed
    taxableTotal,
    totalGstAmount,
    grossTotal,
    computeTotals,

    // COA
    fetchCOAAccounts,

    // Save
    saveInvoice,

    // Helpers
    suggestSAC,
  };
}
