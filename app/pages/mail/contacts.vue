<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useAuth } from '@/composables/useAuth';
import { useMail } from '@/composables/useMail';
import type { MailContact } from '@/types/mail';

definePageMeta({
  layout: 'default'
});

const { apiFetch } = useAuth();
const { openComposer } = useMail();

const contacts = ref<MailContact[]>([]);
const loading = ref(false);
const searchInput = ref('');
const selectedContact = ref<MailContact | null>(null);
const activeCategoryFilter = ref<string>('ALL');

const fetchContacts = async () => {
  loading.value = true;
  try {
    const q = searchInput.value ? `?search=${encodeURIComponent(searchInput.value)}` : '';
    const res: any = await apiFetch(`/api/mail/contacts${q}`);
    if (res?.success && Array.isArray(res.data)) {
      contacts.value = res.data;
      if (!selectedContact.value && contacts.value.length > 0) {
        selectedContact.value = contacts.value[0] || null;
      }
    }
  } catch (err: any) {
    console.warn('[Contacts] Fetch error:', err.message);
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  fetchContacts();
});

const filteredContacts = computed(() => {
  if (activeCategoryFilter.value === 'ALL') return contacts.value;
  if (activeCategoryFilter.value === 'FAVORITES') return contacts.value.filter(c => c.isFavorite);
  if (activeCategoryFilter.value === 'ERP') return contacts.value.filter(c => c.source === 'GAL_SYNC');
  if (activeCategoryFilter.value === 'PERSONAL') return contacts.value.filter(c => c.source !== 'GAL_SYNC');
  return contacts.value;
});

const onEmailContact = (contact: MailContact) => {
  openComposer({
    to: [contact.email],
    subject: ''
  });
  navigateTo('/mail');
};
</script>

<template>
  <div class="flex flex-col h-[calc(100vh-4rem)] w-full overflow-hidden bg-white dark:bg-slate-900 select-none">
    <!-- Top Bar -->
    <div class="h-14 border-b border-slate-200 dark:border-slate-800 px-4 flex items-center justify-between gap-4 shrink-0 bg-slate-50/50 dark:bg-slate-900/40">
      <div class="flex items-center gap-3">
        <NuxtLink
          to="/mail"
          class="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors"
          title="Back to Mail"
        >
          <UIcon name="i-heroicons-arrow-left" class="w-5 h-5" />
        </NuxtLink>
        <div class="flex items-center gap-2">
          <UIcon name="i-heroicons-user-group" class="w-5 h-5 text-indigo-500" />
          <h2 class="text-sm font-black text-slate-900 dark:text-white">People & Directory (Outlook Contacts)</h2>
        </div>
      </div>

      <div class="flex items-center gap-3">
        <UInput
          v-model="searchInput"
          icon="i-heroicons-magnifying-glass"
          placeholder="Search contacts..."
          size="xs"
          class="w-64"
          @input="fetchContacts"
        />
        <UButton
          size="xs"
          color="primary"
          icon="i-heroicons-user-plus"
          label="New Contact"
          class="font-bold px-3 shadow-xs"
        />
      </div>
    </div>

    <!-- Main 3-Pane People Workspace -->
    <div class="flex-1 flex overflow-hidden min-h-0">
      <!-- Left: Folder & Category Filter List -->
      <div class="w-56 border-r border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 p-3 space-y-1 shrink-0">
        <div class="px-2 py-1 text-[10px] font-black uppercase text-slate-400 tracking-wider">
          Address Books
        </div>

        <button
          class="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
          :class="activeCategoryFilter === 'ALL' ? 'bg-primary-50 dark:bg-primary-950 text-primary-700 dark:text-primary-300 font-bold' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/50'"
          @click="activeCategoryFilter = 'ALL'"
        >
          <div class="flex items-center gap-2">
            <UIcon name="i-heroicons-book-open" class="w-4 h-4" />
            <span>All Contacts</span>
          </div>
          <span class="font-mono text-[10px]">{{ contacts.length }}</span>
        </button>

        <button
          class="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
          :class="activeCategoryFilter === 'ERP' ? 'bg-primary-50 dark:bg-primary-950 text-primary-700 dark:text-primary-300 font-bold' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/50'"
          @click="activeCategoryFilter = 'ERP'"
        >
          <div class="flex items-center gap-2">
            <UIcon name="i-heroicons-building-office" class="w-4 h-4" />
            <span>Global Directory (GAL)</span>
          </div>
        </button>

        <button
          class="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
          :class="activeCategoryFilter === 'PERSONAL' ? 'bg-primary-50 dark:bg-primary-950 text-primary-700 dark:text-primary-300 font-bold' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/50'"
          @click="activeCategoryFilter = 'PERSONAL'"
        >
          <div class="flex items-center gap-2">
            <UIcon name="i-heroicons-user" class="w-4 h-4" />
            <span>Personal Contacts</span>
          </div>
        </button>

        <button
          class="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
          :class="activeCategoryFilter === 'FAVORITES' ? 'bg-primary-50 dark:bg-primary-950 text-primary-700 dark:text-primary-300 font-bold' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/50'"
          @click="activeCategoryFilter = 'FAVORITES'"
        >
          <div class="flex items-center gap-2">
            <UIcon name="i-heroicons-star" class="w-4 h-4 text-amber-500" />
            <span>Favorites</span>
          </div>
        </button>
      </div>

      <!-- Middle: Contact Cards Grid / List -->
      <div class="w-80 md:w-96 border-r border-slate-200 dark:border-slate-800 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 shrink-0">
        <div v-if="loading" class="p-8 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
          <UIcon name="i-heroicons-arrow-path" class="w-5 h-5 animate-spin text-primary-500" />
          <span>Loading address book...</span>
        </div>

        <div
          v-for="c in filteredContacts"
          :key="c.id"
          class="p-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition-colors"
          :class="selectedContact?.id === c.id ? 'bg-blue-50/80 dark:bg-blue-950/40 border-l-4 border-l-primary-500' : 'border-l-4 border-l-transparent'"
          @click="selectedContact = c"
        >
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-full bg-gradient-to-tr from-primary-500 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
              {{ (c.name || c.email).slice(0, 1).toUpperCase() }}
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex items-center justify-between gap-1">
                <p class="text-xs font-bold text-slate-900 dark:text-white truncate">
                  {{ c.name }}
                </p>
                <UBadge
                  v-if="c.source === 'GAL_SYNC'"
                  size="xs"
                  variant="subtle"
                  color="neutral"
                  class="text-[9px] font-mono px-1"
                >
                  GAL
                </UBadge>
              </div>
              <p class="text-[11px] text-slate-400 font-mono truncate">
                {{ c.email }}
              </p>
              <p v-if="c.company" class="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                {{ c.company }}
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Right: Detailed Profile View -->
      <div class="flex-1 bg-white dark:bg-slate-900 p-8 overflow-y-auto">
        <div v-if="!selectedContact" class="h-full flex flex-col items-center justify-center text-slate-400 text-xs">
          <UIcon name="i-heroicons-user" class="w-12 h-12 text-slate-300 dark:text-slate-700 mb-2" />
          <span>Select a contact to view full details</span>
        </div>

        <div v-else class="max-w-2xl space-y-6">
          <!-- Profile Header Card -->
          <div class="flex items-start justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-slate-50 via-indigo-50/30 to-slate-50 dark:from-slate-800/80 dark:to-slate-800/40 border border-slate-200 dark:border-slate-700 shadow-xs">
            <div class="flex items-center gap-4">
              <div class="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-500 to-primary-600 text-white flex items-center justify-center font-black text-2xl shadow-md">
                {{ (selectedContact.name || selectedContact.email).slice(0, 1).toUpperCase() }}
              </div>
              <div>
                <h2 class="text-lg font-black text-slate-900 dark:text-white">
                  {{ selectedContact.name }}
                </h2>
                <p class="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                  {{ selectedContact.email }}
                </p>
                <p v-if="selectedContact.company" class="text-xs font-semibold text-primary-600 dark:text-primary-400 mt-1">
                  {{ selectedContact.company }} • {{ selectedContact.jobTitle || 'Enterprise Associate' }}
                </p>
              </div>
            </div>

            <!-- Action Button -->
            <UButton
              color="primary"
              icon="i-heroicons-paper-airplane"
              label="Send Email"
              class="font-bold px-4 shadow-sm"
              @click="onEmailContact(selectedContact)"
            />
          </div>

          <!-- Contact Details Grid -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div class="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850">
              <p class="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-2">Contact Details</p>
              <div class="space-y-2 text-xs">
                <div class="flex items-center gap-2">
                  <UIcon name="i-heroicons-envelope" class="w-4 h-4 text-slate-400" />
                  <span class="font-mono text-slate-700 dark:text-slate-300">{{ selectedContact.email }}</span>
                </div>
                <div v-if="selectedContact.phone" class="flex items-center gap-2">
                  <UIcon name="i-heroicons-phone" class="w-4 h-4 text-slate-400" />
                  <span class="font-mono text-slate-700 dark:text-slate-300">{{ selectedContact.phone }}</span>
                </div>
              </div>
            </div>

            <div class="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850">
              <p class="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-2">Interaction Insights</p>
              <div class="space-y-2 text-xs text-slate-600 dark:text-slate-400">
                <p>Emails Exchanged: <strong class="font-mono text-slate-900 dark:text-white">{{ selectedContact.interactionStats?.sentCount || 0 }}</strong></p>
                <p>Frequency Weight: <strong class="font-mono text-emerald-600">{{ selectedContact.interactionStats?.frequencyScore || 1 }}</strong></p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

