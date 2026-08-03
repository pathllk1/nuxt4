import { ref } from 'vue';
import { useApi } from '../utils/api';

export const useGst = () => {
  const api = useApi();
  const loading = ref(false);
  const error = ref<string | null>(null);
  const currentGSTR1 = ref<any>(null);
  const currentGSTR3B = ref<any>(null);
  const validationReport = ref<any>(null);

  const fetchGSTR1 = async (params: { startDate: string; endDate: string; firmGstin: string }) => {
    loading.value = true;
    error.value = null;
    try {
      const response = await api.get('/accounting/gst/gstr1/report', { params });
      if (response.success) {
        currentGSTR1.value = response.data;
        validationReport.value = response.data.validation || null;
      } else {
        error.value = response.error || 'Failed to fetch GSTR-1 report';
      }
    } catch (err: any) {
      error.value = err.message || 'Failed to fetch GSTR-1 report';
    } finally {
      loading.value = false;
    }
  };

  const fetchGSTR3B = async (params: { startDate: string; endDate: string; firmGstin: string }) => {
    loading.value = true;
    error.value = null;
    try {
      const response = await api.get('/accounting/gst/gstr3b/report', { params });
      if (response.success) {
        currentGSTR3B.value = response.data;
      } else {
        error.value = response.error || 'Failed to fetch GSTR-3B report';
      }
    } catch (err: any) {
      error.value = err.message || 'Failed to fetch GSTR-3B report';
    } finally {
      loading.value = false;
    }
  };

  const validateGSTR1 = async (params: { startDate: string; endDate: string; firmGstin: string }) => {
    loading.value = true;
    error.value = null;
    try {
      const response = await api.get('/accounting/gst/gstr1/validate', { params });
      if (response.success) {
        validationReport.value = response.data;
      } else {
        error.value = response.error || 'Failed to validate GSTR-1';
      }
    } catch (err: any) {
      error.value = err.message || 'Failed to validate GSTR-1';
    } finally {
      loading.value = false;
    }
  };

  const exportGSTR1JSON = async (params: { startDate: string; endDate: string; firmGstin: string }) => {
    const url = `/accounting/gst/gstr1/export/json?firmGstin=${params.firmGstin}&startDate=${params.startDate}&endDate=${params.endDate}`;
    await api.download(url, `GSTR1_${params.firmGstin}_${params.startDate}_${params.endDate}.json`);
  };

  const exportGSTR1Excel = async (params: { startDate: string; endDate: string; firmGstin: string }) => {
    const url = `/accounting/gst/gstr1/export/excel?firmGstin=${params.firmGstin}&startDate=${params.startDate}&endDate=${params.endDate}`;
    await api.download(url, `GSTR1_${params.firmGstin}_${params.startDate}_${params.endDate}.xlsx`);
  };

  const exportGSTR1PDF = async (params: { startDate: string; endDate: string; firmGstin: string }) => {
    const url = `/accounting/gst/gstr1/export/pdf?firmGstin=${params.firmGstin}&startDate=${params.startDate}&endDate=${params.endDate}`;
    await api.download(url, `GSTR1_${params.firmGstin}_${params.startDate}.pdf`);
  };

  const exportGSTR3BPDF = async (params: { startDate: string; endDate: string; firmGstin: string }) => {
    const url = `/accounting/gst/gstr3b/export/pdf?firmGstin=${params.firmGstin}&startDate=${params.startDate}&endDate=${params.endDate}`;
    await api.download(url, `GSTR3B_${params.firmGstin}_${params.startDate}.pdf`);
  };

  return {
    loading,
    error,
    currentGSTR1,
    currentGSTR3B,
    validationReport,
    fetchGSTR1,
    fetchGSTR3B,
    validateGSTR1,
    exportGSTR1JSON,
    exportGSTR1Excel,
    exportGSTR1PDF,
    exportGSTR3BPDF,
  };
};
