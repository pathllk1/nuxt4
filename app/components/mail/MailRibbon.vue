<script setup lang="ts">
import { useMail } from '@/composables/useMail';
import { useMailVault } from '@/composables/useMailVault';

const {
  activeAccount,
  selectedMessage,
  isSyncing,
  syncMailbox,
  openComposer,
  toggleRead,
  toggleFlag
} = useMail();

const { isVaultUnlocked } = useMailVault();
const emit = defineEmits<{
  (e: 'open-account-modal'): void;
  (e: 'open-vault-modal'): void;
}>();
</script>

<template>
  <div class="h-12 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 flex items-center justify-between gap-2 shrink-0 select-none shadow-xs">
    <!-- Left Command Actions -->
    <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
      <!-- New Mail Primary Button -->
      <UButton
        color="primary"
        icon="i-heroicons-envelope-plus"
        size="sm"
        label="New Mail"
        class="font-bold px-3 shadow-xs"
        @click="openComposer()"
      />

      <div class="h-5 w-px bg-slate-200 dark:bg-slate-800 mx-1" />

      <!-- Delete -->
      <UButton
        variant="ghost"
        color="neutral"
        size="xs"
        icon="i-heroicons-trash"
        label="Delete"
        :disabled="!selectedMessage"
        class="text-xs font-semibold"
      />

      <!-- Archive -->
      <UButton
        variant="ghost"
        color="neutral"
        size="xs"
        icon="i-heroicons-archive-box"
        label="Archive"
        :disabled="!selectedMessage"
        class="text-xs font-semibold"
      />

      <!-- Mark as Read / Unread -->
      <UButton
        variant="ghost"
        color="neutral"
        size="xs"
        :icon="selectedMessage?.isRead ? 'i-heroicons-envelope' : 'i-heroicons-envelope-open'"
        :label="selectedMessage?.isRead ? 'Mark Unread' : 'Mark Read'"
        :disabled="!selectedMessage"
        class="text-xs font-semibold"
        @click="selectedMessage && toggleRead(selectedMessage)"
      />

      <!-- Flag / Unflag -->
      <UButton
        variant="ghost"
        :color="selectedMessage?.isFlagged ? 'warning' : 'neutral'"
        size="xs"
        :icon="selectedMessage?.isFlagged ? 'i-heroicons-flag-solid' : 'i-heroicons-flag'"
        :label="selectedMessage?.isFlagged ? 'Flagged' : 'Flag'"
        :disabled="!selectedMessage"
        class="text-xs font-semibold"
        @click="selectedMessage && toggleFlag(selectedMessage)"
      />

      <!-- Sweep / Clean -->
      <UButton
        variant="ghost"
        color="neutral"
        size="xs"
        icon="i-heroicons-sparkles"
        label="Sweep"
        class="text-xs font-semibold hidden sm:inline-flex"
      />

      <!-- Move to Folder -->
      <UButton
        variant="ghost"
        color="neutral"
        size="xs"
        icon="i-heroicons-folder-arrow-down"
        label="Move to"
        :disabled="!selectedMessage"
        class="text-xs font-semibold hidden md:inline-flex"
      />
    </div>

    <!-- Right Sync & Security Vault Status -->
    <div class="flex items-center gap-2 shrink-0">
      <!-- Vault Status Badge -->
      <UButton
        :color="isVaultUnlocked ? 'success' : 'warning'"
        variant="subtle"
        size="xs"
        :icon="isVaultUnlocked ? 'i-heroicons-lock-open' : 'i-heroicons-lock-closed'"
        :label="isVaultUnlocked ? 'Vault Ready' : 'Unlock Vault'"
        class="font-mono text-[11px] font-bold"
        @click="emit('open-vault-modal')"
      />

      <!-- Sync Button -->
      <UButton
        variant="outline"
        color="primary"
        size="xs"
        icon="i-heroicons-arrow-path"
        :loading="isSyncing"
        label="Sync Now"
        class="font-semibold text-xs"
        @click="() => syncMailbox()"
      />

      <!-- Add Account -->
      <UButton
        variant="ghost"
        color="neutral"
        size="xs"
        icon="i-heroicons-cog-6-tooth"
        title="Mail Accounts & Settings"
        @click="emit('open-account-modal')"
      />
    </div>
  </div>
</template>

