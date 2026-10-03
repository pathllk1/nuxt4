import { ref, computed } from 'vue';
import { useAuth } from './useAuth';

export interface WalletData {
  supervisorName: string;
  imprestAccountHead: string;
  assignedProjectIds: string[];
  balance: number;
  balanceLabel: string;
  balanceType: 'DEBIT' | 'CREDIT';
  totalAdvancesReceived: number;
  totalExpensesApproved: number;
}

export interface ClaimStats {
  pending: { count: number; totalAmount: number };
  approved: { count: number; totalAmount: number };
  rejected: { count: number; totalAmount: number };
}

export interface ExpenseClaim {
  _id: string;
  firmId: string;
  supervisorId: string;
  supervisorName: string;
  imprestAccountHead: string;
  expenseDate: string;
  category: string;
  targetAccountHead: string;
  amount: number;
  paymentMode: string;
  partyOrPayeeName?: string;
  narration: string;
  projectId?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewedBy?: string;
  reviewedAt?: string;
  rejectionReason?: string;
  generatedVoucherGroupId?: string;
  createdAt: string;
  updatedAt: string;
}

export const EXPENSE_CATEGORIES = [
  { value: 'LABOUR', label: '👷 Daily Labour', icon: '👷' },
  { value: 'WELFARE', label: '☕ Tea & Tiffin', icon: '☕' },
  { value: 'MATERIAL', label: '🧱 Local Material', icon: '🧱' },
  { value: 'TRANSPORT', label: '🚚 Transport / Tempo', icon: '🚚' },
  { value: 'FUEL', label: '⛽ Fuel & Diesel', icon: '⛽' },
  { value: 'REPAIRS', label: '🔧 Site Repairs', icon: '🔧' },
  { value: 'OTHER', label: '📦 Other', icon: '📦' },
] as const;

export const useSiteWallet = () => {
  const { apiFetch, user, selectedFirmId } = useAuth();

  const wallet = ref<WalletData | null>(null);
  const claimStats = ref<ClaimStats | null>(null);
  const recentTransactions = ref<any[]>([]);
  const claims = ref<ExpenseClaim[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // Determine if the current user is a supervisor for the active firm
  const activeFirmAssignment = computed(() => {
    if (!user.value?.firms || !selectedFirmId.value) return null;
    return user.value.firms.find(f => {
      const fid = typeof f.firm === 'string' ? f.firm : (f.firm?._id || f.firm?.id);
      return String(fid) === String(selectedFirmId.value);
    });
  });

  const isSupervisor = computed(() => activeFirmAssignment.value?.grade === 'Supervisor');
  const activeGrade = computed(() => activeFirmAssignment.value?.grade || null);
  const linkedLedgerHead = computed(() => activeFirmAssignment.value?.linkedLedgerHead || null);

  const fetchWallet = async () => {
    if (!isSupervisor.value) return;
    loading.value = true;
    error.value = null;
    try {
      const res = await apiFetch<any>('/api/field/wallet');
      if (res?.success) {
        wallet.value = res.wallet;
        claimStats.value = res.claims;
        recentTransactions.value = res.recentTransactions || [];
      }
    } catch (e: any) {
      error.value = e?.data?.statusMessage || e?.statusMessage || 'Failed to load wallet';
      console.error('[SiteWallet] fetchWallet error:', e);
    } finally {
      loading.value = false;
    }
  };

  const submitExpense = async (expenseData: {
    category: string;
    amount: number;
    paymentMode: string;
    expenseDate: string;
    narration: string;
    partyOrPayeeName?: string | null;
    projectId?: string | null;
  }) => {
    loading.value = true;
    error.value = null;
    try {
      const res = await apiFetch<any>('/api/field/expenses', {
        method: 'POST',
        body: expenseData,
      });
      if (res?.success) {
        // Refresh wallet after submission
        await fetchWallet();
      }
      return res;
    } catch (e: any) {
      error.value = e?.data?.statusMessage || e?.statusMessage || 'Failed to submit expense';
      throw e;
    } finally {
      loading.value = false;
    }
  };

  const fetchClaims = async (status?: string) => {
    loading.value = true;
    error.value = null;
    try {
      const query = status ? `?status=${status}` : '';
      const res = await apiFetch<any>(`/api/field/expenses${query}`);
      if (res?.success) {
        claims.value = res.claims || [];
      }
      return res;
    } catch (e: any) {
      error.value = e?.data?.statusMessage || e?.statusMessage || 'Failed to load claims';
      console.error('[SiteWallet] fetchClaims error:', e);
    } finally {
      loading.value = false;
    }
  };

  return {
    // State
    wallet,
    claimStats,
    recentTransactions,
    claims,
    loading,
    error,

    // Computed
    isSupervisor,
    activeGrade,
    linkedLedgerHead,
    activeFirmAssignment,

    // Actions
    fetchWallet,
    submitExpense,
    fetchClaims,
  };
};
