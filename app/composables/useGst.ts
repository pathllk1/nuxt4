import { ref } from 'vue';

export const useGst = () => {
  const loading = ref(false);
  const error = ref<string | null>(null);
  const currentGSTR1 = ref<any>(null);
  const currentGSTR3B = ref<any>(null);
  const validationReport = ref<any>(null);

  const fetchGSTR1 = async (params: { startDate: string; endDate: string; firmGstin?: string }) => {
    loading.value = true;
    error.value = null;
    try {
      const response = await $fetch<{ success: boolean; data: any }>('/api/gst/gstr1/report', { query: params });
      if (response.success) {
        currentGSTR1.value = response.data;
      }
    } catch (err: any) {
      error.value = err.data?.message || err.message || 'Failed to fetch GSTR-1 report';
    } finally {
      loading.value = false;
    }
  };

  const fetchGSTR3B = async (params: { startDate: string; endDate: string; firmGstin?: string }) => {
    loading.value = true;
    error.value = null;
    try {
      const response = await $fetch<{ success: boolean; data: any }>('/api/gst/gstr3b/report', { query: params });
      if (response.success) {
        currentGSTR3B.value = response.data;
      }
    } catch (err: any) {
      error.value = err.data?.message || err.message || 'Failed to fetch GSTR-3B report';
    } finally {
      loading.value = false;
    }
  };

  const exportGSTR1JSON = (params: { startDate: string; endDate: string; firmGstin?: string }) => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(currentGSTR1.value, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `GSTR1_${params.firmGstin || 'REPORT'}_${params.startDate}_${params.endDate}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return {
    loading,
    error,
    currentGSTR1,
    currentGSTR3B,
    validationReport,
    fetchGSTR1,
    fetchGSTR3B,
    exportGSTR1JSON,
  };
};
