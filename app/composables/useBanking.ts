import { ref } from 'vue';

export interface BankAccount {
  _id?: string;
  account_name: string;
  account_number: string;
  ifsc_code: string;
  bank_name: string;
  branch?: string;
  account_type: 'SAVINGS' | 'CURRENT' | 'OVERDRAFT';
  opening_balance: number;
  current_balance?: number;
  is_active?: boolean;
}

export const useBanking = () => {
  const loading = ref(false);
  const error = ref<string | null>(null);
  const bankAccounts = ref<BankAccount[]>([]);
  const liquidBalance = ref(0);

  const fetchBankAccounts = async () => {
    loading.value = true;
    error.value = null;
    try {
      const response = await $fetch<{ success: boolean; data: BankAccount[]; liquidBalance?: number }>('/api/banking');
      if (response.success) {
        bankAccounts.value = response.data || [];
        liquidBalance.value = response.liquidBalance || 0;
      }
    } catch (err: any) {
      error.value = err.data?.message || err.message || 'Failed to fetch bank accounts';
    } finally {
      loading.value = false;
    }
  };

  const saveBankAccount = async (data: BankAccount) => {
    loading.value = true;
    error.value = null;
    try {
      const response = await $fetch<{ success: boolean; data: BankAccount }>('/api/banking', {
        method: 'POST',
        body: data,
      });
      await fetchBankAccounts();
      return response;
    } catch (err: any) {
      error.value = err.data?.message || err.message || 'Failed to save bank account';
      throw err;
    } finally {
      loading.value = false;
    }
  };

  return {
    loading,
    error,
    bankAccounts,
    liquidBalance,
    fetchBankAccounts,
    saveBankAccount,
  };
};
