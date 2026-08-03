import { ref } from 'vue';
import { useApi } from '../utils/api';

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
  const api = useApi();
  const loading = ref(false);
  const error = ref<string | null>(null);
  const bills = ref<any[]>([]);
  const currentBill = ref<any>(null);
  const parties = ref<any[]>([]);

  const fetchBills = async (params?: any) => {
    loading.value = true;
    error.value = null;
    try {
      const response = await api.get('/accounting/bills', { params });
      if (response.success) {
        bills.value = response.data;
      }
    } catch (err: any) {
      error.value = err.message || 'Failed to fetch bills';
    } finally {
      loading.value = false;
    }
  };

  const fetchParties = async () => {
    try {
      const response = await api.get('/accounting/parties');
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
      const response = await api.post('/accounting/sales', data);
      return response.data || response;
    } catch (err: any) {
      error.value = err.message || 'Failed to create sales bill';
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const createPurchaseBill = async (data: any) => {
    loading.value = true;
    error.value = null;
    try {
      const response = await api.post('/accounting/purchases', data);
      return response.data || response;
    } catch (err: any) {
      error.value = err.message || 'Failed to create purchase bill';
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const updateSalesBill = async (id: string, data: any) => {
    loading.value = true;
    error.value = null;
    try {
      const response = await api.put(`/accounting/sales/${id}`, data);
      return response.data || response;
    } catch (err: any) {
      error.value = err.message || 'Failed to update sales bill';
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const updatePurchaseBill = async (id: string, data: any) => {
    loading.value = true;
    error.value = null;
    try {
      const response = await api.put(`/accounting/purchases/${id}`, data);
      return response.data || response;
    } catch (err: any) {
      error.value = err.message || 'Failed to update purchase bill';
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const createCreditNote = async (data: any) => {
    loading.value = true;
    error.value = null;
    try {
      const response = await api.post('/accounting/credit-notes', data);
      return response.data || response;
    } catch (err: any) {
      error.value = err.message || 'Failed to create credit note';
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const createDebitNote = async (data: any) => {
    loading.value = true;
    error.value = null;
    try {
      const response = await api.post('/accounting/debit-notes', data);
      return response.data || response;
    } catch (err: any) {
      error.value = err.message || 'Failed to create debit note';
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const cancelBill = async (id: string, reason?: string) => {
    loading.value = true;
    error.value = null;
    try {
      const response = await api.post(`/accounting/bills/${id}/cancel`, { reason });
      return response;
    } catch (err: any) {
      error.value = err.message || 'Failed to cancel bill';
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const getBillDetails = async (id: string) => {
    loading.value = true;
    error.value = null;
    try {
      const response = await api.get(`/accounting/bills/${id}`);
      if (response.success) {
        currentBill.value = response.data;
      }
      return response.data;
    } catch (err: any) {
      error.value = err.message || 'Failed to fetch bill details';
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const calculateTotals = (cart: BillItem[], otherCharges: OtherCharge[], gstType: 'intra-state' | 'inter-state', reverseCharge = false) => {
    let grossTotal = 0;
    let totalTax = 0;

    cart.forEach(item => {
      const lineVal = item.qty * item.rate * (1 - (item.disc || 0) / 100);
      totalTax += lineVal * (item.grate / 100);
      grossTotal += lineVal;
    });

    let otherChargesTotal = 0;
    let otherChargesGstTotal = 0;
    otherCharges.forEach(charge => {
      const amt = parseFloat(charge.amount as any) || 0;
      otherChargesTotal += amt;
      otherChargesGstTotal += (amt * (charge.grate || 0)) / 100;
    });
    grossTotal += otherChargesTotal;

    let cgst = 0, sgst = 0, igst = 0;
    if (gstType === 'intra-state') {
      cgst = (totalTax / 2) + (otherChargesGstTotal / 2);
      sgst = (totalTax / 2) + (otherChargesGstTotal / 2);
    } else {
      igst = totalTax + otherChargesGstTotal;
    }

    const netTotalBeforeRoundOff = grossTotal + (reverseCharge ? 0 : cgst + sgst + igst);
    const netTotal = Math.round(netTotalBeforeRoundOff);
    const roundOff = netTotal - netTotalBeforeRoundOff;

    return { grossTotal, totalTax, cgst, sgst, igst, netTotal, roundOff };
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
    updateSalesBill,
    createPurchaseBill,
    updatePurchaseBill,
    createCreditNote,
    createDebitNote,
    cancelBill,
    getBillDetails,
    calculateTotals,
  };
};
