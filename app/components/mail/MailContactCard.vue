<script setup lang="ts">
import { computed } from 'vue';
import { useMail } from '@/composables/useMail';
import type { MailAddress } from '@/types/mail';

const props = defineProps<{
  contact: MailAddress;
}>();

const { openComposer } = useMail();

const isContractorMatch = computed(() => {
  const name = (props.contact.name || '').toUpperCase();
  const email = (props.contact.address || '').toLowerCase();
  return name.includes('RAJESH PATHAK') || email.includes('rajesh');
});

const onSendMail = () => {
  openComposer({
    to: [props.contact.address],
    subject: ''
  });
};
</script>

<template>
  <div class="p-3 w-80 text-left select-none">
    <!-- Header -->
    <div class="flex items-center gap-3 mb-3">
      <div class="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-primary-500 text-white flex items-center justify-center font-bold text-sm shadow-xs">
        {{ (contact.name || contact.address || 'U').slice(0, 1).toUpperCase() }}
      </div>
      <div class="min-w-0 flex-1">
        <h4 class="text-xs font-bold text-slate-900 dark:text-white truncate">
          {{ contact.name || contact.address.split('@')[0] }}
        </h4>
        <p class="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate">
          {{ contact.address }}
        </p>
      </div>
    </div>

    <!-- ERP Deep Context Banner if Contractor -->
    <div v-if="isContractorMatch" class="mb-3 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60 text-xs">
      <div class="flex items-center gap-1.5 text-amber-800 dark:text-amber-200 font-bold mb-1">
        <UIcon name="i-heroicons-briefcase" class="w-3.5 h-3.5" />
        <span>ERP Contractor Identified</span>
      </div>
      <p class="text-[10px] text-amber-700 dark:text-amber-300 leading-tight">
        Contractor: <strong>RAJESH PATHAK</strong> • Site: <strong>RANGIA</strong>
      </p>
      <div class="mt-1.5 pt-1.5 border-t border-amber-200/60 dark:border-amber-800/60 flex items-center justify-between text-[10px]">
        <span class="text-amber-800 dark:text-amber-200 font-mono font-bold">Unsettled: ₹87,750.00</span>
        <NuxtLink to="/labor" class="font-bold text-primary-600 dark:text-primary-400 hover:underline">
          View Muster →
        </NuxtLink>
      </div>
    </div>

    <!-- Quick Action Buttons -->
    <div class="grid grid-cols-2 gap-1.5 pt-1 border-t border-slate-100 dark:border-slate-800">
      <UButton
        size="xs"
        color="primary"
        icon="i-heroicons-envelope"
        label="Send Email"
        class="justify-center font-semibold"
        @click="onSendMail"
      />
      <UButton
        size="xs"
        variant="outline"
        color="neutral"
        icon="i-heroicons-chat-bubble-left-right"
        label="Start Chat"
        to="/chat"
        class="justify-center font-semibold"
      />
    </div>
  </div>
</template>

