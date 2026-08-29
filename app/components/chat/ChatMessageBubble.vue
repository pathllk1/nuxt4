<script setup lang="ts">
import { computed } from 'vue';
import type { ChatMessage } from '../../types/chat';

const props = defineProps<{
  message: ChatMessage;
  currentUserId: string;
}>();

const emit = defineEmits<{
  (e: 'reply', message: ChatMessage): void;
  (e: 'forward', message: ChatMessage): void;
  (e: 'react', message: ChatMessage, emoji: string): void;
}>();

const isMe = computed(() => props.message.senderId === props.currentUserId);
const quickEmojis = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

const formatTime = (ts: number) => {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};
</script>

<template>
  <div class="group flex flex-col mb-3 transition-all" :class="isMe ? 'items-end' : 'items-start'">
    <!-- Forwarded Badge Banner -->
    <div 
      v-if="message.forwardedFrom" 
      class="flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400 mb-1 px-1 italic"
    >
      <UIcon name="i-lucide-forward" class="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
      <span>Forwarded from <strong>{{ message.forwardedFrom.originalSenderName }}</strong></span>
    </div>

    <!-- Bubble Wrapper with Floating Action Bar -->
    <div class="relative max-w-[85%] sm:max-w-md">
      <!-- Floating Action Menu on Hover -->
      <div 
        class="opacity-0 group-hover:opacity-100 transition-all duration-200 absolute -top-8 flex items-center gap-1 bg-white/95 dark:bg-gray-800/95 backdrop-blur-xs shadow-md border border-gray-200/80 dark:border-gray-700/80 rounded-full px-2 py-0.5 z-10"
        :class="isMe ? 'right-0' : 'left-0'"
      >
        <button 
          v-for="emoji in quickEmojis" 
          :key="emoji" 
          @click="emit('react', message, emoji)"
          class="hover:scale-130 transition-transform text-xs p-0.5 cursor-pointer bg-transparent border-0"
          :title="`React ${emoji}`"
        >
          {{ emoji }}
        </button>
        <div class="w-[1px] h-3 bg-gray-200 dark:bg-gray-700 mx-0.5"></div>
        <button 
          @click="emit('reply', message)" 
          class="text-gray-500 hover:text-teal-600 dark:hover:text-teal-400 p-0.5 cursor-pointer bg-transparent border-0 flex items-center" 
          title="Reply"
        >
          <UIcon name="i-lucide-reply" class="w-3.5 h-3.5" />
        </button>
        <button 
          @click="emit('forward', message)" 
          class="text-gray-500 hover:text-teal-600 dark:hover:text-teal-400 p-0.5 cursor-pointer bg-transparent border-0 flex items-center" 
          title="Forward"
        >
          <UIcon name="i-lucide-forward" class="w-3.5 h-3.5" />
        </button>
      </div>

      <!-- Quoted Reply Box -->
      <div 
        v-if="message.replyTo" 
        class="text-xs rounded-t-xl px-3 py-1.5 border-l-4 border-teal-500 bg-black/5 dark:bg-white/5 mb-[-2px]"
      >
        <p class="font-bold text-[10px] text-teal-600 dark:text-teal-400">
          {{ message.replyTo.senderName || 'Replied message' }}
        </p>
        <p class="truncate opacity-80 text-[11px]">{{ message.replyTo.content }}</p>
      </div>

      <!-- Main Message Bubble Content -->
      <div 
        class="px-4 py-2.5 rounded-2xl text-sm shadow-xs transition-shadow"
        :class="isMe 
          ? 'bg-gradient-to-r from-teal-600 via-teal-600 to-indigo-600 text-white rounded-tr-xs' 
          : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700/80 rounded-tl-xs'"
      >
        <p class="whitespace-pre-wrap break-words leading-relaxed select-text">{{ message.content }}</p>

        <!-- Time & Delivery Status -->
        <div 
          class="flex items-center justify-end gap-1.5 mt-1 text-[10px]" 
          :class="isMe ? 'text-white/80' : 'text-gray-400'"
        >
          <span>{{ formatTime(message.timestamp) }}</span>
          <template v-if="isMe">
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
        </div>
      </div>

      <!-- Reaction Chips -->
      <div 
        v-if="message.reactions && Object.keys(message.reactions).length > 0" 
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
  </div>
</template>
