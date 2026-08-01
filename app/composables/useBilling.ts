import { ref } from 'vue';

export interface BillItem {
  stockId: string;
  item: string;
  hsn: string;
  qty: number;
  uom: string;
  rate: number;
  grate: number;
  disc: number;
  total?: number;
  itemType?: 'GOODS' | 'SERVICE';
  batch?: string;
}

export interface OtherCharge {
  name: string;
  amount: number;
  grate: number;
  type?: string;
  hsnSac?: string;
}

export const useBilling = () => {
  const loading = ref(false);
  const error = ref<string | null>(null);
  const bills = ref<any[]>([]);
  const currentBill = ref<any>(null);
  const parties = ref<any[]>([]);

  const fetchBills = async (params?: any) => {
    loading.value = true;
    error.value = null;
    try {
      const response = await $fetch<{ success: boolean; data: any[] }>('/api/accounting/bills', { query: params });
      if (response.success) {
        bills.value = response.data;
      }
    } catch (err: any) {
      error.value = err.data?.message || err.message || 'Failed to fetch bills';
    } finally {
      loading.value = false;
    }
  };

  const fetchParties = async () => {
    try {
      const response = await $fetch<{ success: boolean; data: any[] }>('/api/accounting/parties');
      if (response.success) {
        parties.value = response.data;
      }
    } catch (err) {
      console.warn('Failed to fetch parties');
    }
  };

  const createSalesBill = async (data: any) => {
    loading.value = true;
    error.value = null;
    try {
      const response = await $fetch<{ success: boolean; data: any }>('/api/accounting/sales', {
        method: 'POST',
        body: data,
      });
      return response;
    } catch (err: any) {
      error.value = err.data?.message || err.message || 'Failed to create sales bill';
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const createPurchaseBill = async (data: any) => {
    loading.value = true;
    error.value = null;
    try {
      const response = await $fetch<{ success: boolean; data: any }>('/api/accounting/purchases', {
        method: 'POST',
        body: data,
      });
      return response;
    } catch (err: any) {
      error.value = err.data?.message || err.message || 'Failed to create purchase bill';
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const cancelBill = async (id: string, reason?: string) => {
    loading.value = true;
    error.value = null;
    try {
      const response = await $fetch<{ success: boolean; message: string }>(`/api/accounting/bills/${id}/cancel`, {
        method: 'POST',
        body: { reason },
      });
      return response;
    } catch (err: any) {
      error.value = err.data?.message || err.message || 'Failed to cancel bill';
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const getBillDetails = async (id: string) => {
    loading.value = true;
    error.value = null;
    try {
      const response = await $fetch<{ success: boolean; data: any }>(`/api/accounting/bills/${id}`);
      if (response.success) {
        currentBill.value = response.data;
      }
      return response.data;
    } catch (err: any) {
      error.value = err.data?.message || err.message || 'Failed to fetch bill details';
      throw err;
    } finally {
      loading.value = false;
    }
  };

  return {
    loading,
    error,
    bills,
    currentBill,
    parties,
    fetchBills,
    fetchParties,
    createSalesBill,
    createPurchaseBill,
    cancelBill,
    getBillDetails,
  };
};
