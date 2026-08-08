import { ref, computed } from 'vue';
import { api, useApi } from '../utils/api';
import { indexedDb } from '../utils/indexedDb';
import { useAiKeys } from './useAiKeys';

export interface Conversation {
  id: string;
  title: string;
  provider: string;
  model: string;
  is_pinned: boolean;
  message_count: number;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  provider?: string;
  model?: string;
  tokens_used?: number;
  created_at: string;
  webSearchUsed?: boolean;
  searchSources?: Array<{ title: string; url: string }>;
}

export interface ProviderInfo {
  id: string;
  name: string;
}

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  isFree: boolean;
  contextWindow?: number;
  description?: string;
}

const conversations = ref<Conversation[]>([]);
const activeConversation = ref<Conversation | null>(null);
const messages = ref<Message[]>([]);

const isLoading = ref(false);
const isStreaming = ref(false);
const streamingContent = ref('');

const error = ref<string | null>(null);
const rateLimitError = ref<any>(null);

const providers = ref<ProviderInfo[]>([]);
const models = ref<ModelInfo[]>([]);
const selectedProvider = ref('gemini');
const selectedModel = ref('');
const searchQuery = ref('');
const searchMode = ref<'auto' | 'force' | 'never'>('auto');

let abortController: AbortController | null = null;

export const useAiChat = () => {
  const aiKeys = useAiKeys();
  const apiUtils = useApi();

  const filteredConversations = computed(() => {
    const query = searchQuery.value.toLowerCase();
    if (!query) return conversations.value;
    return conversations.value.filter(c => c.title.toLowerCase().includes(query));
  });

  const freeModels = computed(() => models.value.filter(m => m.isFree));

  const getSetting = async (key: string): Promise<any> => {
    try {
      const res = await indexedDb.get<{ key: string; value: any }>('ai_settings', key);
      return res ? res.value : null;
    } catch {
      return null;
    }
  };

  const saveSetting = async (key: string, value: any): Promise<void> => {
    try {
      await indexedDb.put('ai_settings', { key, value, updatedAt: new Date().toISOString() });
    } catch (err) {
      console.error('Failed to save setting to IndexedDB:', err);
    }
  };

  const fetchProviders = async () => {
    try {
      const result = await api.get('/ai-chat/providers');
      providers.value = result?.data || [];
    } catch (err: any) {
      console.error('Failed to fetch providers:', err.message);
    }
  };

  const fetchModels = async (provider?: string) => {
    const p = provider || selectedProvider.value;
    const apiKey = await aiKeys.getKey(p);

    if (!apiKey) {
      models.value = [];
      return;
    }

    try {
      const result = await api.get(`/ai-chat/models/${p}`, { params: { apiKey } });
      const fetchedModels = result?.data || [];
      models.value = fetchedModels;

      const savedModel = await getSetting(`lastModel_${p}`);
      if (savedModel && fetchedModels.some((m: any) => m.id === savedModel)) {
        selectedModel.value = savedModel;
      } else {
        const preferred = fetchedModels.find((m: any) =>
          m.id.toLowerCase().includes('llama-3.1-8b') ||
          m.id.toLowerCase().includes('llama-3') ||
          m.id.toLowerCase().includes('mixtral') ||
          m.id.toLowerCase().includes('gemini-1.5-flash')
        );
        const free = fetchedModels.find((m: any) => m.isFree);
        const fallback = preferred?.id || free?.id || fetchedModels[0]?.id || '';
        selectedModel.value = fallback;

        if (fallback) {
          await saveSetting(`lastModel_${p}`, fallback);
          await saveSetting('selectedModel', fallback);
        }
      }
    } catch (err: any) {
      console.error('Failed to fetch models:', err.message);
      models.value = [];
    }
  };

  const selectProvider = async (provider: string) => {
    selectedProvider.value = provider;
    selectedModel.value = '';
    models.value = [];
    await saveSetting('selectedProvider', provider);
    await fetchModels(provider);
  };

  const selectModel = async (modelId: string) => {
    selectedModel.value = modelId;
    if (modelId) {
      await saveSetting('selectedModel', modelId);
      await saveSetting(`lastModel_${selectedProvider.value}`, modelId);
    }
  };

  const fetchConversations = async () => {
    try {
      const result = await api.get('/ai-chat/conversations');
      const fetched = result?.data || [];
      for (const conv of fetched) {
        await indexedDb.put('ai_conversations', JSON.parse(JSON.stringify(conv)));
      }
    } catch (err: any) {
      console.error('Failed to fetch conversations from server, loading from IndexedDB:', err.message);
    }

    try {
      const stored = await indexedDb.getAll<Conversation>('ai_conversations');
      const sorted = stored.sort((a, b) => {
        if (a.is_pinned && !b.is_pinned) return -1;
        if (!a.is_pinned && b.is_pinned) return 1;
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      });
      conversations.value = sorted;
    } catch (dbErr: any) {
      console.error('Failed to load conversations from IndexedDB:', dbErr.message);
    }
  };

  const loadConversation = async (id: string) => {
    isLoading.value = true;
    error.value = null;
    try {
      const result = await api.get(`/ai-chat/conversations/${id}`);
      if (result?.data) {
        const conv = result.data.conversation;
        const msgs = result.data.messages || [];
        activeConversation.value = conv;
        messages.value = msgs;

        await indexedDb.put('ai_conversations', JSON.parse(JSON.stringify(conv)));
        await indexedDb.deleteMessagesByConversation(id);
        for (const msg of msgs) {
          await indexedDb.put('ai_messages', JSON.parse(JSON.stringify(msg)));
        }

        if (conv.provider) {
          selectedProvider.value = conv.provider;
          await saveSetting('selectedProvider', conv.provider);
        }
        if (conv.model) {
          selectedModel.value = conv.model;
          await saveSetting('selectedModel', conv.model);
          await saveSetting(`lastModel_${conv.provider}`, conv.model);
        }
      }
    } catch (err: any) {
      console.error('Failed to load conversation from server, loading from IndexedDB:', err.message);
      try {
        const localConv = await indexedDb.get<Conversation>('ai_conversations', id);
        if (localConv) {
          activeConversation.value = localConv;
          const localMsgs = await indexedDb.getMessagesByConversation(id);
          messages.value = localMsgs;

          if (localConv.provider) selectedProvider.value = localConv.provider;
          if (localConv.model) selectedModel.value = localConv.model;
        } else {
          error.value = 'Conversation not found locally or on server.';
        }
      } catch (dbErr: any) {
        error.value = dbErr.message;
      }
    } finally {
      isLoading.value = false;
    }
  };

  const startNewChat = () => {
    activeConversation.value = null;
    messages.value = [];
    streamingContent.value = '';
    error.value = null;
    rateLimitError.value = null;
  };

  const renameConversation = async (id: string, title: string) => {
    try {
      await api.patch(`/ai-chat/conversations/${id}`, { title });
    } catch (err: any) {
      console.error('Failed to rename on server:', err.message);
    }

    try {
      const conv = await indexedDb.get<Conversation>('ai_conversations', id);
      if (conv) {
        conv.title = title;
        conv.updated_at = new Date().toISOString();
        await indexedDb.put('ai_conversations', conv);
      }

      const index = conversations.value.findIndex(c => c.id === id);
      const existingConv = conversations.value[index];
      if (index !== -1 && existingConv) {
        conversations.value[index] = { ...existingConv, title, updated_at: new Date().toISOString() };
      }
      conversations.value = [...conversations.value].sort((a, b) => {
        if (a.is_pinned && !b.is_pinned) return -1;
        if (!a.is_pinned && b.is_pinned) return 1;
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      });

      if (activeConversation.value && activeConversation.value.id === id) {
        activeConversation.value = { ...activeConversation.value, title, updated_at: new Date().toISOString() };
      }
    } catch (dbErr: any) {
      console.error('Failed to rename locally:', dbErr.message);
    }
  };

  const pinConversation = async (id: string, pinned: boolean) => {
    try {
      await api.patch(`/ai-chat/conversations/${id}`, { is_pinned: pinned });
    } catch (err: any) {
      console.error('Failed to pin on server:', err.message);
    }

    try {
      const conv = await indexedDb.get<Conversation>('ai_conversations', id);
      if (conv) {
        conv.is_pinned = pinned;
        conv.updated_at = new Date().toISOString();
        await indexedDb.put('ai_conversations', conv);
      }

      const stored = await indexedDb.getAll<Conversation>('ai_conversations');
      conversations.value = stored.sort((a, b) => {
        if (a.is_pinned && !b.is_pinned) return -1;
        if (!a.is_pinned && b.is_pinned) return 1;
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      });
    } catch (dbErr: any) {
      console.error('Failed to pin locally:', dbErr.message);
    }
  };

  const deleteConversation = async (id: string) => {
    try {
      await api.delete(`/ai-chat/conversations/${id}`);
    } catch (err: any) {
      console.error('Failed to delete on server:', err.message);
    }

    try {
      await indexedDb.delete('ai_conversations', id);
      await indexedDb.deleteMessagesByConversation(id);

      conversations.value = conversations.value.filter(c => c.id !== id);
      if (activeConversation.value?.id === id) {
        const first = conversations.value[0];
        if (first) {
          await loadConversation(first.id);
        } else {
          startNewChat();
        }
      }
      error.value = null;
    } catch (dbErr: any) {
      error.value = 'Failed to delete conversation: ' + dbErr.message;
    }
  };

  const clearAllConversations = async () => {
    try {
      await api.delete('/ai-chat/conversations');
    } catch (err: any) {
      console.error('Failed to clear on server:', err.message);
    }

    try {
      await indexedDb.clearStore('ai_conversations');
      await indexedDb.clearStore('ai_messages');
      conversations.value = [];
      startNewChat();
    } catch (dbErr: any) {
      error.value = 'Failed to clear local conversations: ' + dbErr.message;
    }
  };

  const sendMessage = async (content: string) => {
    if (!content.trim() || isStreaming.value) return;

    const provider = selectedProvider.value;
    const model = selectedModel.value;
    const apiKey = await aiKeys.getKey(provider);

    if (!apiKey) {
      error.value = `No API key configured for ${provider}. Open Settings to add one.`;
      return;
    }

    const tavilyApiKey = await aiKeys.getKey('tavily');

    if (!model) {
      error.value = 'Please select a model first.';
      return;
    }

    error.value = null;
    rateLimitError.value = null;
    isStreaming.value = true;
    streamingContent.value = '';

    const convId = activeConversation.value?.id;

    const userMsg: Message = {
      id: 'temp-user-' + Date.now(),
      conversation_id: convId || '',
      role: 'user',
      content,
      created_at: new Date().toISOString(),
    };
    messages.value.push(userMsg);

    const assistantMsg: Message = {
      id: 'temp-assistant-' + Date.now(),
      conversation_id: convId || '',
      role: 'assistant',
      content: '',
      provider,
      model,
      created_at: new Date().toISOString(),
    };
    messages.value.push(assistantMsg);

    abortController = new AbortController();

    try {
      const response = await fetch('/api/ai-chat/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversationId: convId || undefined,
          message: content,
          provider,
          model,
          apiKey,
          tavilyApiKey,
          searchMode: searchMode.value,
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response stream');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;

          const dataStr = trimmed.slice(6);
          if (dataStr === '[DONE]') continue;

          try {
            const data = JSON.parse(dataStr);

            if (data.conversationId && !activeConversation.value) {
              const newConv: Conversation = {
                id: data.conversationId,
                title: content.substring(0, 80),
                provider,
                model,
                is_pinned: false,
                message_count: 0,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              };
              activeConversation.value = newConv;
              await indexedDb.put('ai_conversations', JSON.parse(JSON.stringify(newConv)));
              await fetchConversations();
            }

            if (data.content || data.webSearchUsed) {
              if (data.content) streamingContent.value += data.content;

              const last = messages.value[messages.value.length - 1];
              if (last && last.role === 'assistant') {
                last.content = streamingContent.value;
                if (data.webSearchUsed) last.webSearchUsed = data.webSearchUsed;
                if (data.searchSources) last.searchSources = data.searchSources;
              }
            }

            if (data.error) {
              try {
                const errorObj = JSON.parse(data.error);
                if (errorObj.type === 'RATE_LIMITED') {
                  rateLimitError.value = errorObj;
                } else {
                  error.value = errorObj.message || data.error;
                }
              } catch {
                error.value = data.error;
              }
            }
          } catch {
            // Skip malformed chunks
          }
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        error.value = err.message || 'Failed to send message';
        const lastMsg = messages.value[messages.value.length - 1];
        if (lastMsg && lastMsg.role === 'assistant' && !lastMsg.content) {
          messages.value.pop();
        }
      }
    } finally {
      isStreaming.value = false;
      streamingContent.value = '';
      abortController = null;

      const activeConv = activeConversation.value;
      if (activeConv) {
        try {
          const msgs = messages.value;
          const uiUserMsg = msgs.find(m => m.id.startsWith('temp-user-'));
          if (uiUserMsg) {
            uiUserMsg.id = 'user-' + Date.now() + Math.random().toString(36).substring(2, 11);
            uiUserMsg.conversation_id = activeConv.id;
            await indexedDb.put('ai_messages', JSON.parse(JSON.stringify(uiUserMsg)));
          }

          const uiAssistantMsg = msgs.find(m => m.id.startsWith('temp-assistant-'));
          if (uiAssistantMsg) {
            uiAssistantMsg.id = 'assistant-' + Date.now() + Math.random().toString(36).substring(2, 11);
            uiAssistantMsg.conversation_id = activeConv.id;
            await indexedDb.put('ai_messages', JSON.parse(JSON.stringify(uiAssistantMsg)));
          }

          activeConv.message_count = msgs.length;
          activeConv.updated_at = new Date().toISOString();
          await indexedDb.put('ai_conversations', JSON.parse(JSON.stringify(activeConv)));

          await fetchConversations();
        } catch (dbErr) {
          console.error('Failed to sync chat history to IndexedDB:', dbErr);
        }
      }
    }
  };

  const regenerateLastResponse = async () => {
    const msgs = messages.value;
    if (msgs.length < 2) return;

    let lastUserMsgIdx = -1;
    for (let i = msgs.length - 1; i >= 0; i--) {
      const msg = msgs[i];
      if (msg && msg.role === 'user') {
        lastUserMsgIdx = i;
        break;
      }
    }
    if (lastUserMsgIdx === -1) return;

    const userMsg = msgs[lastUserMsgIdx];
    if (!userMsg) return;
    const lastUserContent = userMsg.content;

    let newMsgs = [...msgs];
    const lastMsg = newMsgs[newMsgs.length - 1];
    if (lastMsg && lastMsg.role === 'assistant') {
      newMsgs.pop();
    }
    newMsgs.splice(lastUserMsgIdx, 1);
    messages.value = newMsgs;

    await sendMessage(lastUserContent);
  };

  const stopGeneration = () => {
    if (abortController) {
      abortController.abort();
    }
    const conv = activeConversation.value;
    if (conv?.id) {
      api.post('/ai-chat/chat/stop', { conversationId: conv.id }).catch(() => {});
    }
  };

  const exportPdf = async () => {
    const conv = activeConversation.value;
    if (!conv?.id) return;

    try {
      await apiUtils.download(`/ai-chat/conversations/${conv.id}/export/pdf`, `chat-${conv.title.substring(0, 30)}.pdf`, 'POST');
    } catch (err: any) {
      error.value = err.message || 'Failed to export PDF';
    }
  };

  return {
    conversations,
    activeConversation,
    messages,
    isLoading,
    isStreaming,
    streamingContent,
    error,
    rateLimitError,
    providers,
    models,
    selectedProvider,
    selectedModel,
    searchQuery,
    searchMode,
    filteredConversations,
    freeModels,

    getSetting,
    saveSetting,
    fetchProviders,
    fetchModels,
    selectProvider,
    selectModel,
    fetchConversations,
    loadConversation,
    startNewChat,
    renameConversation,
    pinConversation,
    deleteConversation,
    clearAllConversations,
    sendMessage,
    regenerateLastResponse,
    stopGeneration,
    exportPdf,
  };
};
