<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useMail } from '@/composables/useMail';
import { useMailVault } from '@/composables/useMailVault';
import MailRibbon from './MailRibbon.vue';
import MailFolderNav from './MailFolderNav.vue';
import MailListPane from './MailListPane.vue';
import MailReadingPane from './MailReadingPane.vue';
import MailComposer from './MailComposer.vue';
import MailAccountModal from './MailAccountModal.vue';
import MailVaultModal from './MailVaultModal.vue';

const { fetchAccounts, fetchFolders, fetchMessages, activeAccount } = useMail();
const { autoUnlockIfPossible } = useMailVault();

const isAccountModalOpen = ref(false);
const isVaultModalOpen = ref(false);

onMounted(async () => {
  await fetchAccounts();
  if (activeAccount.value?.encryptedVaultBlob) {
    await autoUnlockIfPossible(activeAccount.value.encryptedVaultBlob);
  } else {
    await autoUnlockIfPossible();
  }
  await fetchFolders();
  await fetchMessages();
});
</script>

<template>
  <div class="flex flex-col h-[calc(100vh-4rem)] w-full overflow-hidden bg-slate-100 dark:bg-slate-950">
    <!-- Top Simplified Ribbon -->
    <MailRibbon
      @open-account-modal="isAccountModalOpen = true"
      @open-vault-modal="isVaultModalOpen = true"
    />

    <!-- Three-Pane Resizable Outlook Workspace -->
    <div class="flex-1 flex overflow-hidden min-h-0">
      <!-- Pane 1: Navigation & Folders -->
      <MailFolderNav
        @open-account-modal="isAccountModalOpen = true"
      />

      <!-- Pane 2: Message List & Focused Tabs -->
      <MailListPane />

      <!-- Pane 3: Reading Pane -->
      <MailReadingPane />
    </div>

    <!-- Floating Dockable Composer -->
    <MailComposer />

    <!-- Modals -->
    <MailAccountModal
      v-model:open="isAccountModalOpen"
    />

    <MailVaultModal
      v-model:open="isVaultModalOpen"
    />
  </div>
</template>

