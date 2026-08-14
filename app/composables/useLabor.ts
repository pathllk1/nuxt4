import { ref } from 'vue';
import { useApi } from '../utils/api';

export const useLabor = () => {
  const api = useApi();
  const loading = ref(false);
  const leaders = ref<any[]>([]);
  const periods = ref<any[]>([]);
  const periodDetails = ref<any>(null);

  const fetchLeaders = async (firmId?: string) => {
    loading.value = true;
    try {
      const url = firmId ? `/labor/leaders?firm_id=${firmId}` : '/labor/leaders';
      const res = await api.get(url);
      if (res.success) {
        leaders.value = res.data;
      }
      return res;
    } finally {
      loading.value = false;
    }
  };

  const createLeader = async (data: any) => {
    loading.value = true;
    try {
      return await api.post('/labor/leaders', data);
    } finally {
      loading.value = false;
    }
  };

  const updateLeader = async (id: string, data: any) => {
    loading.value = true;
    try {
      return await api.put(`/labor/leaders/${id}`, data);
    } finally {
      loading.value = false;
    }
  };

  const deleteLeader = async (id: string) => {
    loading.value = true;
    try {
      return await api.delete(`/labor/leaders/${id}`);
    } finally {
      loading.value = false;
    }
  };

  const fetchPeriods = async (firmId?: string) => {
    loading.value = true;
    try {
      const url = firmId ? `/labor/periods?firm_id=${firmId}` : '/labor/periods';
      const res = await api.get(url);
      if (res.success) {
        periods.value = res.data;
      }
      return res;
    } finally {
      loading.value = false;
    }
  };

  const createPeriod = async (data: any) => {
    loading.value = true;
    try {
      return await api.post('/labor/periods', data);
    } finally {
      loading.value = false;
    }
  };

  const deletePeriod = async (id: string) => {
    loading.value = true;
    try {
      return await api.delete(`/labor/periods/${id}`);
    } finally {
      loading.value = false;
    }
  };

  const fetchPeriodDetails = async (id: string) => {
    loading.value = true;
    try {
      const res = await api.get(`/labor/periods/${id}/details`);
      if (res.success) {
        periodDetails.value = res.data;
      }
      return res;
    } finally {
      loading.value = false;
    }
  };

  const syncPeriodData = async (id: string, payload: any) => {
    loading.value = true;
    try {
      return await api.post(`/labor/periods/${id}/sync`, payload);
    } finally {
      loading.value = false;
    }
  };

  const payAdvance = async (payload: any) => {
    loading.value = true;
    try {
      return await api.post('/labor/payments/advance', payload);
    } finally {
      loading.value = false;
    }
  };

  const allocateAdvance = async (payload: any) => {
    loading.value = true;
    try {
      return await api.post('/labor/payments/allocate-advance', payload);
    } finally {
      loading.value = false;
    }
  };

  const settlePeriod = async (payload: any) => {
    loading.value = true;
    try {
      return await api.post('/labor/payments/settle', payload);
    } finally {
      loading.value = false;
    }
  };

  const exportPeriodExcel = async (id: string, leaderName: string) => {
    const safeName = String(leaderName).replace(/[^a-zA-Z0-9]/g, '_');
    await api.download(`/labor/export/${id}`, `Labor_Report_${safeName}.xlsx`);
  };

  return {
    loading,
    leaders,
    periods,
    periodDetails,
    fetchLeaders,
    createLeader,
    updateLeader,
    deleteLeader,
    fetchPeriods,
    createPeriod,
    deletePeriod,
    fetchPeriodDetails,
    syncPeriodData,
    payAdvance,
    allocateAdvance,
    settlePeriod,
    exportPeriodExcel
  };
};
