<script setup lang="ts">
import { ref, computed } from 'vue';
import type { ChatContact } from '../../types/chat';

const props = defineProps<{
  contacts: ChatContact[];
  activeContactId?: string | null;
  loading?: boolean;
}>();

const emit = defineEmits<{
  (e: 'select', contact: ChatContact): void;
}>();

const searchQuery = ref('');
const activeTab = ref<'all' | 'internal' | 'external'>('all');

// Filter contacts by search query
const filteredContacts = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  let list = props.contacts;

  if (activeTab.value === 'internal') {
    list = list.filter(c => c.isOwnFirm);
  } else if (activeTab.value === 'external') {
    list = list.filter(c => !c.isOwnFirm);
  }

  if (!query) return list;

  return list.filter(c => 
    c.name.toLowerCase().includes(query) ||
    c.email.toLowerCase().includes(query) ||
    (c.primaryFirmName && c.primaryFirmName.toLowerCase().includes(query))
  );
});

// Grouped contacts for display
const ownFirmContacts = computed(() => {
  return filteredContacts.value.filter(c => c.isOwnFirm);
});

const otherFirmContacts = computed(() => {
  return filteredContacts.value.filter(c => !c.isOwnFirm);
});

const totalUnreadCount = computed(() => {
  return props.contacts.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
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
  if (diffMins < 5) return 'Active now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  return `${diffDays}d ago`;
};
</script>

<template>
  <div class="flex flex-col h-full bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 overflow-hidden">
    <!-- Header Section -->
    <div class="p-4 border-b border-gray-200 dark:border-gray-800 space-y-3 shrink-0">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-messages-square" class="w-5 h-5 text-teal-600 dark:text-teal-400" />
          <h2 class="text-base font-bold text-gray-900 dark:text-white">Direct Messages</h2>
        </div>
        <UBadge v-if="totalUnreadCount > 0" color="error" variant="solid" size="xs" class="animate-pulse">
          {{ totalUnreadCount }} new
        </UBadge>
      </div>

      <!-- Search Input -->
      <UInput 
        v-model="searchQuery" 
        icon="i-lucide-search" 
        placeholder="Search colleagues or firms..." 
        variant="subtle" 
        size="sm"
        class="w-full"
      >
        <template #trailing v-if="searchQuery">
          <button @click="searchQuery = ''" class="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <UIcon name="i-lucide-x" class="w-3.5 h-3.5" />
          </button>
        </template>
      </UInput>

      <!-- Category Filter Tabs -->
      <div class="grid grid-cols-3 gap-1 bg-gray-100 dark:bg-gray-800/60 p-1 rounded-lg text-xs">
        <button
          @click="activeTab = 'all'"
          class="py-1 px-2 rounded-md font-medium transition-all text-center"
          :class="activeTab === 'all' 
            ? 'bg-white dark:bg-gray-700 text-teal-600 dark:text-teal-400 shadow-xs' 
            : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'"
        >
          All ({{ contacts.length }})
        </button>
        <button
          @click="activeTab = 'internal'"
          class="py-1 px-2 rounded-md font-medium transition-all text-center"
          :class="activeTab === 'internal' 
            ? 'bg-white dark:bg-gray-700 text-teal-600 dark:text-teal-400 shadow-xs' 
            : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'"
        >
          Firm
        </button>
        <button
          @click="activeTab = 'external'"
          class="py-1 px-2 rounded-md font-medium transition-all text-center"
          :class="activeTab === 'external' 
            ? 'bg-white dark:bg-gray-700 text-teal-600 dark:text-teal-400 shadow-xs' 
            : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'"
        >
          Partners
        </button>
      </div>
    </div>

    <!-- Contact Stream List -->
    <div class="flex-1 min-h-0 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800/40 p-2 space-y-1 overscroll-contain">
      <!-- Loading Skeleton -->
      <div v-if="loading && contacts.length === 0" class="space-y-3 p-3">
        <div v-for="i in 5" :key="i" class="flex items-center gap-3 animate-pulse">
          <div class="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-800"></div>
          <div class="flex-1 space-y-1.5">
            <div class="h-3.5 bg-gray-200 dark:bg-gray-800 rounded w-2/3"></div>
            <div class="h-2.5 bg-gray-200 dark:bg-gray-800 rounded w-1/3"></div>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else-if="filteredContacts.length === 0" class="p-6 text-center text-gray-400 text-xs">
        <UIcon name="i-lucide-user-x" class="w-8 h-8 mx-auto mb-2 text-gray-300 dark:text-gray-700" />
        <p>No contacts found</p>
      </div>

      <template v-else>
        <!-- Internal Firm Section -->
        <div v-if="ownFirmContacts.length > 0 && activeTab !== 'external'" class="mb-3">
          <div class="px-2 py-1.5 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider flex items-center justify-between">
            <span>Internal Firm Colleagues</span>
            <span class="text-[9px]">{{ ownFirmContacts.length }}</span>
          </div>

          <div
            v-for="contact in ownFirmContacts"
            :key="contact.id"
            @click="emit('select', contact)"
            class="flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all duration-200"
            :class="activeContactId === contact.id 
              ? 'bg-teal-50 dark:bg-teal-950/40 text-teal-900 dark:text-teal-100 ring-1 ring-teal-500/30' 
              : 'hover:bg-gray-50 dark:hover:bg-gray-800/60 text-gray-800 dark:text-gray-200'"
          >
            <div class="flex items-center gap-3 min-w-0">
              <div class="relative">
                <UAvatar :alt="contact.name" size="md" class="bg-gradient-to-tr from-teal-500 to-indigo-500 text-white font-bold" />
                <span 
                  v-if="isRecentlyActive(contact.lastSeenAt)"
                  class="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-gray-900"
                  title="Active recently"
                ></span>
              </div>
              <div class="min-w-0 flex-1">
                <p class="text-sm font-semibold truncate">{{ contact.name }}</p>
                <div class="flex items-center gap-1.5 mt-0.5">
                  <UBadge color="neutral" variant="subtle" size="xs">
                    Own Firm
                  </UBadge>
                  <span v-if="formatLastSeen(contact.lastSeenAt)" class="text-[10px] text-gray-400 truncate">
                    {{ formatLastSeen(contact.lastSeenAt) }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Unread Badge -->
            <UBadge 
              v-if="contact.unreadCount && contact.unreadCount > 0" 
              color="error" 
              variant="solid" 
              size="xs"
              class="ml-2 font-bold"
            >
              {{ contact.unreadCount }}
            </UBadge>
          </div>
        </div>

        <!-- External Partners Section -->
        <div v-if="otherFirmContacts.length > 0 && activeTab !== 'internal'">
          <div class="px-2 py-1.5 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider flex items-center justify-between">
            <span>External Partner Firms</span>
            <span class="text-[9px]">{{ otherFirmContacts.length }}</span>
          </div>

          <div
            v-for="contact in otherFirmContacts"
            :key="contact.id"
            @click="emit('select', contact)"
            class="flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all duration-200"
            :class="activeContactId === contact.id 
              ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-100 ring-1 ring-indigo-500/30' 
              : 'hover:bg-gray-50 dark:hover:bg-gray-800/60 text-gray-800 dark:text-gray-200'"
          >
            <div class="flex items-center gap-3 min-w-0">
              <div class="relative">
                <UAvatar :alt="contact.name" size="md" class="bg-gradient-to-tr from-amber-500 to-rose-500 text-white font-bold" />
                <span 
                  v-if="isRecentlyActive(contact.lastSeenAt)"
                  class="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-gray-900"
                  title="Active recently"
                ></span>
              </div>
              <div class="min-w-0 flex-1">
                <p class="text-sm font-semibold truncate">{{ contact.name }}</p>
                <div class="flex items-center gap-1.5 mt-0.5">
                  <UBadge color="warning" variant="subtle" size="xs" class="truncate max-w-[140px]">
                    {{ contact.primaryFirmName }}
                  </UBadge>
                  <span v-if="formatLastSeen(contact.lastSeenAt)" class="text-[10px] text-gray-400 truncate">
                    {{ formatLastSeen(contact.lastSeenAt) }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Unread Badge -->
            <UBadge 
              v-if="contact.unreadCount && contact.unreadCount > 0" 
              color="error" 
              variant="solid" 
              size="xs"
              class="ml-2 font-bold"
            >
              {{ contact.unreadCount }}
            </UBadge>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
