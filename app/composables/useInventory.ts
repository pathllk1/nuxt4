import { ref } from 'vue';
import { useApi } from '@/utils/api';

export interface Stock {
  id: string;
  _id?: string;
  item: string;
  hsn: string;
  pno?: string;
  oem?: string;
  qty: number;
  uom: string;
  rate: number;
  grate: number;
  total: number;
  mrp?: number;
  batches: any[];
}

export interface StockMovement {
  id?: string;
  _id?: string;
  type: string;
  bno?: string;
  bdate?: string;
  supply?: string;
  item: string;
  batch?: string;
  qty: number;
  uom?: string;
  rate?: number;
  total?: number;
  qtyh: number;
  createdAt: string;
}

export const useInventory = () => {
  const api = useApi();
  const loading = ref(false);
  const error = ref<string | null>(null);
  const stocks = ref<Stock[]>([]);
  const movements = ref<StockMovement[]>([]);
  const serviceSuggestions = ref<any[]>([]);

  const fetchStocks = async () => {
    loading.value = true;
    error.value = null;
    try {
      const response = await api.get('/inventory/stock');
      if (response.success) {
        stocks.value = response.data;
      }
    } catch (err: any) {
      error.value = err.message || 'Failed to fetch stocks';
    } finally {
      loading.value = false;
    }
  };

  const fetchMovements = async (params: { type?: string; stockId?: string; page?: number; limit?: number }) => {
    loading.value = true;
    error.value = null;
    try {
      const response = await api.get('/inventory/movements', { params });
      if (response.success) {
        movements.value = response.data;
      }
    } catch (err: any) {
      error.value = err.message || 'Failed to fetch movements';
    } finally {
      loading.value = false;
    }
  };

  const fetchServiceSuggestions = async () => {
    try {
      const response = await api.get('/inventory/stock/service-suggestions');
      if (response.success) {
        serviceSuggestions.value = response.data;
      }
    } catch (err: any) {
      console.warn('Failed to fetch service suggestions:', err);
    }
  };

  const createMovement = async (data: any) => {
    loading.value = true;
    error.value = null;
    try {
      const response = await api.post('/inventory/movements', data);
      return response;
    } catch (err: any) {
      error.value = err.message || 'Failed to record movement';
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const updateStock = async (id: string, data: any) => {
    loading.value = true;
    error.value = null;
    try {
      const response = await api.put(`/inventory/stock/${id}`, data);
      return response;
    } catch (err: any) {
      error.value = err.message || 'Failed to update stock';
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const fetchStockValuation = async () => {
    loading.value = true;
    error.value = null;
    try {
      const response = await api.get('/inventory/stock/valuation');
      return response;
    } catch (err: any) {
      error.value = err.message || 'Failed to fetch valuation';
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const fetchSalesAnalysis = async (params: { startDate?: string; endDate?: string }) => {
    loading.value = true;
    error.value = null;
    try {
      const response = await api.get('/inventory/stock/sales-analysis', { params });
      return response;
    } catch (err: any) {
      error.value = err.message || 'Failed to fetch sales analysis';
      throw err;
    } finally {
      loading.value = false;
    }
  };

  return {
    loading,
    error,
    stocks,
    movements,
    serviceSuggestions,
    fetchStocks,
    fetchMovements,
    fetchServiceSuggestions,
    createMovement,
    updateStock,
    fetchStockValuation,
    fetchSalesAnalysis,
  };
};
