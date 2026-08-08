<template>
  <div class="fixed inset-0 flex bg-white dark:bg-gray-950 z-[60]" @keydown="handleKeyboard">
    <!-- Sidebar -->
    <ChatSidebar
      :conversations="aiChat.filteredConversations.value"
      :active-id="aiChat.activeConversation.value?.id"
      :search-query="aiChat.searchQuery.value"
      :is-collapsed="!showSidebar"
      @select-event="handleSelectConversation"
      @new-chat-event="handleNewChat"
      @search-event="(q) => aiChat.searchQuery.value = q"
      @rename-event="(e) => aiChat.renameConversation(e.id, e.title)"
      @pin-event="(e) => aiChat.pinConversation(e.id, e.pinned)"
      @delete-event="(id) => aiChat.deleteConversation(id)"
      @clear-all-event="aiChat.clearAllConversations"
      @toggle-event="showSidebar = !showSidebar"
      @open-settings-event="showSettings = true"
    />

    <!-- Main Chat Area -->
    <div class="flex-1 flex flex-col min-w-0">
      <!-- Top Bar -->
      <div class="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-950/80 backdrop-blur-sm">
        <div class="flex items-center gap-3">
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-heroicons-bars-3"
            size="sm"
            @click="showSidebar = !showSidebar"
          />
          <h1 class="text-sm font-bold text-gray-900 dark:text-white truncate max-w-[300px]">
            {{ aiChat.activeConversation.value?.title || 'AI Chat' }}
          </h1>
        </div>

        <div class="flex items-center gap-2">
          <UButton
            color="neutral"
            variant="subtle"
            size="xs"
            @click="showModelSelector = !showModelSelector"
          >
            <span class="text-sm">🤖</span>
            {{ aiChat.selectedProvider.value || 'Select' }}
            <UIcon name="i-heroicons-chevron-down" class="w-3 h-3" />
          </UButton>

          <UButton
            v-if="aiChat.activeConversation.value && aiChat.messages.value.length > 0"
            color="neutral"
            variant="ghost"
            icon="i-heroicons-arrow-down-tray"
            size="xs"
            title="Export as PDF"
            @click="aiChat.exportPdf"
          />

          <NuxtLink to="/dashboard">
            <UButton
              color="neutral"
              variant="ghost"
              icon="i-heroicons-x-mark"
              size="xs"
              title="Back to Dashboard"
            />
          </NuxtLink>
        </div>
      </div>

      <!-- Model Selector Dropdown -->
      <div v-if="showModelSelector" class="px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50">
        <ModelSelector
          :providers="aiChat.providers.value"
          :models="aiChat.models.value"
          :selected-provider="aiChat.selectedProvider.value"
          :selected-model="aiChat.selectedModel.value"
          :has-key="hasKeys"
          @select-provider-event="handleSelectProvider"
          @select-model-event="aiChat.selectModel"
        />
      </div>

      <!-- Chat Messages -->
      <div ref="chatContainer" class="flex-1 overflow-y-auto">
        <!-- Empty state -->
        <div v-if="aiChat.messages.value.length === 0 && !aiChat.isLoading.value" class="flex items-center justify-center h-full">
          <div class="text-center max-w-md mx-auto px-4">
            <div class="w-16 h-16 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-indigo-200 dark:shadow-none">
              <UIcon name="i-heroicons-sparkles" class="w-8 h-8 text-white" />
            </div>
            <h2 class="text-xl font-bold text-gray-900 dark:text-white mb-2">AI Chat</h2>
            <p class="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Start a conversation with AI. Choose your provider and model, then type your message.
            </p>

            <div v-if="!hasAnyKey()" class="mt-6 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl text-left">
              <p class="text-sm font-medium text-amber-800 dark:text-amber-300 mb-2">⚙️ Setup Required</p>
              <p class="text-xs text-amber-600 dark:text-amber-400 mb-3">Add at least one AI provider API key to start chatting.</p>
              <UButton
                color="warning"
                size="xs"
                label="Open Settings"
                @click="showSettings = true"
              />
            </div>
          </div>
        </div>

        <!-- Loading -->
        <div v-if="aiChat.isLoading.value" class="flex items-center justify-center h-full">
          <div class="flex items-center gap-3 text-gray-500">
            <UIcon name="i-heroicons-arrow-path" class="animate-spin w-5 h-5" />
            Loading conversation...
          </div>
        </div>

        <!-- Messages -->
        <div v-if="!aiChat.isLoading.value && aiChat.messages.value.length > 0">
          <ChatMessage
            v-for="(msg, i) in aiChat.messages.value"
            :key="msg.id || i"
            :role="msg.role"
            :content="msg.content"
            :timestamp="msg.created_at"
            :is-streaming="aiChat.isStreaming.value && i === aiChat.messages.value.length - 1 && msg.role === 'assistant'"
            :web-search-used="msg.webSearchUsed"
            :search-sources="msg.searchSources"
            @regenerate="aiChat.regenerateLastResponse"
          />
        </div>

        <!-- Rate limit banner -->
        <div v-if="aiChat.rateLimitError.value" class="mx-4 my-4 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl">
          <div class="flex items-start gap-3">
            <span class="text-xl">⚠️</span>
            <div class="flex-1">
              <p class="text-sm font-medium text-amber-800 dark:text-amber-300">
                {{ aiChat.rateLimitError.value.message }}
              </p>
              <div class="flex flex-wrap gap-2 mt-3">
                <template v-for="p in aiChat.providers.value" :key="p.id">
                  <UButton
                    v-if="p.id !== aiChat.selectedProvider.value && hasKeys[p.id]"
                    color="warning"
                    variant="outline"
                    size="xs"
                    :label="`Switch to ${p.name}`"
                    @click="handleSwitchProvider(p.id)"
                  />
                </template>
              </div>
            </div>
          </div>
        </div>

        <!-- Error banner -->
        <div v-if="aiChat.error.value && !aiChat.rateLimitError.value" class="mx-4 my-4 p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl">
          <div class="flex items-start gap-3">
            <span class="text-xl">❌</span>
            <div class="flex-1">
              <p class="text-sm text-red-600 dark:text-red-400">{{ aiChat.error.value }}</p>
              <UButton
                color="error"
                variant="link"
                size="xs"
                label="Dismiss"
                class="p-0 mt-1"
                @click="aiChat.error.value = null"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Chat Input -->
      <ChatInput
        ref="chatInput"
        :is-streaming="aiChat.isStreaming.value"
        :disabled="!hasKeys[aiChat.selectedProvider.value] || !aiChat.selectedModel.value"
        :provider="aiChat.selectedProvider.value"
        :model="aiChat.selectedModel.value"
        :search-mode="aiChat.searchMode.value"
        @update:search-mode="(m) => aiChat.searchMode.value = m"
        @send-event="aiChat.sendMessage"
        @stop-event="aiChat.stopGeneration"
      />
    </div>

    <!-- Settings Dialog -->
    <SettingsDialog
      :open="showSettings"
      :providers="aiChat.providers.value"
      @close-event="showSettings = false"
      @keys-changed="handleKeysChanged"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { useAiChat } from '../../composables/useAiChat';
import { useAiKeys } from '../../composables/useAiKeys';
import ChatSidebar from './components/ChatSidebar.vue';
import ChatMessage from './components/ChatMessage.vue';
import ChatInput from './components/ChatInput.vue';
import ModelSelector from './components/ModelSelector.vue';
import SettingsDialog from './components/SettingsDialog.vue';

definePageMeta({
  layout: false
});

const aiChat = useAiChat();
const aiKeys = useAiKeys();

const chatContainer = ref<HTMLDivElement | null>(null);
const chatInput = ref<any>(null);

const showSidebar = ref(true);
const showSettings = ref(false);
const showModelSelector = ref(false);
const hasKeys = reactive<Record<string, boolean>>({});

let autoScrollInterval: any = null;

const scrollToBottom = () => {
  if (chatContainer.value) {
    chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
  }
};

const refreshKeyStatus = async () => {
  for (const p of aiChat.providers.value) {
    hasKeys[p.id] = await aiKeys.hasKey(p.id);
  }
};

const hasAnyKey = (): boolean => {
  return Object.values(hasKeys).some(v => v);
};

const autoSelectProviderWithKey = () => {
  if (!hasKeys[aiChat.selectedProvider.value]) {
    const providerWithKey = Object.keys(hasKeys).find(k => hasKeys[k]);
    if (providerWithKey) {
      handleSelectProvider(providerWithKey);
      return true;
    }
  }
  return false;
};

const handleKeyboard = (e: KeyboardEvent) => {
  if (e.ctrlKey && e.key === 'n') {
    e.preventDefault();
    handleNewChat();
  }
  if (e.ctrlKey && e.key === 'k') {
    e.preventDefault();
    showSidebar.value = true;
  }
  if (e.ctrlKey && e.key === ',') {
    e.preventDefault();
    showSettings.value = true;
  }
};

const handleNewChat = () => {
  aiChat.startNewChat();
  setTimeout(() => chatInput.value?.focus(), 100);
};

const handleSelectConversation = async (id: string) => {
  await aiChat.loadConversation(id);
  setTimeout(() => scrollToBottom(), 100);
};

const handleSelectProvider = async (provider: string) => {
  aiChat.selectProvider(provider);
  if (hasKeys[provider]) {
    await aiChat.fetchModels(provider);
  }
};

const handleKeysChanged = async () => {
  await refreshKeyStatus();
  if (hasKeys[aiChat.selectedProvider.value]) {
    await aiChat.fetchModels();
  } else {
    autoSelectProviderWithKey();
  }
};

const handleSwitchProvider = async (provider: string) => {
  aiChat.rateLimitError.value = null;
  await handleSelectProvider(provider);
};

watch(() => aiChat.messages.value.length, () => {
  nextTick(() => scrollToBottom());
});

onMounted(async () => {
  await aiChat.fetchProviders();
  await refreshKeyStatus();
  await aiChat.fetchConversations();

  const savedProvider = await aiChat.getSetting('selectedProvider');
  if (savedProvider && aiChat.providers.value.some(p => p.id === savedProvider)) {
    aiChat.selectedProvider.value = savedProvider;
  }

  if (hasKeys[aiChat.selectedProvider.value]) {
    await aiChat.fetchModels();
  } else {
    autoSelectProviderWithKey();
  }

  setTimeout(() => chatInput.value?.focus(), 100);

  autoScrollInterval = setInterval(() => {
    if (aiChat.isStreaming.value) {
      scrollToBottom();
    }
  }, 100);
});

onUnmounted(() => {
  if (autoScrollInterval) {
    clearInterval(autoScrollInterval);
  }
});
</script>
