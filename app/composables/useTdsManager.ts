import { ref, reactive, computed } from 'vue';
import { useApi } from '../utils/api';

export interface ITdsItem {
  id: string;
  voucherGroupId: string;
  voucherNo: string;
  voucherType: string;
  transactionDate: string;
  section: string;
  payeeName: string;
  payeeType: string;
  panNumber: string;
  isPanValid: boolean;
  panEntityType: string;
  grossAmount: number;
  tdsRate: number;
  tdsAmount: number;
  netAmount: number;
  isGrossUp: boolean;
  bankAccountName: string;
  bankAccountNumber?: string;
  paymentMode: string;
  narration: string;
  challanStatus: 'PENDING' | 'DEPOSITED';
}

export interface ITdsSummaryMetrics {
  totalGross: number;
  totalTds: number;
  totalNet: number;
  totalDeductees: number;
  validPanCount: number;
  missingPanCount: number;
  panComplianceRate: number;
  sectionBreakdown: Record<string, { count: number; gross: number; tds: number }>;
  quarterBreakdown: Record<string, { count: number; gross: number; tds: number }>;
}

export interface ITdsRegisterData {
  financialYear: string;
  quarter: string;
  fromDate: string;
  toDate: string;
  metrics: ITdsSummaryMetrics;
  items: ITdsItem[];
}

export const useTdsManager = () => {
  const api = useApi();
  const loading = ref(false);
  const exportLoading = ref(false);
  const error = ref<string | null>(null);
  const registerData = ref<ITdsRegisterData | null>(null);

  // Financial Year generator
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const currentFyStart = currentMonth >= 4 ? currentYear : currentYear - 1;
  const defaultFy = `${currentFyStart}-${String(currentFyStart + 1).slice(-2)}`;

  const financialYearOptions = [
    defaultFy,
    `${currentFyStart - 1}-${String(currentFyStart).slice(-2)}`,
    `${currentFyStart - 2}-${String(currentFyStart - 1).slice(-2)}`,
  ];

  const quarterOptions = [
    { label: 'Full Year (All Quarters)', value: 'ALL' },
    { label: 'Q1 (Apr – Jun)', value: 'Q1' },
    { label: 'Q2 (Jul – Sep)', value: 'Q2' },
    { label: 'Q3 (Oct – Dec)', value: 'Q3' },
    { label: 'Q4 (Jan – Mar)', value: 'Q4' }
  ];

  const sectionOptions = [
    { label: 'All Sections', value: 'ALL' },
    { label: 'Sec 194C (Contractors / Subcontractors)', value: '194C' },
    { label: 'Sec 194J (Professional & Technical Fees)', value: '194J' },
    { label: 'Sec 194I (Rent on Land / Building)', value: '194I' },
    { label: 'Sec 194H (Commission & Brokerage)', value: '194H' },
    { label: 'Sec 194Q (Purchase of Goods)', value: '194Q' }
  ];

  const filters = reactive({
    financialYear: defaultFy,
    quarter: 'ALL',
    section: 'ALL',
    fromDate: '',
    toDate: '',
    search: ''
  });

  const fetchRegister = async () => {
    loading.value = true;
    error.value = null;
    try {
      const params: Record<string, string> = {
        financialYear: filters.financialYear,
        quarter: filters.quarter,
        section: filters.section
      };

      if (filters.fromDate) params.fromDate = filters.fromDate;
      if (filters.toDate) params.toDate = filters.toDate;
      if (filters.search) params.search = filters.search;

      const res = await api.get('/accounting/tds/register', { params });
      if (res.success && res.data) {
        registerData.value = res.data;
      } else {
        error.value = res.error || 'Failed to load TDS register';
      }
    } catch (err: any) {
      error.value = err.message || 'Error communicating with TDS service';
      console.error('TDS Register error:', err);
    } finally {
      loading.value = false;
    }
  };

  const exportExcel = async () => {
    exportLoading.value = true;
    try {
      const queryParams = new URLSearchParams();
      if (filters.financialYear) queryParams.set('financialYear', filters.financialYear);
      if (filters.quarter) queryParams.set('quarter', filters.quarter);
      if (filters.section) queryParams.set('section', filters.section);
      if (filters.fromDate) queryParams.set('fromDate', filters.fromDate);
      if (filters.toDate) queryParams.set('toDate', filters.toDate);
      if (filters.search) queryParams.set('search', filters.search);

      const url = `/api/accounting/tds/export/excel?${queryParams.toString()}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to download TDS export');
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `TDS_Register_Form26Q_${filters.financialYear}_${filters.quarter}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err: any) {
      console.error('Excel Export Error:', err);
      alert('Failed to export Excel: ' + (err.message || 'Server error'));
    } finally {
      exportLoading.value = false;
    }
  };

  const metrics = computed(() => {
    return registerData.value?.metrics || {
      totalGross: 0,
      totalTds: 0,
      totalNet: 0,
      totalDeductees: 0,
      validPanCount: 0,
      missingPanCount: 0,
      panComplianceRate: 100,
      sectionBreakdown: {},
      quarterBreakdown: {}
    };
  });

  const items = computed(() => registerData.value?.items || []);

  return {
    filters,
    loading,
    exportLoading,
    error,
    registerData,
    metrics,
    items,
    financialYearOptions,
    quarterOptions,
    sectionOptions,
    fetchRegister,
    exportExcel
  };
};

