<template>
  <div class="space-y-3">
    <!-- Provider Tabs -->
    <div class="flex gap-1.5 flex-wrap">
      <UButton
        v-for="p in providers"
        :key="p.id"
        :color="selectedProvider === p.id ? 'primary' : 'neutral'"
        :variant="selectedProvider === p.id ? 'solid' : hasKey[p.id] ? 'subtle' : 'outline'"
        size="xs"
        class="transition-all"
        @click="emit('selectProviderEvent', p.id)"
      >
        <span>{{ providerIcons[p.id] || '🤖' }}</span>
        {{ p.name }}
        <span v-if="!hasKey[p.id]" class="text-[9px] opacity-70">⚠️</span>
      </UButton>
    </div>

    <!-- Model Dropdown -->
    <div v-if="models.length > 0">
      <select
        :value="selectedModel"
        class="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:border-indigo-500 transition-colors appearance-none cursor-pointer"
        @change="onModelChange"
      >
        <optgroup label="Free Models">
          <option v-for="m in freeModels" :key="m.id" :value="m.id">
            🆓 {{ m.name }}{{ m.contextWindow ? ' (' + Math.round(m.contextWindow / 1024) + 'K ctx)' : '' }}
          </option>
        </optgroup>
        <optgroup v-if="paidModels.length > 0" label="Paid Models">
          <option v-for="m in paidModels" :key="m.id" :value="m.id">
            {{ m.name }}{{ m.contextWindow ? ' (' + Math.round(m.contextWindow / 1024) + 'K ctx)' : '' }}
          </option>
        </optgroup>
      </select>
    </div>

    <!-- No key warning -->
    <UAlert
      v-if="models.length === 0 && !hasKey[selectedProvider]"
      color="warning"
      variant="soft"
      icon="i-heroicons-exclamation-triangle"
      :title="`No API key configured for ${selectedProvider}. Add one in Settings.`"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { ProviderInfo, ModelInfo } from '../../../composables/useAiChat';

const props = withDefaults(defineProps<{
  providers?: ProviderInfo[];
  models?: ModelInfo[];
  selectedProvider?: string;
  selectedModel?: string;
  hasKey?: Record<string, boolean>;
}>(), {
  providers: () => [],
  models: () => [],
  selectedProvider: '',
  selectedModel: '',
  hasKey: () => ({}),
});

const emit = defineEmits<{
  (e: 'selectProviderEvent', provider: string): void;
  (e: 'selectModelEvent', modelId: string): void;
}>();

const providerIcons: Record<string, string> = {
  gemini: '💎',
  groq: '⚡',
  openrouter: '🌐',
};

const freeModels = computed(() => props.models.filter(m => m.isFree));
const paidModels = computed(() => props.models.filter(m => !m.isFree));

const onModelChange = (event: Event) => {
  const target = event.target as HTMLSelectElement;
  emit('selectModelEvent', target.value);
};
</script>
