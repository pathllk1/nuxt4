<script setup lang="ts">
import { useMail } from '@/composables/useMail';

const {
  accounts,
  activeAccount,
  folders,
  activeFolderId,
  selectFolder,
  fetchMessages
} = useMail();

const emit = defineEmits<{
  (e: 'open-account-modal'): void;
}>();

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
  <div class="w-64 border-r border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 flex flex-col h-full select-none shrink-0">
    <!-- Active Account Card / Switcher -->
    <div class="p-3 border-b border-slate-200/80 dark:border-slate-800">
      <div v-if="activeAccount" class="flex items-center justify-between gap-2 p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs">
        <div class="flex items-center gap-2.5 min-w-0">
          <div class="w-7 h-7 rounded-lg bg-primary-500/10 text-primary-600 dark:text-primary-400 flex items-center justify-center font-bold text-xs shrink-0">
            {{ activeAccount.displayName.slice(0, 1).toUpperCase() }}
          </div>
          <div class="min-w-0">
            <p class="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
              {{ activeAccount.displayName }}
            </p>
            <p class="text-[10px] text-slate-400 dark:text-slate-500 truncate font-mono">
              {{ activeAccount.emailAddress }}
            </p>
          </div>
        </div>
        <UButton
          icon="i-heroicons-plus"
          size="xs"
          variant="ghost"
          color="neutral"
          title="Add another account"
          @click="emit('open-account-modal')"
        />
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

    <!-- Folder Navigation Tree -->
    <div class="flex-1 overflow-y-auto p-2 space-y-1">
      <div class="px-2 py-1 text-[10px] font-black tracking-wider uppercase text-slate-400 dark:text-slate-500">
        Folders
      </div>

      <div
        v-for="folder in folders"
        :key="folder.id"
        class="flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors"
        :class="activeFolderId === folder.id 
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
    <div class="p-2 border-t border-slate-200 dark:border-slate-800">
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

