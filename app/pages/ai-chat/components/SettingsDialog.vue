<template>
  <UModal :open="open" title="Settings" @update:open="(val) => { if (!val) emit('closeEvent'); }">
    <template #body>
      <div class="space-y-4">
        <p class="text-xs text-gray-500">Manage your AI provider API keys</p>

        <!-- Save message -->
        <UAlert
          v-if="saveMessage"
          :color="saveMessage.startsWith('✅') ? 'success' : 'error'"
          variant="subtle"
          :title="saveMessage"
        />

        <!-- Provider Tabs -->
        <div class="flex border-b border-gray-200 dark:border-gray-800 pt-2 flex-wrap">
          <button
            v-for="p in allProvidersList"
            :key="p.id"
            class="flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors cursor-pointer"
            :class="[activeTab === p.id ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300', p.id === 'tavily' ? 'ml-auto' : '']"
            @click="activeTab = p.id"
          >
            <span>{{ providerMeta[p.id]?.icon || '🤖' }}</span>
            {{ p.name }}
            <span v-if="keys[p.id]?.saved" class="w-2 h-2 bg-emerald-500 rounded-full"></span>
          </button>
        </div>

        <!-- Key Form -->
        <div class="py-3 space-y-4">
          <template v-for="p in allProvidersList" :key="p.id">
            <div v-if="activeTab === p.id" class="space-y-4">
              <p class="text-sm text-gray-500">{{ providerMeta[p.id]?.description || 'Configure API key' }}</p>

              <a
                v-if="providerMeta[p.id]?.url"
                :href="providerMeta[p.id]?.url"
                target="_blank"
                class="inline-flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-600 transition-colors"
              >
                Get your API key →
              </a>

              <div v-if="keys[p.id]" class="space-y-2">
                <label class="text-xs font-medium text-gray-700 dark:text-gray-300">API Key</label>
                <UInput
                  :model-value="keys[p.id]?.value || ''"
                  type="password"
                  :placeholder="`Enter your ${p.name} API key`"
                  class="w-full"
                  @update:model-value="(val) => { if (keys[p.id]) keys[p.id]!.value = val; }"
                  @input="onInput(p.id)"
                />
                <div v-if="keys[p.id]?.valid === true" class="text-xs text-emerald-500">✅ Key is valid and saved</div>
                <div v-if="keys[p.id]?.valid === false" class="text-xs text-red-500">❌ Invalid API key</div>
              </div>

              <div class="flex items-center gap-2">
                <UButton
                  v-if="keys[p.id]?.dirty && keys[p.id]?.value && !(keys[p.id]?.value || '').startsWith('••••')"
                  color="primary"
                  :loading="aiKeys.isValidating.value"
                  label="Validate & Save"
                  @click="handleSave(p.id)"
                />
                <UButton
                  v-if="keys[p.id]?.saved && !keys[p.id]?.dirty"
                  color="neutral"
                  variant="outline"
                  label="Change Key"
                  @click="handleEditKey(p.id)"
                />
                <UButton
                  v-if="keys[p.id]?.saved"
                  color="error"
                  variant="ghost"
                  label="Remove"
                  @click="handleRemove(p.id)"
                />
              </div>

              <div class="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 text-xs text-gray-500 space-y-1">
                <p class="font-medium text-gray-600 dark:text-gray-400">🔒 Security</p>
                <ul class="list-disc list-inside space-y-0.5">
                  <li>Keys are stored locally in your browser (IndexedDB)</li>
                  <li>Keys are never stored permanently on our server</li>
                  <li>Keys are sent over HTTPS only when making AI requests</li>
                  <li>Keys are never logged or exposed in responses</li>
                </ul>
              </div>
            </div>
          </template>
        </div>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end">
        <UButton color="neutral" variant="outline" label="Close" @click="emit('closeEvent')" />
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useAiKeys } from '../../../composables/useAiKeys';
import type { ProviderInfo } from '../../../composables/useAiChat';
import { api } from '../../../utils/api';

interface KeyState {
  value: string;
  saved: boolean;
  valid: boolean | null;
  dirty: boolean;
}

const props = withDefaults(defineProps<{
  open?: boolean;
  providers?: ProviderInfo[];
}>(), {
  open: false,
  providers: () => [],
});

const emit = defineEmits<{
  (e: 'closeEvent'): void;
  (e: 'keysChanged'): void;
}>();

const aiKeys = useAiKeys();
const keys = ref<Record<string, KeyState>>({});
const activeTab = ref('');
const saveMessage = ref<string | null>(null);

const providerMeta: Record<string, any> = {
  gemini: { icon: '✨', url: 'https://aistudio.google.com/app/apikey', description: 'Get a free API key from Google AI Studio.' },
  groq: { icon: '⚡', url: 'https://console.groq.com/keys', description: 'Get a free, ultra-fast API key from Groq.' },
  openrouter: { icon: '🌐', url: 'https://openrouter.ai/keys', description: 'Generate an API key from the OpenRouter dashboard.' },
  tavily: { icon: '🔍', url: 'https://app.tavily.com/home', description: 'Get a free API key for real-time web search.' }
};

const allProvidersList = computed(() => {
  return [...props.providers, { id: 'tavily', name: 'Web Search' }];
});

const loadKeys = async () => {
  for (const p of allProvidersList.value) {
    const stored = await aiKeys.getKey(p.id);
    keys.value[p.id] = {
      value: stored ? '••••••••' + stored.slice(-4) : '',
      saved: !!stored,
      valid: stored ? true : null,
      dirty: false,
    };
  }
};

onMounted(() => {
  const first = props.providers[0];
  if (first) {
    activeTab.value = first.id;
  }
  loadKeys();
});

watch(() => props.open, (newVal) => {
  if (newVal) {
    const first = props.providers[0];
    if (first && !activeTab.value) {
      activeTab.value = first.id;
    }
    loadKeys();
  }
});

const onInput = (providerId: string) => {
  const k = keys.value[providerId];
  if (k) {
    k.dirty = true;
    k.valid = null;
  }
};

const handleSave = async (providerId: string) => {
  const k = keys.value[providerId];
  if (!k || !k.value || k.value.startsWith('••••')) return;

  try {
    let valid = false;
    if (providerId === 'tavily') {
      const result: any = await api.post('/ai-chat/validate-tavily-key', { apiKey: k.value }).catch(() => null);
      valid = result?.data?.valid === true;
    } else {
      valid = await aiKeys.validateKey(providerId, k.value);
    }

    k.valid = valid;

    if (valid) {
      await aiKeys.saveKey(providerId, k.value);
      k.saved = true;
      k.dirty = false;
      k.value = '••••••••' + k.value.slice(-4);

      saveMessage.value = `✅ ${providerId} key saved successfully!`;
      setTimeout(() => saveMessage.value = null, 3000);
      emit('keysChanged');
    } else {
      saveMessage.value = `❌ Invalid API key for ${providerId}`;
      setTimeout(() => saveMessage.value = null, 3000);
    }
  } catch {
    saveMessage.value = `❌ Error validating key for ${providerId}`;
    setTimeout(() => saveMessage.value = null, 3000);
  }
};

const handleRemove = async (providerId: string) => {
  await aiKeys.removeKey(providerId);
  keys.value[providerId] = { value: '', saved: false, valid: null, dirty: false };
  emit('keysChanged');
};

const handleEditKey = (providerId: string) => {
  const k = keys.value[providerId];
  if (k) {
    k.value = '';
    k.dirty = true;
    k.valid = null;
  }
};
</script>
