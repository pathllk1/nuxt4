<script setup lang="ts">
import { ref, watch, nextTick, onMounted } from 'vue';
import type { ChatMessage, ChatContact } from '../../types/chat';
import ChatMessageBubble from './ChatMessageBubble.vue';
import ChatInputBar from './ChatInputBar.vue';

const props = defineProps<{
  activeContact: ChatContact | null;
  messages: ChatMessage[];
  currentUserId: string;
  loadingHistory?: boolean;
  hasMoreHistory?: boolean;
  sending?: boolean;
  replyingTo?: ChatMessage | null;
}>();

const emit = defineEmits<{
  (e: 'send', content: string): void;
  (e: 'reply', message: ChatMessage): void;
  (e: 'cancel-reply'): void;
  (e: 'forward', message: ChatMessage): void;
  (e: 'react', message: ChatMessage, emoji: string): void;
  (e: 'load-older'): void;
  (e: 'back'): void;
}>();

const messagesContainer = ref<HTMLElement | null>(null);

const scrollToBottom = (smooth = true) => {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTo({
        top: messagesContainer.value.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto'
      });
    }
  });
};

// Scroll down when new messages arrive
watch(
  () => props.messages.length,
  (newLen, oldLen) => {
    if (newLen > (oldLen || 0)) {
      scrollToBottom(true);
    }
  }
);

// Initial scroll when switching conversation
watch(
  () => props.activeContact?.id,
  () => {
    scrollToBottom(false);
  }
);

onMounted(() => {
  scrollToBottom(false);
});

// Check if user performed any action within the last 5 minutes
const isRecentlyActive = (lastSeenAt?: number) => {
  if (!lastSeenAt) return false;
  return Date.now() - lastSeenAt < 5 * 60 * 1000;
};

// Format human-friendly relative activity status
const formatLastSeen = (lastSeenAt?: number) => {
  if (!lastSeenAt) return '';
  const diffMs = Date.now() - lastSeenAt;
  const diffMins = Math.floor(diffMs / (1000 * 60));
  if (diffMins < 5) return 'Active recently';
  if (diffMins < 60) return `Active ${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `Active ${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Active yesterday';
  return `Last active ${diffDays}d ago`;
};
</script>

<template>
  <div class="flex flex-col h-full bg-gray-50/50 dark:bg-gray-950">
    <!-- Active Contact Header -->
    <div 
      v-if="activeContact"
      class="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 shadow-2xs z-10"
    >
      <div class="flex items-center gap-3 min-w-0">
        <!-- Mobile Back Button -->
        <UButton 
          icon="i-lucide-arrow-left" 
          color="neutral" 
          variant="ghost" 
          size="sm" 
          class="md:hidden -ml-1 text-gray-500"
          @click="emit('back')"
        />

        <div class="relative">
          <UAvatar 
            :alt="activeContact.name" 
            size="md" 
            class="bg-gradient-to-tr from-teal-500 to-indigo-500 text-white font-bold" 
          />
          <span 
            v-if="isRecentlyActive(activeContact.lastSeenAt)"
            class="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-gray-900"
            title="Active recently"
          ></span>
        </div>

        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <h3 class="text-sm font-bold text-gray-900 dark:text-white truncate">
              {{ activeContact.name }}
            </h3>
            <UBadge 
              :color="activeContact.isOwnFirm ? 'neutral' : 'warning'" 
              variant="subtle" 
              size="xs"
            >
              {{ activeContact.isOwnFirm ? 'Own Firm' : activeContact.primaryFirmName }}
            </UBadge>
          </div>
          <p class="text-[11px] text-gray-400 dark:text-gray-500 truncate">
            {{ activeContact.email }}
          </p>
        </div>
      </div>

      <!-- Header Action Controls -->
      <div class="flex items-center gap-1">
        <UBadge 
          v-if="isRecentlyActive(activeContact.lastSeenAt)" 
          color="success" 
          variant="subtle" 
          size="xs" 
          class="hidden sm:inline-flex gap-1"
        >
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Active recently
        </UBadge>
        <span 
          v-else-if="formatLastSeen(activeContact.lastSeenAt)" 
          class="text-xs text-gray-400 dark:text-gray-500 hidden sm:inline font-medium"
        >
          {{ formatLastSeen(activeContact.lastSeenAt) }}
        </span>
      </div>
    </div>

    <!-- Main Message Timeline Stream -->
    <div 
      v-if="activeContact"
      ref="messagesContainer"
      class="flex-1 overflow-y-auto p-4 space-y-2"
    >
      <!-- Load Older History Button (Couchbase Capella) -->
      <div v-if="hasMoreHistory && messages.length >= 20" class="text-center py-2">
        <UButton
          size="xs"
          color="neutral"
          variant="subtle"
          :loading="loadingHistory"
          icon="i-lucide-history"
          @click="emit('load-older')"
        >
          Load older messages from archive
        </UButton>
      </div>

      <!-- No Messages Empty State -->
      <div v-if="messages.length === 0" class="flex flex-col items-center justify-center h-full text-center text-gray-400 space-y-2 py-16">
        <div class="w-12 h-12 rounded-full bg-teal-50 dark:bg-teal-950/40 text-teal-600 flex items-center justify-center">
          <UIcon name="i-lucide-message-circle" class="w-6 h-6" />
        </div>
        <p class="text-sm font-semibold text-gray-600 dark:text-gray-300">
          Conversation with {{ activeContact.name }}
        </p>
        <p class="text-xs max-w-xs text-gray-400">
          This is the start of your 1-on-1 enterprise chat. Send a message below to begin.
        </p>
      </div>

      <!-- Message Bubbles -->
      <template v-else>
        <ChatMessageBubble
          v-for="msg in messages"
          :key="msg.messageId"
          :message="msg"
          :current-user-id="currentUserId"
          @reply="emit('reply', msg)"
          @forward="emit('forward', msg)"
          @react="(m, emoji) => emit('react', m, emoji)"
        />
      </template>
    </div>

    <!-- No Active Contact Selected State -->
    <div 
      v-else 
      class="flex-1 flex flex-col items-center justify-center p-8 text-center text-gray-400 bg-gray-50/50 dark:bg-gray-950"
    >
      <div class="w-16 h-16 rounded-2xl bg-gradient-to-tr from-teal-500/10 to-indigo-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center mb-4 border border-teal-500/20">
        <UIcon name="i-lucide-messages-square" class="w-8 h-8" />
      </div>
      <h3 class="text-base font-bold text-gray-800 dark:text-gray-200">
        Enterprise 1-on-1 Chat
      </h3>
      <p class="text-xs text-gray-500 dark:text-gray-400 max-w-sm mt-1">
        Select a colleague from your firm or an external partner on the left to view messages and start collaborating.
      </p>
    </div>

    <!-- Docked Input Bar -->
    <ChatInputBar 
      v-if="activeContact"
      :replying-to="replyingTo"
      :sending="sending"
      @send="emit('send', $event)"
      @cancel-reply="emit('cancel-reply')"
    />
  </div>
</template>
