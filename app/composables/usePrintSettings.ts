import { ref, reactive } from 'vue';
import { api } from '@/utils/api';

export interface PrintConfig {
  showHsn: boolean;
  showQty: boolean;
  showUom: boolean;
  showRate: boolean;
  showDisc: boolean;
  showGst: boolean;
  showBatch: boolean;
  showNarration: boolean;
  showBank: boolean;
  defaultBankAccountId: string;
  jurisdiction: string;
  terms: string[];
  declaration: string;
  signatoryTitle: string;
  defaultCopyType: string;
}

export interface BankAccountOption {
  _id: string;
  account_name: string;
  account_holder_name?: string;
  bank_name: string;
  branch_name?: string;
  account_number: string;
  ifsc_code: string;
  upi_id?: string;
  is_default?: boolean;
}

const LOCAL_STORAGE_KEY = 'erp_print_config_terminal';

export function usePrintSettings() {
  const loading = ref(false);
  const saving = ref(false);
  const bankAccounts = ref<BankAccountOption[]>([]);
  const firmInfo = ref<any>(null);

  const printConfig = reactive<PrintConfig>({
    showHsn: true,
    showQty: true,
    showUom: true,
    showRate: true,
    showDisc: true,
    showGst: true,
    showBatch: true,
    showNarration: true,
    showBank: true,
    defaultBankAccountId: '',
    jurisdiction: 'Subject to local jurisdiction only.',
    terms: [
      '1. Goods once sold will not be taken back.',
      '2. Subject to local jurisdiction only.',
      '3. E. & O.E.'
    ],
    declaration: 'Certified that the particulars given above are true and correct.',
    signatoryTitle: 'Authorised Signatory',
    defaultCopyType: 'ORIGINAL FOR RECIPIENT'
  });

  // Load from local storage cache first for instant UI response
  function loadFromLocalCache() {
    try {
      if (typeof window !== 'undefined') {
        const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          Object.assign(printConfig, parsed);
        }
      }
    } catch (e) {
      console.warn('Error reading print config from local storage:', e);
    }
  }

  // Fetch official settings from Server
  async function fetchPrintSettings() {
    loadFromLocalCache();
    loading.value = true;
    try {
      const res = await api.get('/accounting/print-settings');
      if (res && res.data) {
        if (res.data.printConfig) {
          // Merge server settings (server takes priority unless user had terminal overrides)
          Object.assign(printConfig, res.data.printConfig);
          // Sync to local storage
          if (typeof window !== 'undefined') {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(printConfig));
          }
        }
        if (res.data.bankAccounts) {
          bankAccounts.value = res.data.bankAccounts;
        }
        if (res.data.firm) {
          firmInfo.value = res.data.firm;
        }
      }
    } catch (err) {
      console.error('Error fetching print settings:', err);
    } finally {
      loading.value = false;
    }
  }

  // Save settings to Server and Local Storage
  async function savePrintSettings(customConfig?: Partial<PrintConfig>) {
    saving.value = true;
    try {
      const payload = customConfig ? { ...printConfig, ...customConfig } : { ...printConfig };
      await api.post('/accounting/print-settings', payload);
      Object.assign(printConfig, payload);
      if (typeof window !== 'undefined') {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(printConfig));
      }
      return true;
    } catch (err) {
      console.error('Error saving print settings:', err);
      return false;
    } finally {
      saving.value = false;
    }
  }

  // Helper to build query parameters for PDF URLs
  function buildPdfQueryParams(overrides?: Partial<PrintConfig> & { copyType?: string; bankAccountId?: string }): Record<string, string> {
    const active = { ...printConfig, ...(overrides || {}) };
    return {
      showHsn: String(active.showHsn),
      showQty: String(active.showQty),
      showUom: String(active.showUom),
      showRate: String(active.showRate),
      showDisc: String(active.showDisc),
      showGst: String(active.showGst),
      showBatch: String(active.showBatch),
      showNarration: String(active.showNarration),
      showBank: String(active.showBank),
      bankAccountId: overrides?.bankAccountId || active.defaultBankAccountId || '',
      jurisdiction: active.jurisdiction || '',
      copyType: overrides?.copyType || active.defaultCopyType || '',
      signatoryTitle: active.signatoryTitle || '',
    };
  }

  return {
    printConfig,
    bankAccounts,
    firmInfo,
    loading,
    saving,
    fetchPrintSettings,
    savePrintSettings,
    buildPdfQueryParams
  };
}
