import { useState } from '#app';
import { useAuth } from './useAuth';

export interface SubcontractorSlip {
  _id?: string;
  expenseDate: string;
  category: 'LABOR' | 'MATERIAL' | 'FUEL_DIESEL' | 'MACHINERY_RENTAL' | 'TRANSPORT' | 'FOOD_WELFARE' | 'REPAIRS' | 'OTHER';
  amount: number;
  paymentMode: 'CASH' | 'UPI' | 'BANK';
  vendorOrPayee?: string;
  notes?: string;
  billOrSlipRef?: string;
  projectId?: string;
  createdAt?: string;
}

export const useSubcontractorWallet = () => {
  const { apiFetch } = useAuth();

  const walletData = useState<any>('subcon_wallet_data', () => null);
  const expensesList = useState<SubcontractorSlip[]>('subcon_expenses_list', () => []);
  const pagination = useState<any>('subcon_expenses_pagination', () => ({ page: 1, limit: 30, totalCount: 0 }));
  const isLoading = useState<boolean>('subcon_wallet_loading', () => false);
  const error = useState<string | null>('subcon_wallet_error', () => null);

  const fetchWallet = async () => {
    isLoading.value = true;
    error.value = null;
    try {
      const response = await apiFetch<any>('/api/subcontractor/wallet');
      if (response && response.success) {
        walletData.value = response;
      }
      return response;
    } catch (err: any) {
      error.value = err?.data?.statusMessage || err?.message || 'Failed to load wallet';
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  const fetchExpenses = async (params: Record<string, any> = {}) => {
    isLoading.value = true;
    error.value = null;
    try {
      const queryString = new URLSearchParams(params as any).toString();
      const url = `/api/subcontractor/expenses${queryString ? `?${queryString}` : ''}`;
      const response = await apiFetch<any>(url);
      if (response && response.success) {
        expensesList.value = response.expenses || [];
        pagination.value = response.pagination;
      }
      return response;
    } catch (err: any) {
      error.value = err?.data?.statusMessage || err?.message || 'Failed to load slips';
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  const addSlip = async (slipData: Partial<SubcontractorSlip>) => {
    isLoading.value = true;
    error.value = null;
    try {
      const response = await apiFetch<any>('/api/subcontractor/expenses', {
        method: 'POST',
        body: slipData
      });
      // Refresh wallet & list
      await fetchWallet();
      return response;
    } catch (err: any) {
      error.value = err?.data?.statusMessage || err?.message || 'Failed to save slip';
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  const updateSlip = async (id: string, slipData: Partial<SubcontractorSlip>) => {
    isLoading.value = true;
    error.value = null;
    try {
      const response = await apiFetch<any>(`/api/subcontractor/expenses/${id}`, {
        method: 'PUT',
        body: slipData
      });
      await fetchWallet();
      return response;
    } catch (err: any) {
      error.value = err?.data?.statusMessage || err?.message || 'Failed to update slip';
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  const deleteSlip = async (id: string) => {
    isLoading.value = true;
    error.value = null;
    try {
      const response = await apiFetch<any>(`/api/subcontractor/expenses/${id}`, {
        method: 'DELETE'
      });
      await fetchWallet();
      return response;
    } catch (err: any) {
      error.value = err?.data?.statusMessage || err?.message || 'Failed to delete slip';
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  return {
    walletData,
    expensesList,
    pagination,
    isLoading,
    error,
    fetchWallet,
    fetchExpenses,
    addSlip,
    updateSlip,
    deleteSlip
  };
};
