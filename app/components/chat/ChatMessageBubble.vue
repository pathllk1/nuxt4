<script setup lang="ts">
import { ref, computed } from 'vue';
import type { ChatMessage } from '../../types/chat';
import { formatFileSize } from '../../utils/imageCompressor';

const props = defineProps<{
  message: ChatMessage;
  currentUserId: string;
  highlightQuery?: string;
  isCurrentMatch?: boolean;
}>();

const emit = defineEmits<{
  (e: 'reply', message: ChatMessage): void;
  (e: 'forward', message: ChatMessage): void;
  (e: 'delete', message: ChatMessage): void;
  (e: 'react', message: ChatMessage, emoji: string): void;
}>();

const isMe = computed(() => props.message.senderId === props.currentUserId);
const quickEmojis = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

const isPreviewModalOpen = ref(false);
const previewUrl = ref('');
const previewName = ref('');
const showMobileActions = ref(false);

const splitByQuery = (text: string, q?: string) => {
  if (!q || !q.trim()) return [{ text, highlight: false }];
  const trimmed = q.trim();
  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = text.split(regex);
  return parts.filter(Boolean).map(part => ({
    text: part,
    highlight: part.toLowerCase() === trimmed.toLowerCase()
  }));
};

const toggleActions = () => {
  if (props.message.isDeleted) return;
  showMobileActions.value = !showMobileActions.value;
};

const handleReact = (emoji: string) => {
  emit('react', props.message, emoji);
  showMobileActions.value = false;
};

const handleReply = () => {
  emit('reply', props.message);
  showMobileActions.value = false;
};

const handleForward = () => {
  emit('forward', props.message);
  showMobileActions.value = false;
};

const handleDelete = () => {
  emit('delete', props.message);
  showMobileActions.value = false;
};

/**
 * Route B2 private bucket attachments through the authenticated streaming proxy
 */
const getAttachmentUrl = (rawUrl?: string) => {
  if (!rawUrl) return '';
  if (rawUrl.startsWith('/api/chat/attachment')) return rawUrl;
  if (rawUrl.includes('backblazeb2.com')) {
    return `/api/chat/attachment?url=${encodeURIComponent(rawUrl)}`;
  }
  if (rawUrl.startsWith('chat/attachments/')) {
    return `/api/chat/attachment?path=${encodeURIComponent(rawUrl)}`;
  }
  return rawUrl;
};

const openPreview = (url: string, name: string) => {
  previewUrl.value = getAttachmentUrl(url);
  previewName.value = name;
  isPreviewModalOpen.value = true;
};

const imageAttachments = computed(() => {
  if (!props.message.attachments) return [];
  return props.message.attachments.filter(a => a.mimeType && a.mimeType.startsWith('image/'));
});

const docAttachments = computed(() => {
  if (!props.message.attachments) return [];
  return props.message.attachments.filter(a => !a.mimeType || !a.mimeType.startsWith('image/'));
});

const getDocIcon = (mimeType: string) => {
  if (mimeType.includes('pdf')) return 'i-lucide-file-text';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('csv')) {
    return 'i-lucide-file-spreadsheet';
  }
  if (mimeType.includes('word') || mimeType.includes('officedocument')) {
    return 'i-lucide-file-text';
  }
  return 'i-lucide-file';
};

const formatTime = (ts: number) => {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};
</script>

<template>
  <div class="group flex flex-col mb-3 transition-all relative" :class="isMe ? 'items-end' : 'items-start'">
    <!-- Mobile Dismiss Backdrop when Actions are open -->
    <div 
      v-if="showMobileActions" 
      class="fixed inset-0 z-20 bg-black/5 dark:bg-black/20" 
      @click="showMobileActions = false" 
    />

    <!-- Forwarded Badge Banner -->
    <div 
      v-if="message.forwardedFrom && !message.isDeleted" 
      class="flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400 mb-1 px-1 italic"
    >
      <UIcon name="i-lucide-forward" class="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
      <span>Forwarded from <strong>{{ message.forwardedFrom.originalSenderName }}</strong></span>
    </div>

    <!-- Bubble Wrapper with Floating Action Bar -->
    <div class="relative max-w-[85%] sm:max-w-md" :class="showMobileActions ? 'z-30' : ''">
      <!-- Floating Action Menu: Shows on Hover (Desktop) OR on Tap/Toggle (Mobile) -->
      <div 
        v-if="!message.isDeleted"
        class="transition-all duration-200 absolute -top-8.5 flex items-center gap-1 bg-white/95 dark:bg-gray-800/95 backdrop-blur-xs shadow-lg border border-gray-200/90 dark:border-gray-700/90 rounded-full px-2 py-0.5 z-30"
        :class="[
          isMe ? 'right-0' : 'left-0',
          showMobileActions 
            ? 'opacity-100 pointer-events-auto scale-100' 
            : 'opacity-0 pointer-events-none md:group-hover:opacity-100 md:group-hover:pointer-events-auto scale-95 md:group-hover:scale-100'
        ]"
      >
        <button 
          v-for="emoji in quickEmojis" 
          :key="emoji" 
          @click.stop="handleReact(emoji)"
          class="hover:scale-130 active:scale-125 transition-transform text-xs p-0.5 cursor-pointer bg-transparent border-0"
          :title="`React ${emoji}`"
        >
          {{ emoji }}
        </button>
        <div class="w-[1px] h-3 bg-gray-200 dark:bg-gray-700 mx-0.5"></div>
        <button 
          @click.stop="handleReply" 
          class="text-gray-500 hover:text-teal-600 active:text-teal-600 dark:hover:text-teal-400 p-0.5 cursor-pointer bg-transparent border-0 flex items-center" 
          title="Reply"
        >
          <UIcon name="i-lucide-reply" class="w-3.5 h-3.5" />
        </button>
        <button 
          @click.stop="handleForward" 
          class="text-gray-500 hover:text-teal-600 active:text-teal-600 dark:hover:text-teal-400 p-0.5 cursor-pointer bg-transparent border-0 flex items-center" 
          title="Forward"
        >
          <UIcon name="i-lucide-forward" class="w-3.5 h-3.5" />
        </button>
        <button 
          v-if="isMe"
          @click.stop="handleDelete" 
          class="text-gray-400 hover:text-red-500 active:text-red-500 dark:hover:text-red-400 p-0.5 cursor-pointer bg-transparent border-0 flex items-center" 
          title="Delete message"
        >
          <UIcon name="i-lucide-trash-2" class="w-3.5 h-3.5" />
        </button>
      </div>

      <!-- Quoted Reply Box -->
      <div 
        v-if="message.replyTo && !message.isDeleted" 
        class="text-xs rounded-t-xl px-3 py-1.5 border-l-4 border-teal-500 bg-black/5 dark:bg-white/5 mb-[-2px]"
      >
        <p class="font-bold text-[10px] text-teal-600 dark:text-teal-400">
          {{ message.replyTo.senderName || 'Replied message' }}
        </p>
        <p class="truncate opacity-80 text-[11px]">{{ message.replyTo.content }}</p>
      </div>

      <!-- Main Message Bubble Content -->
      <div 
        class="px-3.5 py-2 rounded-2xl text-sm shadow-xs transition-all overflow-hidden"
        :class="[
          isCurrentMatch ? 'ring-2 ring-amber-400 dark:ring-amber-300 ring-offset-2 dark:ring-offset-gray-900 shadow-md' : '',
          message.isDeleted
            ? 'bg-gray-100 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 border border-dashed border-gray-200 dark:border-gray-700'
            : (isMe 
                ? 'bg-gradient-to-r from-teal-600 via-teal-600 to-indigo-600 text-white rounded-tr-xs' 
                : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700/80 rounded-tl-xs')
        ]"
      >
        <!-- Deleted Message State -->
        <p v-if="message.isDeleted" class="flex items-center gap-1.5 text-xs italic select-none">
          <UIcon name="i-lucide-ban" class="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
          <span>This message was deleted</span>
        </p>

        <!-- Active Message Content -->
        <template v-else>
          <!-- Image Attachments -->
          <div v-if="imageAttachments.length > 0" class="space-y-2 mb-1.5 max-w-sm">
            <div 
              v-for="att in imageAttachments" 
              :key="att.id"
              class="relative rounded-xl overflow-hidden cursor-pointer group/img bg-black/10 dark:bg-black/30 min-h-[140px] max-h-80 flex items-center justify-center border border-white/10"
              @click="openPreview(att.url, att.name)"
            >
              <img 
                :src="getAttachmentUrl(att.url)" 
                :alt="att.name" 
                loading="lazy" 
                class="w-full h-auto max-h-80 object-cover rounded-xl transition-transform duration-200 hover:scale-[1.01] block" 
              />
              <div class="absolute inset-0 bg-black/0 hover:bg-black/20 transition-colors flex items-center justify-center">
                <div class="w-8 h-8 rounded-full bg-black/40 text-white flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity shadow-sm">
                  <UIcon name="i-lucide-zoom-in" class="w-4 h-4" />
                </div>
              </div>
            </div>
          </div>

          <!-- Document Attachments List -->
          <div v-if="docAttachments.length > 0" class="space-y-1.5 mb-1.5">
            <a 
              v-for="att in docAttachments" 
              :key="att.id"
              :href="getAttachmentUrl(att.url)" 
              target="_blank" 
              rel="noopener noreferrer"
              download
              class="flex items-center gap-2.5 p-2 rounded-xl border transition-colors"
              :class="isMe 
                ? 'bg-white/10 hover:bg-white/20 border-white/20 text-white' 
                : 'bg-gray-50 hover:bg-gray-100 dark:bg-gray-700/50 dark:hover:bg-gray-700 border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200'"
            >
              <div 
                class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                :class="isMe ? 'bg-white/20 text-white' : 'bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400'"
              >
                <UIcon :name="getDocIcon(att.mimeType)" class="w-4 h-4" />
              </div>
              <div class="min-w-0 flex-1">
                <p class="text-xs font-medium truncate leading-tight">{{ att.name }}</p>
                <p class="text-[10px] opacity-75 mt-0.5">{{ formatFileSize(att.size) }}</p>
              </div>
              <UIcon name="i-lucide-download" class="w-4 h-4 shrink-0 opacity-70" />
            </a>
          </div>

          <!-- Text Message Body (if present) -->
          <p v-if="message.content" class="whitespace-pre-wrap break-words leading-relaxed select-text px-0.5" @click="toggleActions">
            <template v-if="highlightQuery && highlightQuery.trim()">
              <span 
                v-for="(part, idx) in splitByQuery(message.content, highlightQuery)" 
                :key="idx"
                :class="part.highlight ? 'bg-amber-300 text-gray-950 font-bold rounded-xs px-0.5 shadow-2xs' : ''"
              >{{ part.text }}</span>
            </template>
            <template v-else>
              {{ message.content }}
            </template>
          </p>
        </template>

        <!-- Time & Delivery Status with Mobile Action Trigger -->
        <div 
          class="flex items-center justify-end gap-1.5 mt-1 text-[10px]" 
          :class="isMe ? 'text-white/80' : 'text-gray-400'"
        >
          <span>{{ formatTime(message.timestamp) }}</span>
          <template v-if="isMe && !message.isDeleted">
            <UIcon 
              v-if="message.status === 'read'" 
              name="i-lucide-check-check" 
              class="w-3.5 h-3.5 text-cyan-300 font-bold" 
              title="Read" 
            />
            <UIcon 
              v-else-if="message.status === 'delivered'" 
              name="i-lucide-check-check" 
              class="w-3.5 h-3.5 text-white/90" 
              title="Delivered" 
            />
            <UIcon 
              v-else-if="message.status === 'sending'" 
              name="i-lucide-clock" 
              class="w-3.5 h-3.5 text-white/60 animate-spin" 
              title="Sending..." 
            />
            <UIcon 
              v-else 
              name="i-lucide-check" 
              class="w-3.5 h-3.5 text-white/70" 
              title="Sent" 
            />
          </template>

          <!-- Subtle Mobile Action Menu Trigger (3 dots) -->
          <button 
            v-if="!message.isDeleted"
            type="button" 
            class="opacity-60 hover:opacity-100 p-0.5 rounded transition-opacity cursor-pointer bg-transparent border-0 inline-flex items-center -mr-0.5" 
            :class="isMe ? 'text-white hover:text-white' : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'"
            @click.stop="toggleActions"
            title="Actions (Reply, Forward, React)"
            aria-label="Actions"
          >
            <UIcon name="i-lucide-more-horizontal" class="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <!-- Reaction Chips -->
      <div 
        v-if="!message.isDeleted && message.reactions && Object.keys(message.reactions).length > 0" 
        class="flex flex-wrap gap-1 mt-1 px-1"
      >
        <button
          v-for="(users, emoji) in message.reactions"
          :key="emoji"
          @click="emit('react', message, emoji as string)"
          class="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border shadow-2xs transition-colors cursor-pointer"
          :class="users.includes(currentUserId) 
            ? 'bg-teal-50 border-teal-300 text-teal-700 dark:bg-teal-950 dark:border-teal-700 dark:text-teal-300 font-bold' 
            : 'bg-white border-gray-200 text-gray-600 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300 hover:bg-gray-50'"
          :title="`${users.length} reaction${users.length > 1 ? 's' : ''}`"
        >
          <span>{{ emoji }}</span>
          <span class="text-[10px]">{{ users.length }}</span>
        </button>
      </div>
    </div>

    <!-- Image Lightbox Modal -->
    <UModal :open="isPreviewModalOpen" @update:open="isPreviewModalOpen = $event">
      <template #content>
        <div class="p-4 space-y-3 max-w-2xl w-full">
          <div class="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-2">
            <h4 class="text-xs font-medium text-gray-600 dark:text-gray-300 truncate max-w-sm">
              {{ previewName }}
            </h4>
            <div class="flex items-center gap-2">
              <a 
                :href="previewUrl" 
                target="_blank" 
                download 
                class="text-teal-600 hover:text-teal-700 dark:text-teal-400 p-1 flex items-center gap-1 text-xs font-medium"
                title="Download"
              >
                <UIcon name="i-lucide-download" class="w-4 h-4" />
                <span>Download</span>
              </a>
              <UButton 
                icon="i-lucide-x" 
                color="neutral" 
                variant="ghost" 
                size="xs"
                @click="isPreviewModalOpen = false" 
              />
            </div>
          </div>
          <div class="flex items-center justify-center max-h-[70vh] overflow-hidden rounded-lg bg-black/5 dark:bg-black/40">
            <img :src="previewUrl" :alt="previewName" class="max-h-[70vh] w-auto object-contain rounded-lg shadow-md" />
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
