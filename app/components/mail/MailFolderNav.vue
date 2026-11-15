<script setup lang="ts">
import { computed } from 'vue';
import { useMail } from '@/composables/useMail';

const {
  accounts,
  activeAccount,
  switchAccount,
  folders,
  activeFolder,
  activeFolderId,
  selectFolder,
  fetchMessages
} = useMail();

const emit = defineEmits<{
  (e: 'open-account-modal'): void;
}>();

const getProviderBadge = (provider?: string, email?: string) => {
  const e = (email || '').toLowerCase();
  const p = (provider || '').toUpperCase();
  if (p === 'GMAIL' || e.includes('@gmail.')) {
    return { name: 'Gmail', icon: 'G', bg: 'bg-red-500', text: 'text-red-500' };
  }
  if (p === 'YAHOO' || e.includes('@yahoo.')) {
    return { name: 'Yahoo', icon: 'Y!', bg: 'bg-purple-600', text: 'text-purple-600' };
  }
  if (p === 'HOTMAIL' || p === 'OUTLOOK' || e.includes('@outlook.') || e.includes('@hotmail.')) {
    return { name: 'Outlook', icon: 'O', bg: 'bg-blue-600', text: 'text-blue-600' };
  }
  return { name: 'IMAP', icon: '✉', bg: 'bg-slate-700', text: 'text-slate-700' };
};

const accountMenuItems = computed(() => {
  const items: any[] = [];
  
  const accountEntries = accounts.value.map(acc => {
    const badge = getProviderBadge(acc.provider, acc.emailAddress);
    const isActive = activeAccount.value?.id === acc.id;
    return {
      label: acc.displayName || acc.emailAddress,
      description: acc.emailAddress,
      icon: isActive ? 'i-heroicons-check-circle' : 'i-heroicons-envelope',
      color: isActive ? 'primary' : 'neutral',
      onSelect: () => switchAccount(acc)
    };
  });

  if (accountEntries.length > 0) {
    items.push(accountEntries);
  }

  items.push([
    {
      label: 'Add Another Account',
      icon: 'i-heroicons-plus-circle',
      onSelect: () => emit('open-account-modal')
    }
  ]);

  return items;
});

// Deduplicate system folders (e.g. seeded Drafts + remote IMAP Draft) and sort in standard Outlook hierarchy
const deduplicatedFolders = computed(() => {
  const map = new Map<string, typeof folders.value[0]>();
  for (const f of folders.value) {
    const key = (f.specialUse && f.specialUse !== 'USER')
      ? `role:${f.specialUse}`
      : `name:${(f.name || f.id).trim().toLowerCase()}`;

    if (!map.has(key)) {
      map.set(key, { ...f });
    } else {
      const existing = map.get(key)!;
      existing.unreadCount = (existing.unreadCount || 0) + (f.unreadCount || 0);
      existing.totalCount = (existing.totalCount || 0) + (f.totalCount || 0);
    }
  }

  const priorityOrder: Record<string, number> = {
    'INBOX': 1,
    'SENT': 2,
    'DRAFTS': 3,
    'ARCHIVE': 4,
    'JUNK': 5,
    'TRASH': 6
  };

  return Array.from(map.values()).sort((a, b) => {
    const orderA = a.specialUse ? (priorityOrder[a.specialUse] || 50) : 50;
    const orderB = b.specialUse ? (priorityOrder[b.specialUse] || 50) : 50;
    if (orderA !== orderB) return orderA - orderB;
    return a.name.localeCompare(b.name);
  });
});

const getFolderIcon = (specialUse: string, name: string) => {
  switch (specialUse) {
    case 'INBOX': return 'i-heroicons-inbox';
    case 'SENT': return 'i-heroicons-paper-airplane';
    case 'DRAFTS': return 'i-heroicons-document-text';
    case 'ARCHIVE': return 'i-heroicons-archive-box';
    case 'JUNK': return 'i-heroicons-shield-exclamation';
    case 'TRASH': return 'i-heroicons-trash';
    default: return 'i-heroicons-folder';
  }
};
</script>

<template>
  <div class="w-64 border-r border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 flex flex-col h-full select-none shrink-0 min-h-0">
    <!-- Active Account Card / Switcher -->
    <div class="p-3 border-b border-slate-200/80 dark:border-slate-800 shrink-0">
      <div v-if="activeAccount" class="w-full">
        <UDropdownMenu :items="accountMenuItems" class="w-full">
          <div 
            class="flex items-center justify-between gap-2 p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs cursor-pointer hover:border-primary-400 dark:hover:border-primary-500 transition-all w-full group"
            title="Click to switch mail account"
          >
            <div class="flex items-center gap-2.5 min-w-0 flex-1">
              <div 
                class="w-7 h-7 rounded-lg text-white flex items-center justify-center font-black text-xs shrink-0 shadow-2xs"
                :class="getProviderBadge(activeAccount.provider, activeAccount.emailAddress).bg"
              >
                {{ getProviderBadge(activeAccount.provider, activeAccount.emailAddress).icon }}
              </div>
              <div class="min-w-0 flex-1 text-left">
                <div class="flex items-center gap-1.5">
                  <p class="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                    {{ activeAccount.displayName }}
                  </p>
                  <span v-if="accounts.length > 1" class="px-1.5 py-0.2 rounded-full bg-primary-100 dark:bg-primary-950 text-primary-700 dark:text-primary-300 text-[9px] font-mono font-bold shrink-0">
                    {{ accounts.length }}
                  </span>
                </div>
                <p class="text-[10px] text-slate-400 dark:text-slate-500 truncate font-mono">
                  {{ activeAccount.emailAddress }}
                </p>
              </div>
            </div>
            <UIcon name="i-heroicons-chevron-up-down" class="w-4 h-4 text-slate-400 group-hover:text-primary-500 transition-colors shrink-0" />
          </div>
        </UDropdownMenu>
      </div>

      <div v-else class="text-center py-2">
        <UButton
          icon="i-heroicons-plus-circle"
          label="Connect Mail Account"
          color="primary"
          variant="soft"
          size="xs"
          class="w-full justify-center font-bold"
          @click="emit('open-account-modal')"
        />
      </div>
    </div>

    <!-- All Connected Accounts / Mailboxes Section (Visible when > 1 account) -->
    <div v-if="accounts.length > 1" class="px-3 pt-2.5 pb-2 border-b border-slate-200/80 dark:border-slate-800 shrink-0 space-y-1 bg-white/40 dark:bg-slate-900/40">
      <div class="flex items-center justify-between px-1 text-[10px] font-black tracking-wider uppercase text-slate-400 dark:text-slate-500">
        <span>Mailboxes ({{ accounts.length }})</span>
        <button 
          @click="emit('open-account-modal')" 
          type="button" 
          class="text-primary-600 dark:text-primary-400 hover:underline font-bold text-[10px] flex items-center gap-0.5 cursor-pointer"
          title="Manage or add accounts"
        >
          <span>+ Add</span>
        </button>
      </div>

      <div class="space-y-1">
        <button
          v-for="acc in accounts"
          :key="acc.id"
          type="button"
          @click="switchAccount(acc)"
          class="w-full flex items-center justify-between p-1.5 rounded-xl text-left transition-all cursor-pointer border"
          :class="activeAccount?.id === acc.id 
            ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white border-primary-500/50 shadow-2xs font-bold ring-1 ring-primary-500/20' 
            : 'bg-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 border-transparent'"
        >
          <div class="flex items-center gap-2 min-w-0 flex-1">
            <div 
              class="w-5 h-5 rounded-md text-white flex items-center justify-center font-black text-[10px] shrink-0 shadow-2xs"
              :class="getProviderBadge(acc.provider, acc.emailAddress).bg"
            >
              {{ getProviderBadge(acc.provider, acc.emailAddress).icon }}
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-[11px] truncate leading-tight">{{ acc.displayName }}</p>
              <p class="text-[9px] text-slate-400 dark:text-slate-500 font-mono truncate leading-none">{{ acc.emailAddress }}</p>
            </div>
          </div>

          <span 
            v-if="activeAccount?.id === acc.id" 
            class="w-2 h-2 rounded-full bg-primary-500 shrink-0 ml-1.5"
            title="Active Mailbox"
          />
        </button>
      </div>
    </div>

    <!-- Folder Navigation Tree -->
    <div class="flex-1 overflow-y-auto min-h-0 p-2 space-y-1">
      <div class="px-2 py-1 text-[10px] font-black tracking-wider uppercase text-slate-400 dark:text-slate-500">
        Folders
      </div>

      <div
        v-for="folder in deduplicatedFolders"
        :key="folder.id"
        class="flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors"
        :class="activeFolderId === folder.id || (folder.specialUse && folder.specialUse !== 'USER' && activeFolder?.specialUse === folder.specialUse)
          ? 'bg-primary-50 dark:bg-primary-950/50 text-primary-700 dark:text-primary-300 font-bold border border-primary-200/50 dark:border-primary-800/40' 
          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/60'"
        @click="selectFolder(folder.id)"
      >
        <div class="flex items-center gap-2.5 min-w-0">
          <UIcon
            :name="getFolderIcon(folder.specialUse, folder.name)"
            class="w-4 h-4 shrink-0"
            :class="activeFolderId === folder.id ? 'text-primary-600 dark:text-primary-400' : 'text-slate-400'"
          />
          <span class="truncate">{{ folder.name }}</span>
        </div>

        <UBadge
          v-if="folder.unreadCount > 0"
          size="xs"
          :color="activeFolderId === folder.id ? 'primary' : 'neutral'"
          variant="subtle"
          class="font-mono text-[10px] font-bold px-1.5"
        >
          {{ folder.unreadCount }}
        </UBadge>
      </div>

      <!-- Categories & Color Labels -->
      <div class="pt-4 px-2 py-1 text-[10px] font-black tracking-wider uppercase text-slate-400 dark:text-slate-500">
        Categories
      </div>
      <div class="space-y-0.5">
        <div class="flex items-center gap-2 px-2.5 py-1 rounded-md text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
          <span class="w-2.5 h-2.5 rounded-full bg-blue-500" />
          <span>Site Work / Contractors</span>
        </div>
        <div class="flex items-center gap-2 px-2.5 py-1 rounded-md text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
          <span class="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          <span>Finance & Accounts</span>
        </div>
        <div class="flex items-center gap-2 px-2.5 py-1 rounded-md text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
          <span class="w-2.5 h-2.5 rounded-full bg-red-500" />
          <span>Urgent Attention</span>
        </div>
      </div>
    </div>

    <!-- Quick Footer Link to People -->
    <div class="p-2 border-t border-slate-200 dark:border-slate-800 shrink-0 select-none">
      <NuxtLink
        to="/mail/contacts"
        class="flex items-center gap-2 p-2 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 transition-colors no-underline"
      >
        <UIcon name="i-heroicons-user-group" class="w-4 h-4 text-indigo-500" />
        <span>People & Address Book</span>
      </NuxtLink>
    </div>
  </div>
</template>

