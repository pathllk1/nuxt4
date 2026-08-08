import { ref } from 'vue';
import { useApi } from '../utils/api';

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
  amount?: number;
  type?: string;
}

export const useAccounting = () => {
  const api = useApi();
  const loading = ref(false);
  const error = ref<string | null>(null);
  const ledgerEntries = ref<LedgerEntry[]>([]);
  const accountBalance = ref({ totalDebit: 0, totalCredit: 0, balance: 0, balanceType: 'DR' });
  const trialBalance = ref<any[]>([]);
  const vouchersSummary = ref<any>({});
  const journalSummary = ref<any>({});
  const accountTypeSummaries = ref<any[]>([]);
  const chartOfAccounts = ref<any[]>([]);

  const fetchLedger = async (params?: { accountHead?: string; partyId?: string; voucherType?: string; fromDate?: string; toDate?: string }) => {
    loading.value = true;
    error.value = null;
    try {
      const response = await api.get('/accounting/ledger', { params });
      if (response.success) {
        ledgerEntries.value = response.data;
      }
    } catch (err: any) {
      error.value = err.message || 'Failed to fetch ledger';
    } finally {
      loading.value = false;
    }
  };

  const fetchAccountBalance = async (accountHead: string, toDate?: string) => {
    loading.value = true;
    error.value = null;
    try {
      const response = await api.get('/accounting/ledger/balance', { params: { accountHead, toDate } });
      if (response.success) {
        accountBalance.value = response.data;
      }
    } catch (err: any) {
      error.value = err.message || 'Failed to fetch balance';
    } finally {
      loading.value = false;
    }
  };

  const fetchTrialBalance = async (params?: { fromDate?: string; toDate?: string }) => {
    loading.value = true;
    error.value = null;
    try {
      const response = await api.get('/accounting/ledger/trial-balance', { params });
      if (response.success) {
        trialBalance.value = response.data;
      }
    } catch (err: any) {
      error.value = err.message || 'Failed to fetch trial balance';
    } finally {
      loading.value = false;
    }
  };

  const fetchVouchersSummary = async () => {
    try {
      const response = await api.get('/accounting/ledger/vouchers-summary');
      if (response.success) {
        vouchersSummary.value = response.data;
      }
    } catch (err) {
      console.error('Failed to fetch vouchers summary', err);
    }
  };

  const fetchJournalSummary = async () => {
    try {
      const response = await api.get('/accounting/ledger/journal-summary');
      if (response.success) {
        journalSummary.value = response.data;
      }
    } catch (err) {
      console.error('Failed to fetch journal summary', err);
    }
  };

  const fetchAccountTypeSummaries = async (toDate?: string) => {
    try {
      const response = await api.get('/accounting/ledger/account-types', { params: { toDate } });
      if (response.success) {
        accountTypeSummaries.value = response.data;
      }
    } catch (err) {
      console.error('Failed to fetch account type summaries', err);
    }
  };

  const fetchCOA = async () => {
    try {
      const response = await api.get('/accounting/coa');
      if (response.success) {
        chartOfAccounts.value = response.data;
      }
    } catch (err) {
      console.error('Failed to fetch COA', err);
    }
  };

  const createVoucher = async (data: { vtype: string; vdate?: string; narration: string; entries: VoucherEntry[]; mainAccount?: string; summary?: any }) => {
    loading.value = true;
    error.value = null;
    try {
      const response = await api.post('/accounting/vouchers', data);
      return response;
    } catch (err: any) {
      error.value = err.message || 'Failed to create voucher';
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const submitVoucher = createVoucher;

  const createOpeningBalance = async (data: any) => {
    loading.value = true;
    error.value = null;
    try {
      const response = await api.post('/accounting/opening-balances', data);
      return response;
    } catch (err: any) {
      error.value = err.message || 'Failed to create opening balance';
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const exportTrialBalancePdf = async (params?: { fromDate?: string; toDate?: string }) => {
    let url = '/accounting/ledger/trial-balance/pdf';
    const query = new URLSearchParams();
    if (params?.fromDate) query.append('fromDate', params.fromDate);
    if (params?.toDate) query.append('toDate', params.toDate);
    const queryString = query.toString();
    if (queryString) url += '?' + queryString;

    await api.download(url, `Trial_Balance_${params?.toDate || new Date().toISOString().split('T')[0]}.pdf`);
  };

  const exportProfitLossPdf = async (params?: { fromDate?: string; toDate?: string }) => {
    let url = '/accounting/ledger/profit-loss/pdf';
    const query = new URLSearchParams();
    if (params?.fromDate) query.append('fromDate', params.fromDate);
    if (params?.toDate) query.append('toDate', params.toDate);
    const queryString = query.toString();
    if (queryString) url += '?' + queryString;

    await api.download(url, `Profit_Loss_Statement_${params?.toDate || new Date().toISOString().split('T')[0]}.pdf`);
  };

  const exportBalanceSheetPdf = async (params?: { fromDate?: string; toDate?: string }) => {
    let url = '/accounting/ledger/balance-sheet/pdf';
    const query = new URLSearchParams();
    if (params?.fromDate) query.append('fromDate', params.fromDate);
    if (params?.toDate) query.append('toDate', params.toDate);
    const queryString = query.toString();
    if (queryString) url += '?' + queryString;

    await api.download(url, `Balance_Sheet_${params?.toDate || new Date().toISOString().split('T')[0]}.pdf`);
  };

  const exportLedgerPdf = async (params: { accountHead: string; fromDate?: string; toDate?: string }) => {
    let url = '/accounting/ledger/pdf';
    const query = new URLSearchParams();
    query.append('accountHead', params.accountHead);
    if (params.fromDate) query.append('fromDate', params.fromDate);
    if (params.toDate) query.append('toDate', params.toDate);
    url += '?' + query.toString();

    const safeHead = params.accountHead.replace(/[^a-zA-Z0-9]/g, '_');
    await api.download(url, `Ledger_${safeHead}_${params.toDate || new Date().toISOString().split('T')[0]}.pdf`);
  };

  const exportTrialBalanceExcel = async (params?: { fromDate?: string; toDate?: string }) => {
    let url = '/accounting/ledger/trial-balance/excel';
    const query = new URLSearchParams();
    if (params?.fromDate) query.append('fromDate', params.fromDate);
    if (params?.toDate) query.append('toDate', params.toDate);
    const queryString = query.toString();
    if (queryString) url += '?' + queryString;

    await api.download(url, `Trial_Balance_${params?.toDate || new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const exportProfitLossExcel = async (params?: { fromDate?: string; toDate?: string }) => {
    let url = '/accounting/ledger/profit-loss/excel';
    const query = new URLSearchParams();
    if (params?.fromDate) query.append('fromDate', params.fromDate);
    if (params?.toDate) query.append('toDate', params.toDate);
    const queryString = query.toString();
    if (queryString) url += '?' + queryString;

    await api.download(url, `Profit_Loss_Statement_${params?.toDate || new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const exportBalanceSheetExcel = async (params?: { fromDate?: string; toDate?: string }) => {
    let url = '/accounting/ledger/balance-sheet/excel';
    const query = new URLSearchParams();
    if (params?.fromDate) query.append('fromDate', params.fromDate);
    if (params?.toDate) query.append('toDate', params.toDate);
    const queryString = query.toString();
    if (queryString) url += '?' + queryString;

    await api.download(url, `Balance_Sheet_${params?.toDate || new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const exportLedgerExcel = async (params: { accountHead: string; fromDate?: string; toDate?: string }) => {
    let url = '/accounting/ledger/excel';
    const query = new URLSearchParams();
    query.append('accountHead', params.accountHead);
    if (params.fromDate) query.append('fromDate', params.fromDate);
    if (params.toDate) query.append('toDate', params.toDate);
    url += '?' + query.toString();

    const safeHead = params.accountHead.replace(/[^a-zA-Z0-9]/g, '_');
    await api.download(url, `Ledger_${safeHead}_${params.toDate || new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const exportDrillDownPdf = async (type: string, params?: { fromDate?: string; toDate?: string }) => {
    let url = '/accounting/ledger/drilldown/pdf';
    const query = new URLSearchParams();
    query.append('type', type);
    if (params?.fromDate) query.append('fromDate', params.fromDate);
    if (params?.toDate) query.append('toDate', params.toDate);
    url += '?' + query.toString();

    const safeType = type.replace(/[^a-zA-Z0-9]/g, '_');
    await api.download(url, `DrillDown_${safeType}_${params?.toDate || new Date().toISOString().split('T')[0]}.pdf`);
  };

  const exportDrillDownExcel = async (type: string, params?: { fromDate?: string; toDate?: string }) => {
    let url = '/accounting/ledger/drilldown/excel';
    const query = new URLSearchParams();
    query.append('type', type);
    if (params?.fromDate) query.append('fromDate', params.fromDate);
    if (params?.toDate) query.append('toDate', params.toDate);
    url += '?' + query.toString();

    const safeType = type.replace(/[^a-zA-Z0-9]/g, '_');
    await api.download(url, `DrillDown_${safeType}_${params?.toDate || new Date().toISOString().split('T')[0]}.xlsx`);
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
    chartOfAccounts,
    fetchLedger,
    fetchAccountBalance,
    fetchTrialBalance,
    fetchVouchersSummary,
    fetchJournalSummary,
    fetchAccountTypeSummaries,
    fetchCOA,
    createVoucher,
    submitVoucher,
    createOpeningBalance,
    exportTrialBalancePdf,
    exportProfitLossPdf,
    exportBalanceSheetPdf,
    exportLedgerPdf,
    exportDrillDownPdf,
    exportTrialBalanceExcel,
    exportProfitLossExcel,
    exportBalanceSheetExcel,
    exportLedgerExcel,
    exportDrillDownExcel,
  };
};
