import { ref } from 'vue';
import { useApi } from '../utils/api';

export interface BankAccount {
  _id: string;
  account_name: string;
  account_holder_name?: string;
  bank_name: string;
  account_number: string;
  account_type: 'SAVINGS' | 'CURRENT' | 'OD' | 'CC' | 'OTHER';
  is_default: boolean;
  status: 'ACTIVE' | 'INACTIVE';
}

export const useBanking = () => {
  const api = useApi();
  const loading = ref(false);
  const error = ref<string | null>(null);
  const bankAccounts = ref<BankAccount[]>([]);

  const fetchBankAccounts = async () => {
    loading.value = true;
    error.value = null;
    try {
      const response = await api.get('/banking');
      if (response.success) {
        bankAccounts.value = response.data;
      }
    } catch (err: any) {
      error.value = err.message || 'Failed to fetch bank accounts';
      console.error('Failed to fetch bank accounts', err);
    } finally {
      loading.value = false;
    }
  };

  const getDefaultBankAccount = () => {
    return bankAccounts.value.find(acc => acc.is_default);
  };

  return {
    loading,
    error,
    bankAccounts,
    fetchBankAccounts,
    getDefaultBankAccount,
  };
};
