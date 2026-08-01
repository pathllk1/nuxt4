import { ref } from 'vue';

export interface LedgerEntry {
  id?: string;
  firmId: string;
  transactionDate: string;
  accountHead: string;
  accountType: string;
  debitAmount: number;
  creditAmount: number;
  narration?: string;
  refType?: string;
  refId?: string;
  voucherGroupId?: string;
  voucherNo?: string;
  voucherType?: string;
  partyId?: string;
  bankAccountId?: string;
  paymentMode?: string;
}

export interface VoucherEntry {
  accountHead: string;
  accountType: string;
  debitAmount: number;
  creditAmount: number;
  narration?: string;
  partyId?: string;
  bankAccountId?: string;
  paymentMode?: string;
}

export const useAccounting = () => {
  const loading = ref(false);
  const error = ref<string | null>(null);
  const ledgerEntries = ref<LedgerEntry[]>([]);
  const accountBalance = ref({ totalDebit: 0, totalCredit: 0, balance: 0, balanceType: 'DR' });
  const trialBalance = ref<any[]>([]);
  const vouchersSummary = ref<any>({});
  const journalSummary = ref<any>({});
  const accountTypeSummaries = ref<any[]>([]);

  const fetchLedger = async (params?: { accountHead?: string; partyId?: string; voucherType?: string; fromDate?: string; toDate?: string }) => {
    loading.value = true;
    error.value = null;
    try {
      const response = await $fetch<{ success: boolean; data: any[] }>('/api/accounting/ledger', { query: params });
      if (response.success) {
        ledgerEntries.value = response.data;
      }
    } catch (err: any) {
      error.value = err.data?.message || err.message || 'Failed to fetch ledger';
    } finally {
      loading.value = false;
    }
  };

  const fetchTrialBalance = async (params?: { fromDate?: string; toDate?: string }) => {
    loading.value = true;
    error.value = null;
    try {
      const response = await $fetch<{ success: boolean; data: any[]; summary: any }>('/api/accounting/ledger/trial-balance', { query: params });
      if (response.success) {
        trialBalance.value = response.data;
      }
    } catch (err: any) {
      error.value = err.data?.message || err.message || 'Failed to fetch trial balance';
    } finally {
      loading.value = false;
    }
  };

  const fetchVouchersSummary = async () => {
    try {
      const response = await $fetch<{ success: boolean; data: any }>('/api/accounting/ledger/vouchers-summary');
      if (response.success) {
        vouchersSummary.value = response.data;
      }
    } catch (err) {
      console.error('Failed to fetch vouchers summary', err);
    }
  };

  const fetchJournalSummary = async () => {
    try {
      const response = await $fetch<{ success: boolean; data: any }>('/api/accounting/ledger/journal-summary');
      if (response.success) {
        journalSummary.value = response.data;
      }
    } catch (err) {
      console.error('Failed to fetch journal summary', err);
    }
  };

  const fetchAccountTypeSummaries = async (toDate?: string) => {
    try {
      const response = await $fetch<{ success: boolean; data: any[] }>('/api/accounting/ledger/account-types', { query: { toDate } });
      if (response.success) {
        accountTypeSummaries.value = response.data;
      }
    } catch (err) {
      console.error('Failed to fetch account type summaries', err);
    }
  };

  const submitVoucher = async (voucherData: {
    vtype: string;
    vdate: string;
    narration: string;
    entries: VoucherEntry[];
    mainAccount?: string;
    summary?: any;
  }) => {
    loading.value = true;
    error.value = null;
    try {
      const response = await $fetch<{ success: boolean; message: string; data: any }>('/api/accounting/vouchers', {
        method: 'POST',
        body: voucherData,
      });
      return response;
    } catch (err: any) {
      error.value = err.data?.message || err.message || 'Failed to submit voucher';
      throw err;
    } finally {
      loading.value = false;
    }
  };

  return {
    loading,
    error,
    ledgerEntries,
    accountBalance,
    trialBalance,
    vouchersSummary,
    journalSummary,
    accountTypeSummaries,
    fetchLedger,
    fetchTrialBalance,
    fetchVouchersSummary,
    fetchJournalSummary,
    fetchAccountTypeSummaries,
    submitVoucher,
  };
};
