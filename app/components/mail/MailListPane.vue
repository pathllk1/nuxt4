<script setup lang="ts">
import { ref, watch } from 'vue';
import { useMail } from '@/composables/useMail';
import MailListItem from './MailListItem.vue';

const {
  activeFolder,
  activeTab,
  activeFilter,
  searchQuery,
  messages,
  selectedMessage,
  loadingMessages,
  fetchMessages,
  selectMessage,
  toggleRead,
  toggleFlag
} = useMail();

const searchInput = ref('');
let searchTimeout: any = null;

const onSearch = () => {
  if (searchTimeout) clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    searchQuery.value = searchInput.value;
    fetchMessages();
  }, 300);
};

const setTab = (tab: 'focused' | 'other') => {
  activeTab.value = tab;
  fetchMessages();
};

const setFilter = (filter: 'all' | 'unread' | 'flagged' | 'files') => {
  activeFilter.value = filter;
  fetchMessages();
};
</script>

<template>
  <div class="w-80 md:w-96 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col h-full shrink-0 select-none">
    <!-- Top Search Bar -->
    <div class="p-2.5 border-b border-slate-200/80 dark:border-slate-800">
      <UInput
        v-model="searchInput"
        icon="i-heroicons-magnifying-glass"
        placeholder="Search folder..."
        size="xs"
        class="w-full"
        @input="onSearch"
      />
    </div>

    <!-- Focused vs Other Tab Header (Outlook Signature) -->
    <div class="flex items-center justify-between px-3 pt-2 border-b border-slate-200/70 dark:border-slate-800">
      <div v-if="activeFolder.id === 'INBOX'" class="flex items-center gap-4">
        <button
          class="pb-2 text-xs font-bold transition-colors cursor-pointer border-b-2"
          :class="activeTab === 'focused' 
            ? 'border-primary-500 text-primary-600 dark:text-primary-400' 
            : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'"
          @click="setTab('focused')"
        >
          Focused
        </button>

        <button
          class="pb-2 text-xs font-bold transition-colors cursor-pointer border-b-2"
          :class="activeTab === 'other' 
            ? 'border-primary-500 text-primary-600 dark:text-primary-400' 
            : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'"
          @click="setTab('other')"
        >
          Other
        </button>
      </div>

      <div v-else class="pb-2 text-xs font-bold text-slate-700 dark:text-slate-200">
        {{ activeFolder.name }}
      </div>

      <!-- Filter Pills -->
      <div class="flex items-center gap-1 pb-2">
        <button
          class="px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors"
          :class="activeFilter === 'unread' ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/60 dark:text-primary-300' : 'text-slate-400 hover:text-slate-600'"
          @click="setFilter(activeFilter === 'unread' ? 'all' : 'unread')"
        >
          Unread
        </button>
        <button
          class="px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors"
          :class="activeFilter === 'flagged' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300' : 'text-slate-400 hover:text-slate-600'"
          @click="setFilter(activeFilter === 'flagged' ? 'all' : 'flagged')"
        >
          Flagged
        </button>
      </div>
    </div>

    <!-- Messages Scroll Container -->
    <div class="flex-1 overflow-y-auto">
      <div v-if="loadingMessages" class="p-6 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
        <UIcon name="i-heroicons-arrow-path" class="w-5 h-5 animate-spin text-primary-500" />
        <span>Loading messages from Couchbase...</span>
      </div>

      <div v-else-if="messages.length === 0" class="p-8 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
        <UIcon name="i-heroicons-inbox" class="w-8 h-8 text-slate-300 dark:text-slate-600" />
        <span class="font-bold text-slate-600 dark:text-slate-300">Nothing here</span>
        <span class="text-[11px] text-slate-400">No messages found in this folder or filter.</span>
        <UButton
          v-if="activeFolder.id === 'INBOX' && activeTab === 'focused'"
          variant="soft"
          color="primary"
          size="xs"
          icon="i-heroicons-arrow-right"
          label="Switch to 'Other' Tab"
          class="mt-2 text-xs font-semibold cursor-pointer"
          @click="setTab('other')"
        />
        <UButton
          v-else-if="activeFolder.id === 'INBOX' && activeTab === 'other'"
          variant="soft"
          color="primary"
          size="xs"
          icon="i-heroicons-arrow-left"
          label="Switch to 'Focused' Tab"
          class="mt-2 text-xs font-semibold cursor-pointer"
          @click="setTab('focused')"
        />
      </div>

      <div v-else class="divide-y divide-slate-100 dark:divide-slate-800/60">
        <MailListItem
          v-for="msg in messages"
          :key="msg.id"
          :message="msg"
          :is-selected="selectedMessage?.id === msg.id"
          @select="selectMessage(msg)"
          @toggle-read="toggleRead(msg)"
          @toggle-flag="toggleFlag(msg)"
        />
      </div>
    </div>
  </div>
</template>

