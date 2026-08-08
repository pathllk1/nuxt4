<template>
  <div class="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
    <div class="max-w-[850px] mx-auto p-4">
      <!-- Model badge -->
      <div v-if="provider && model" class="flex items-center gap-2 mb-2">
        <UBadge
          color="primary"
          variant="subtle"
          size="xs"
          :label="provider"
          class="font-medium"
        />
        <span class="text-xs text-gray-400 truncate max-w-[200px]">{{ model }}</span>
      </div>

      <!-- Controls row -->
      <div class="flex items-center justify-between px-2 pt-1 pb-0">
        <UButton
          :color="searchMode === 'auto' ? 'primary' : searchMode === 'force' ? 'success' : 'neutral'"
          :variant="searchMode !== 'never' ? 'subtle' : 'ghost'"
          size="xs"
          title="Toggle Web Search Mode"
          @click="toggleSearchMode"
        >
          <span :class="{ 'opacity-50 grayscale': searchMode === 'never' }">🌐</span>
          {{ searchMode === 'auto' ? 'Auto Search' : searchMode === 'force' ? 'Search On' : 'Search Off' }}
        </UButton>
      </div>

      <!-- Input area -->
      <div class="relative flex items-end gap-2 p-1.5">
        <textarea
          ref="textareaRef"
          v-model="input"
          :placeholder="isStreaming ? 'Generating response...' : 'Type your message... (Shift+Enter for new line)'"
          :disabled="isStreaming || disabled"
          rows="1"
          class="flex-1 resize-none bg-transparent text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 px-4 py-3.5 text-sm leading-relaxed focus:outline-none disabled:opacity-50 max-h-[200px]"
          @keydown="handleKeyDown"
          @input="autoResize"
        ></textarea>

        <!-- Send / Stop button -->
        <div class="pr-2 pb-2">
          <UButton
            v-if="!isStreaming"
            color="primary"
            icon="i-heroicons-paper-airplane"
            size="md"
            :disabled="!input.trim() || disabled"
            class="rounded-xl shadow-md cursor-pointer"
            @click="handleSend"
          />

          <UButton
            v-if="isStreaming"
            color="error"
            icon="i-heroicons-stop"
            size="md"
            class="rounded-xl shadow-md cursor-pointer"
            @click="emit('stopEvent')"
          />
        </div>
      </div>

      <p class="text-[10px] text-gray-400 mt-2 text-center">
        AI can make mistakes. Verify important information.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const props = withDefaults(defineProps<{
  isStreaming?: boolean;
  disabled?: boolean;
  provider?: string;
  model?: string;
  searchMode?: 'auto' | 'force' | 'never';
}>(), {
  isStreaming: false,
  disabled: false,
  provider: '',
  model: '',
  searchMode: 'auto',
});

const emit = defineEmits<{
  (e: 'sendEvent', content: string): void;
  (e: 'stopEvent'): void;
  (e: 'update:searchMode', mode: 'auto' | 'force' | 'never'): void;
}>();

const input = ref('');
const textareaRef = ref<HTMLTextAreaElement | null>(null);

const toggleSearchMode = () => {
  const modes: Array<'auto' | 'force' | 'never'> = ['auto', 'force', 'never'];
  const currentIndex = modes.indexOf(props.searchMode);
  const nextIndex = (currentIndex + 1) % modes.length;
  const targetMode = modes[nextIndex];
  if (targetMode) {
    emit('update:searchMode', targetMode);
  }
};

const autoResize = () => {
  const el = textareaRef.value;
  if (el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  }
};

const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
};

const handleSend = () => {
  if (!input.value.trim() || props.isStreaming || props.disabled) return;
  emit('sendEvent', input.value.trim());
  input.value = '';
  setTimeout(() => autoResize(), 0);
};

const focus = () => {
  textareaRef.value?.focus();
};

defineExpose({
  focus,
});
</script>
