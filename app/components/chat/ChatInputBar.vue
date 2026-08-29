<script setup lang="ts">
import { ref, nextTick } from 'vue';
import type { ChatMessage } from '../../types/chat';

const props = defineProps<{
  replyingTo?: ChatMessage | null;
  sending?: boolean;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  (e: 'send', content: string): void;
  (e: 'cancel-reply'): void;
}>();

const messageText = ref('');
const textareaRef = ref<any>(null);

const handleSend = () => {
  if (!messageText.value.trim() || props.sending || props.disabled) return;
  emit('send', messageText.value);
  messageText.value = '';
  nextTick(() => {
    if (textareaRef.value?.focus) {
      textareaRef.value.focus();
    }
  });
};

const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
};

const addEmoji = (emoji: string) => {
  messageText.value += emoji;
};

const emojis = ['👍', '❤️', '😊', '🎉', '🔥', '🙏', '👏', '✅', '🚀', '💼'];
</script>

<template>
  <div class="p-3 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 transition-colors">
    <!-- Active Reply Banner Preview -->
    <div 
      v-if="replyingTo" 
      class="flex items-center justify-between bg-teal-50 dark:bg-teal-950/40 border-l-4 border-teal-500 px-3 py-2 rounded-r-lg mb-2 text-xs"
    >
      <div class="min-w-0 flex-1">
        <span class="font-bold text-teal-700 dark:text-teal-300">
          Replying to {{ replyingTo.senderName || 'Message' }}
        </span>
        <p class="text-gray-600 dark:text-gray-300 truncate text-[11px] mt-0.5">
          {{ replyingTo.content }}
        </p>
      </div>
      <button 
        @click="emit('cancel-reply')" 
        class="text-gray-400 hover:text-red-500 dark:hover:text-red-400 p-1 cursor-pointer bg-transparent border-0"
        title="Cancel reply"
      >
        <UIcon name="i-lucide-x" class="w-4 h-4" />
      </button>
    </div>

    <!-- Main Input Bar -->
    <div class="flex items-end gap-2">
      <!-- Emoji Quick Popover Trigger -->
      <UPopover>
        <UButton 
          icon="i-lucide-smile" 
          color="neutral" 
          variant="ghost" 
          size="sm"
          class="text-gray-500 hover:text-teal-600 dark:hover:text-teal-400 mb-0.5"
          title="Add emoji"
        />
        <template #content>
          <div class="grid grid-cols-5 gap-1.5 p-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
            <button
              v-for="emoji in emojis"
              :key="emoji"
              @click="addEmoji(emoji)"
              class="text-base p-1.5 hover:scale-125 transition-transform cursor-pointer bg-transparent border-0"
            >
              {{ emoji }}
            </button>
          </div>
        </template>
      </UPopover>

      <!-- Auto-resizing Text Input -->
      <div class="flex-1">
        <UTextarea
          ref="textareaRef"
          v-model="messageText"
          :rows="1"
          autoresize
          :maxrows="5"
          placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
          variant="subtle"
          size="md"
          class="w-full"
          :disabled="disabled"
          @keydown="handleKeyDown"
        />
      </div>

      <!-- Send Button -->
      <UButton
        icon="i-lucide-send"
        color="primary"
        size="md"
        class="bg-gradient-to-r from-teal-500 to-indigo-600 hover:from-teal-600 hover:to-indigo-700 text-white shadow-xs mb-0.5"
        :loading="sending"
        :disabled="!messageText.trim() || disabled"
        @click="handleSend"
        title="Send Message"
      />
    </div>
  </div>
</template>
