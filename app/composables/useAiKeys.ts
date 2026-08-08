import { ref } from 'vue';
import { indexedDb } from '../utils/indexedDb';
import { api } from '../utils/api';

export interface StoredKey {
  provider: string;
  apiKey: string;
  updatedAt: string;
}

export const useAiKeys = () => {
  const storeName = 'ai_api_keys';
  const isValidating = ref(false);

  const getKey = async (provider: string): Promise<string | null> => {
    try {
      const keys = await indexedDb.getAll<StoredKey>(storeName);
      const key = keys.find(k => k.provider === provider);
      return key ? key.apiKey : null;
    } catch {
      return null;
    }
  };

  const saveKey = async (provider: string, apiKey: string): Promise<void> => {
    await indexedDb.put(storeName, {
      provider,
      apiKey,
      updatedAt: new Date().toISOString()
    });
  };

  const removeKey = async (provider: string): Promise<void> => {
    await indexedDb.delete(storeName, provider);
  };

  const listProviders = async (): Promise<string[]> => {
    try {
      const keys = await indexedDb.getAll<StoredKey>(storeName);
      return keys.map(k => k.provider);
    } catch {
      return [];
    }
  };

  const hasKey = async (provider: string): Promise<boolean> => {
    const key = await getKey(provider);
    return !!key;
  };

  const validateKey = async (provider: string, apiKey: string): Promise<boolean> => {
    isValidating.value = true;
    try {
      const result = await api.post('/ai-chat/validate-key', { provider, apiKey });
      return result?.data?.valid === true;
    } catch {
      return false;
    } finally {
      isValidating.value = false;
    }
  };

  return {
    isValidating,
    getKey,
    saveKey,
    removeKey,
    listProviders,
    hasKey,
    validateKey,
  };
};
