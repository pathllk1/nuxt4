import { ref } from 'vue';
import { useAuth } from './useAuth';

export interface DocumentItem {
  id: string;
  firm_id: string;
  user_id: string;
  name: string;
  reference_number: string;
  description: string | null;
  start_date: string | null;
  original_expiry_date: string;
  closed_date: string | null;
  extended_expiry_date: string | null;
  value: number | string;
  status: string;
  computed_status?: string;
  file_url: string | null;
  file_name: string | null;
  file_size: number | null;
  file_type: string | null;
  created_at: string;
}

export const useDocuments = () => {
  const { apiFetch } = useAuth();
  const loading = ref(false);
  const documents = ref<DocumentItem[]>([]);

  const fetchDocuments = async (search = '', sort = 'expiry_date', order = 'asc') => {
    loading.value = true;
    try {
      const queryParams = new URLSearchParams();
      if (search) queryParams.append('search', search);
      if (sort) queryParams.append('sort', sort);
      if (order) queryParams.append('order', order);

      const response = await apiFetch(`/api/documents?${queryParams.toString()}`);
      if (response.success) {
        documents.value = response.data;
      }
      return response;
    } finally {
      loading.value = false;
    }
  };

  const createDocument = async (formData: FormData) => {
    loading.value = true;
    try {
      return await apiFetch('/api/documents', {
        method: 'POST',
        body: formData
      });
    } finally {
      loading.value = false;
    }
  };

  const updateDocument = async (id: string, formData: FormData) => {
    loading.value = true;
    try {
      return await apiFetch(`/api/documents/${id}`, {
        method: 'PUT',
        body: formData
      });
    } finally {
      loading.value = false;
    }
  };

  const deleteDocument = async (id: string) => {
    loading.value = true;
    try {
      return await apiFetch(`/api/documents/${id}`, {
        method: 'DELETE'
      });
    } finally {
      loading.value = false;
    }
  };

  const sendNotifications = async () => {
    loading.value = true;
    try {
      return await apiFetch('/api/documents/send-notifications', {
        method: 'POST'
      });
    } finally {
      loading.value = false;
    }
  };

  return {
    loading,
    documents,
    fetchDocuments,
    createDocument,
    updateDocument,
    deleteDocument,
    sendNotifications
  };
};
