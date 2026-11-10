<script setup lang="ts">
import { computed } from 'vue';
import type { MailMessage } from '@/types/mail';

const props = defineProps<{
  message: MailMessage;
  isSelected: boolean;
}>();

const emit = defineEmits<{
  (e: 'select'): void;
  (e: 'toggle-read'): void;
  (e: 'toggle-flag'): void;
  (e: 'delete'): void;
}>();

const formattedTime = computed(() => {
  if (!props.message.date) return '';
  const d = new Date(props.message.date);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
});

const senderInitial = computed(() => {
  const name = props.message.from?.name || props.message.from?.address || 'M';
  return name.slice(0, 1).toUpperCase();
});
</script>

<template>
  <div
    class="group relative p-3 border-b border-slate-100 dark:border-slate-800/80 cursor-pointer transition-all select-none"
    :class="[
      isSelected 
        ? 'bg-primary-50/90 dark:bg-primary-950/60 border-l-4 border-l-primary-500 shadow-2xs' 
        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 border-l-4 border-l-transparent',
      !message.isRead ? 'font-semibold' : 'text-slate-600 dark:text-slate-400'
    ]"
    @click="emit('select')"
  >
    <!-- Top Row: Sender & Date -->
    <div class="flex items-center justify-between gap-2 mb-1">
      <div class="flex items-center gap-2 min-w-0">
        <!-- Unread Blue Dot -->
        <span
          v-if="!message.isRead"
          class="w-2 h-2 rounded-full bg-primary-500 shrink-0"
          title="Unread"
        />

        <!-- Sender Name -->
        <span
          class="text-xs truncate"
          :class="!message.isRead ? 'font-black text-slate-900 dark:text-white' : 'font-semibold text-slate-700 dark:text-slate-300'"
        >
          {{ message.from?.name || message.from?.address }}
        </span>
      </div>

      <!-- Date / Time -->
      <span class="text-[11px] text-slate-400 dark:text-slate-500 font-mono shrink-0">
        {{ formattedTime }}
      </span>
    </div>

    <!-- Subject Row -->
    <div
      class="text-xs truncate mb-1"
      :class="[
        isSelected ? 'text-primary-800 dark:text-primary-200 font-bold' : '',
        !message.isRead ? 'font-bold text-slate-800 dark:text-slate-100' : 'text-slate-700 dark:text-slate-300'
      ]"
    >
      {{ message.subject || '(No Subject)' }}
    </div>

    <!-- Snippet Preview -->
    <p class="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
      {{ message.snippet }}
    </p>

    <!-- Bottom Badges: Attachments & Category -->
    <div class="flex items-center gap-2 mt-2">
      <span
        v-if="message.hasAttachments"
        class="inline-flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400 font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded"
      >
        <UIcon name="i-heroicons-paper-clip" class="w-3 h-3" />
        Attachment
      </span>

      <span
        v-if="message.categories && message.categories.length > 0"
        class="inline-block w-2 h-2 rounded-full bg-primary-500"
        :title="message.categories.join(', ')"
      />

      <span
        v-if="message.isFlagged"
        class="text-amber-500"
      >
        <UIcon name="i-heroicons-flag-solid" class="w-3 h-3" />
      </span>
    </div>

    <!-- Hover Action Toolbar (Outlook Style) -->
    <div class="absolute right-2 top-2 hidden group-hover:flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-0.5 shadow-sm">
      <UButton
        size="xs"
        variant="ghost"
        color="neutral"
        :icon="message.isRead ? 'i-heroicons-envelope' : 'i-heroicons-envelope-open'"
        :title="message.isRead ? 'Mark as Unread' : 'Mark as Read'"
        @click.stop="emit('toggle-read')"
      />
      <UButton
        size="xs"
        variant="ghost"
        :color="message.isFlagged ? 'warning' : 'neutral'"
        :icon="message.isFlagged ? 'i-heroicons-flag-solid' : 'i-heroicons-flag'"
        title="Flag / Unflag"
        @click.stop="emit('toggle-flag')"
      />
      <UButton
        size="xs"
        variant="ghost"
        color="error"
        icon="i-heroicons-trash"
        title="Delete"
        @click.stop="emit('delete')"
      />
    </div>
  </div>
</template>

