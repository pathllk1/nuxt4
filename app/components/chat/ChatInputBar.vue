<script setup lang="ts">
import { ref, computed, nextTick } from 'vue';
import type { ChatMessage, ChatAttachment } from '../../types/chat';
import { formatFileSize } from '../../utils/imageCompressor';

const props = defineProps<{
  replyingTo?: ChatMessage | null;
  sending?: boolean;
  disabled?: boolean;
  uploadAttachment?: (file: File) => Promise<ChatAttachment>;
}>();

const emit = defineEmits<{
  (e: 'send', content: string, attachments?: ChatAttachment[]): void;
  (e: 'cancel-reply'): void;
}>();

interface StagedAttachment {
  id: string;
  file: File;
  name: string;
  size: number;
  isImage: boolean;
  previewUrl?: string;
}

const messageText = ref('');
const textareaRef = ref<any>(null);
const fileInputRef = ref<HTMLInputElement | null>(null);
const stagedAttachments = ref<StagedAttachment[]>([]);
const isUploading = ref(false);

const canSend = computed(() => {
  const hasText = Boolean(messageText.value.trim());
  const hasFiles = stagedAttachments.value.length > 0;
  return (hasText || hasFiles) && !isUploading.value && !props.sending && !props.disabled;
});

const triggerFilePicker = () => {
  fileInputRef.value?.click();
};

const handleFiles = (files: FileList | File[]) => {
  if (!files || files.length === 0) return;

  for (const file of Array.from(files)) {
    const stagedId = `stage_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const isImg = file.type.startsWith('image/') && !file.type.includes('svg');
    const previewUrl = isImg ? URL.createObjectURL(file) : undefined;

    stagedAttachments.value.push({
      id: stagedId,
      file,
      name: file.name,
      size: file.size,
      isImage: isImg,
      previewUrl
    });
  }
};

const handleFileSelected = (e: Event) => {
  const target = e.target as HTMLInputElement;
  if (target.files) {
    handleFiles(target.files);
    target.value = '';
  }
};

const handlePaste = (e: ClipboardEvent) => {
  const items = e.clipboardData?.items;
  if (!items) return;

  const files: File[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item && item.kind === 'file') {
      const file = item.getAsFile();
      if (file) files.push(file);
    }
  }

  if (files.length > 0) {
    e.preventDefault();
    handleFiles(files);
  }
};

const removeStaged = (id: string) => {
  const idx = stagedAttachments.value.findIndex(s => s.id === id);
  if (idx !== -1) {
    const item = stagedAttachments.value[idx];
    if (item && item.previewUrl) {
      URL.revokeObjectURL(item.previewUrl);
    }
    stagedAttachments.value.splice(idx, 1);
  }
};

const handleSend = async () => {
  if (!canSend.value || isUploading.value) return;

  isUploading.value = true;
  const uploadedAttachments: ChatAttachment[] = [];

  try {
    // Only upload to Backblaze B2 when user explicitly commits by sending
    if (stagedAttachments.value.length > 0 && props.uploadAttachment) {
      for (const staged of stagedAttachments.value) {
        const uploaded = await props.uploadAttachment(staged.file);
        uploadedAttachments.push(uploaded);
      }
    }

    emit('send', messageText.value, uploadedAttachments.length > 0 ? uploadedAttachments : undefined);

    // Revoke and clear staged files
    stagedAttachments.value.forEach(s => {
      if (s.previewUrl) URL.revokeObjectURL(s.previewUrl);
    });
    stagedAttachments.value = [];
    messageText.value = '';

    nextTick(() => {
      if (textareaRef.value?.focus) {
        textareaRef.value.focus();
      }
    });
  } catch (err: any) {
    console.error('[ChatInputBar] Error uploading attachment on send:', err);
  } finally {
    isUploading.value = false;
  }
};

const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
};

const chatEmojis = [
  '👍', '❤️', '😊', '😂', '🔥', '🎉', '🙏',
  '👏', '✅', '🚀', '💼', '😍', '✨', '💯',
  '🤝', '🙌', '😢', '😮', '💪', '👌', '⭐',
  '🤣', '🥰', '😘', '😉', '😎', '🥳', '🤔',
  '🫡', '🤫', '🥺', '😭', '🤯', '😤', '👎',
  '❌', '⚠️', '💰', '📅', '☕', '👀', '📦'
];

const addEmoji = (emoji: string) => {
  const textarea = textareaRef.value?.$el?.querySelector('textarea') || textareaRef.value;
  if (textarea && typeof textarea.selectionStart === 'number') {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const current = messageText.value;
    messageText.value = current.slice(0, start) + emoji + current.slice(end);
    nextTick(() => {
      textarea.focus();
      const newPos = start + emoji.length;
      textarea.setSelectionRange(newPos, newPos);
    });
  } else {
    messageText.value += emoji;
  }
};
</script>

<template>
  <div class="p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 transition-colors shrink-0">
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

    <!-- Staged Attachments Preview Bar (Local Memory Only - Not Uploaded Yet) -->
    <div v-if="stagedAttachments.length > 0" class="flex flex-wrap gap-2 mb-2 p-2 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-800">
      <div 
        v-for="staged in stagedAttachments" 
        :key="staged.id"
        class="relative flex items-center gap-2 p-1.5 pr-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-2xs text-xs max-w-[220px]"
      >
        <!-- Thumbnail or File Icon -->
        <div class="w-8 h-8 rounded shrink-0 overflow-hidden bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
          <img v-if="staged.isImage && staged.previewUrl" :src="staged.previewUrl" class="w-full h-full object-cover" />
          <UIcon v-else name="i-lucide-file-text" class="w-4 h-4 text-teal-600 dark:text-teal-400" />
        </div>

        <!-- Details & Status -->
        <div class="min-w-0 flex-1">
          <p class="truncate text-[11px] font-medium text-gray-800 dark:text-gray-200 leading-tight">
            {{ staged.name }}
          </p>
          <p class="text-[10px] text-gray-400">
            {{ formatFileSize(staged.size) }}
          </p>
        </div>

        <!-- Remove Button -->
        <button 
          @click="removeStaged(staged.id)"
          class="text-gray-400 hover:text-red-500 dark:hover:text-red-400 p-0.5 rounded cursor-pointer bg-transparent border-0 shrink-0"
          title="Remove attachment"
          :disabled="isUploading"
        >
          <UIcon name="i-lucide-x" class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>

    <!-- Main Input Bar -->
    <div class="flex items-end gap-2">
      <!-- Hidden File Input -->
      <input 
        ref="fileInputRef" 
        type="file" 
        multiple 
        accept="image/*,application/pdf,.xlsx,.xls,.docx,.csv,.txt" 
        class="hidden" 
        @change="handleFileSelected" 
      />

      <!-- Attachment Button (Paperclip) -->
      <UButton 
        icon="i-lucide-paperclip" 
        color="neutral" 
        variant="ghost" 
        size="sm"
        class="text-gray-500 hover:text-teal-600 dark:hover:text-teal-400 mb-0.5 cursor-pointer"
        :disabled="disabled || isUploading"
        title="Attach photo or document"
        @click="triggerFilePicker"
      />

      <!-- Emoji Quick Popover -->
      <UPopover>
        <UButton 
          icon="i-lucide-smile" 
          color="neutral" 
          variant="ghost" 
          size="sm"
          class="text-gray-500 hover:text-teal-600 dark:hover:text-teal-400 mb-0.5 cursor-pointer"
          title="Add emoji"
        />
        <template #content>
          <div class="p-2 bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200/90 dark:border-gray-800 select-none overflow-hidden">
            <!-- 7 columns × 6 rows = 42 emojis, perfectly sized with zero scrollbars -->
            <div class="grid grid-cols-7 gap-1">
              <button
                v-for="emoji in chatEmojis"
                :key="emoji"
                type="button"
                @click="addEmoji(emoji)"
                class="w-8 h-8 text-lg rounded-lg hover:bg-gray-100 dark:hover:bg-gray-850 active:bg-teal-100 dark:active:bg-teal-950/80 cursor-pointer bg-transparent border-0 flex items-center justify-center transition-colors shrink-0"
              >
                {{ emoji }}
              </button>
            </div>
          </div>
        </template>
      </UPopover>

      <!-- Auto-resizing Text Input with Paste listener -->
      <div class="flex-1 min-w-0">
        <UTextarea
          ref="textareaRef"
          v-model="messageText"
          :rows="1"
          autoresize
          :maxrows="5"
          placeholder="Type a message..."
          variant="subtle"
          size="md"
          class="w-full"
          :disabled="disabled || isUploading"
          @keydown="handleKeyDown"
          @paste="handlePaste"
        />
      </div>

      <!-- Send Button -->
      <UButton
        icon="i-lucide-send"
        color="primary"
        size="md"
        class="bg-gradient-to-r from-teal-500 to-indigo-600 hover:from-teal-600 hover:to-indigo-700 text-white shadow-xs mb-0.5"
        :loading="sending || isUploading"
        :disabled="!canSend"
        @click="handleSend"
        title="Send Message"
      />
    </div>
  </div>
</template>
