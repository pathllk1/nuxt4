<script setup lang="ts">
import { ref, computed } from 'vue';
import type { ChatMessage, ChatContact } from '../../types/chat';

const props = defineProps<{
  open: boolean;
  message?: ChatMessage | null;
  contacts: ChatContact[];
  loading?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:open', val: boolean): void;
  (e: 'confirm', targetUserIds: string[]): void;
}>();

const searchQuery = ref('');
const selectedContactIds = ref<string[]>([]);

const filteredContacts = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return props.contacts;
  return props.contacts.filter(c => 
    c.name.toLowerCase().includes(q) || 
    c.email.toLowerCase().includes(q) ||
    (c.primaryFirmName && c.primaryFirmName.toLowerCase().includes(q))
  );
});

const toggleSelect = (id: string) => {
  const idx = selectedContactIds.value.indexOf(id);
  if (idx > -1) {
    selectedContactIds.value.splice(idx, 1);
  } else {
    selectedContactIds.value.push(id);
  }
};

const handleConfirm = () => {
  if (selectedContactIds.value.length === 0) return;
  emit('confirm', [...selectedContactIds.value]);
  selectedContactIds.value = [];
  emit('update:open', false);
};

const handleClose = () => {
  selectedContactIds.value = [];
  emit('update:open', false);
};
</script>

<template>
  <UModal :open="open" @update:open="emit('update:open', $event)">
    <template #content>
      <div class="p-5 space-y-4 max-w-md w-full">
        <!-- Modal Header -->
        <div class="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-forward" class="w-5 h-5 text-teal-600 dark:text-teal-400" />
            <h3 class="font-bold text-base text-gray-900 dark:text-white">Forward Message</h3>
          </div>
          <button @click="handleClose" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <UIcon name="i-lucide-x" class="w-4 h-4" />
          </button>
        </div>

        <!-- Preview of original message -->
        <div v-if="message" class="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl text-xs border border-gray-200/60 dark:border-gray-700/60">
          <p class="font-semibold text-gray-500 dark:text-gray-400 text-[10px] mb-1 uppercase tracking-wider">
            Original message by {{ message.senderName || 'Sender' }}:
          </p>
          <p class="text-gray-800 dark:text-gray-200 line-clamp-3 italic">"{{ message.content }}"</p>
        </div>

        <!-- Contact Search -->
        <UInput 
          v-model="searchQuery" 
          icon="i-lucide-search" 
          placeholder="Search recipients..." 
          size="sm" 
          class="w-full"
        />

        <!-- Contacts Selection List -->
        <div class="max-h-56 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800/60 pr-1 space-y-1">
          <div 
            v-for="contact in filteredContacts" 
            :key="contact.id"
            @click="toggleSelect(contact.id)"
            class="flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors"
            :class="selectedContactIds.includes(contact.id) 
              ? 'bg-teal-50 dark:bg-teal-950/40 text-teal-900 dark:text-teal-100' 
              : 'hover:bg-gray-50 dark:hover:bg-gray-800/60 text-gray-700 dark:text-gray-300'"
          >
            <div class="flex items-center gap-2.5">
              <UAvatar :alt="contact.name" size="sm" class="bg-gradient-to-tr from-teal-500 to-indigo-500 text-white font-bold" />
              <div>
                <p class="text-xs font-semibold">{{ contact.name }}</p>
                <UBadge 
                  :color="contact.isOwnFirm ? 'neutral' : 'warning'" 
                  variant="subtle" 
                  size="xs"
                  class="text-[9px]"
                >
                  {{ contact.isOwnFirm ? 'Own Firm' : contact.primaryFirmName }}
                </UBadge>
              </div>
            </div>

            <!-- Checkbox Indicator -->
            <div 
              class="w-4 h-4 rounded border flex items-center justify-center transition-colors"
              :class="selectedContactIds.includes(contact.id)
                ? 'bg-teal-600 border-teal-600 text-white'
                : 'border-gray-300 dark:border-gray-600'"
            >
              <UIcon v-if="selectedContactIds.includes(contact.id)" name="i-lucide-check" class="w-3 h-3 font-bold" />
            </div>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="flex items-center justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
          <UButton 
            color="neutral" 
            variant="subtle" 
            size="sm" 
            @click="handleClose"
          >
            Cancel
          </UButton>
          <UButton 
            color="primary" 
            size="sm"
            class="bg-gradient-to-r from-teal-500 to-indigo-600 text-white"
            :disabled="selectedContactIds.length === 0"
            :loading="loading"
            @click="handleConfirm"
          >
            Forward to {{ selectedContactIds.length }} recipient{{ selectedContactIds.length > 1 ? 's' : '' }}
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
