<script setup lang="ts">
import { computed } from 'vue';
import { useMail } from '@/composables/useMail';
import { useMailVault } from '@/composables/useMailVault';
import { printMailContent } from '@/utils/mail-print';
import { exportMailToEml, exportMailToPdf, exportMailToText } from '@/utils/mail-export';

const {
  activeAccount,
  selectedMessage,
  selectedThread,
  isSyncing,
  lastSyncMeta,
  syncMailbox,
  openComposer,
  toggleRead,
  toggleFlag
} = useMail();

const { isVaultUnlocked } = useMailVault();
const toast = useToast();

const lastSyncTooltip = computed(() => {
  if (!lastSyncMeta.value?.lastSyncTimestamp) return 'Sync mailbox with server';
  const d = new Date(lastSyncMeta.value.lastSyncTimestamp);
  const now = new Date();
  const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === now.toDateString()) {
    return `Auto-synced today at ${timeStr} (IndexedDB)`;
  }
  return `Last synced: ${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${timeStr}`;
});

const emit = defineEmits<{
  (e: 'open-account-modal'): void;
  (e: 'open-vault-modal'): void;
}>();

const onPrintRibbon = () => {
  if (!selectedMessage.value) return;
  printMailContent({
    message: selectedMessage.value,
    thread: selectedThread.value,
    printEntireThread: (selectedThread.value?.length || 0) > 1
  });
};

const ribbonExportItems = computed(() => {
  const items: any[] = [
    {
      label: 'Export as PDF (.pdf)',
      icon: 'i-heroicons-document-arrow-down',
      onSelect: async () => {
        if (!selectedMessage.value) return;
        try {
          toast.add({ title: 'Downloading PDF...', color: 'neutral' });
          await exportMailToPdf({
            messageId: selectedMessage.value.id,
            subject: selectedMessage.value.subject,
            isThread: false
          });
          toast.add({ title: 'PDF Downloaded', color: 'success' });
        } catch (err: any) {
          toast.add({ title: 'Export Failed', description: err.message, color: 'error' });
        }
      }
    },
    {
      label: 'Export as EML (.eml)',
      icon: 'i-heroicons-envelope',
      onSelect: () => {
        if (!selectedMessage.value) return;
        exportMailToEml(selectedMessage.value);
        toast.add({ title: 'EML Exported', description: 'Compatible with Outlook & Mail apps', color: 'success' });
      }
    },
    {
      label: 'Export as Text (.txt)',
      icon: 'i-heroicons-document-text',
      onSelect: () => {
        if (!selectedMessage.value) return;
        exportMailToText({
          message: selectedMessage.value,
          thread: selectedThread.value,
          exportEntireThread: false
        });
        toast.add({ title: 'Transcript Exported', color: 'success' });
      }
    }
  ];

  if ((selectedThread.value?.length || 0) > 1) {
    items.push({
      label: `Export Thread (PDF - ${selectedThread.value.length} msgs)`,
      icon: 'i-heroicons-chat-bubble-left-right',
      onSelect: async () => {
        if (!selectedMessage.value) return;
        try {
          toast.add({ title: 'Downloading Thread PDF...', color: 'neutral' });
          await exportMailToPdf({
            messageId: selectedMessage.value.id,
            subject: selectedMessage.value.subject,
            isThread: true
          });
          toast.add({ title: 'Thread PDF Downloaded', color: 'success' });
        } catch (err: any) {
          toast.add({ title: 'Export Failed', description: err.message, color: 'error' });
        }
      }
    });
  }

  return [items];
});
</script>

<template>
  <div class="h-12 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 flex items-center justify-between gap-2 shrink-0 select-none shadow-xs">
    <!-- Left Command Actions -->
    <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
      <!-- New Mail Primary Button -->
      <UButton
        color="primary"
        icon="i-heroicons-pencil-square"
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

      <div class="h-5 w-px bg-slate-200 dark:bg-slate-800 mx-1 hidden sm:block" />

      <!-- Print -->
      <UButton
        variant="ghost"
        color="neutral"
        size="xs"
        icon="i-heroicons-printer"
        label="Print"
        :disabled="!selectedMessage"
        class="text-xs font-semibold"
        title="Print email or conversation (Ctrl+P)"
        @click="onPrintRibbon"
      />

      <!-- Export Dropdown -->
      <UDropdownMenu :items="ribbonExportItems" :disabled="!selectedMessage">
        <UButton
          variant="ghost"
          color="neutral"
          size="xs"
          icon="i-heroicons-arrow-down-tray"
          label="Export"
          :disabled="!selectedMessage"
          class="text-xs font-semibold"
          title="Export email to PDF, EML or Text"
        />
      </UDropdownMenu>
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

      <!-- Sync Button with IndexedDB Status Tooltip -->
      <UButton
        variant="outline"
        color="primary"
        size="xs"
        icon="i-heroicons-arrow-path"
        :loading="isSyncing"
        label="Sync Now"
        class="font-semibold text-xs"
        :title="lastSyncTooltip"
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

