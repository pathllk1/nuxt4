<script setup lang="ts">
import { ref } from 'vue';
import { useMailVault } from '@/composables/useMailVault';
import { useMail } from '@/composables/useMail';
import { useToast } from '#imports';

const props = defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:open', val: boolean): void;
  (e: 'unlocked'): void;
}>();

const { isVaultUnlocked, unlockVault, lockVault } = useMailVault();
const { activeAccount } = useMail();
const toast = useToast();
const pinInput = ref('');
const unlocking = ref(false);

const onUnlock = async () => {
  if (!pinInput.value) return;
  unlocking.value = true;
  try {
    const ok = await unlockVault(pinInput.value, undefined, activeAccount.value?.encryptedVaultBlob);
    if (ok) {
      toast.add({ title: 'Vault Unlocked', description: 'AES-256 keys active in browser memory', color: 'success' });
      emit('update:open', false);
      emit('unlocked');
      pinInput.value = '';
    } else {
      toast.add({
        title: 'Incorrect PIN',
        description: 'The entered PIN could not decrypt your account credentials (Default PIN: 1234)',
        color: 'error'
      });
    }
  } finally {
    unlocking.value = false;
  }
};

const onLock = () => {
  lockVault();
  toast.add({ title: 'Vault Locked', description: 'Keys purged from memory', color: 'neutral' });
  emit('update:open', false);
};
</script>

<template>
  <UModal
    :open="open"
    title="Client Security Vault"
    description="Your mail credentials are protected with zero-knowledge AES-256-GCM encryption."
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <div class="space-y-4 text-xs select-none py-2">
        <div v-if="isVaultUnlocked" class="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-center space-y-2">
          <UIcon name="i-heroicons-lock-open" class="w-8 h-8 text-emerald-500 mx-auto" />
          <p class="font-bold text-emerald-900 dark:text-emerald-200 text-sm">Vault is Currently Unlocked</p>
          <p class="text-[11px] text-emerald-700 dark:text-emerald-300">
            You can sync emails and dispatch outgoing mail without entering your PIN again during this browser session.
          </p>
          <UButton
            color="error"
            variant="soft"
            size="xs"
            label="Lock Vault Now (Purge Keys)"
            class="font-bold mx-auto cursor-pointer"
            @click="onLock"
          />
        </div>

        <div v-else class="space-y-3">
          <p class="text-slate-600 dark:text-slate-400 leading-relaxed text-center">
            Enter your 4+ digit Vault PIN to decrypt your account credentials in browser memory:
          </p>
          <div class="flex justify-center">
            <UInput
              v-model="pinInput"
              type="password"
              maxlength="8"
              placeholder="1234"
              size="lg"
              class="w-48 text-center font-mono font-bold text-lg"
              @keydown.enter="onUnlock"
            />
          </div>
          <p class="text-[11px] text-slate-400 dark:text-slate-500 text-center">
            Default setup PIN is <span class="font-mono font-bold text-slate-700 dark:text-slate-300">1234</span>
          </p>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex items-center justify-end gap-2 w-full">
        <UButton
          variant="ghost"
          color="neutral"
          size="sm"
          label="Cancel"
          @click="emit('update:open', false)"
        />
        <UButton
          v-if="!isVaultUnlocked"
          color="primary"
          size="sm"
          icon="i-heroicons-key"
          :loading="unlocking"
          label="Unlock Vault"
          class="font-bold px-4 cursor-pointer"
          @click="onUnlock"
        />
      </div>
    </template>
  </UModal>
</template>
