<template>
  <div class="p-4 py-3 w-full mx-auto space-y-3">
    <!-- Header Section -->
    <div class="flex justify-between items-center mb-2">
      <div class="flex items-center gap-3">
        <div class="p-2 bg-primary/10 rounded-xl">
          <UIcon name="i-heroicons-user-group" class="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 class="text-xl font-black tracking-tight uppercase text-gray-900 dark:text-white leading-none">Parties Hub</h1>
          <p class="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">Manage suppliers, customers, and business partners</p>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest px-2">
          Total: {{ parties.length }} Parties
        </span>
        <UButton
          color="primary"
          icon="i-heroicons-plus"
          size="sm"
          label="Create Party"
          class="font-semibold text-xs h-8"
          @click="showCreateModal = true"
        />
      </div>
    </div>

    <!-- Search & Filters Section -->
    <div class="bg-white dark:bg-zinc-900 p-2.5 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-800 mb-2 flex items-center justify-between gap-3">
      <div class="flex-1 max-w-xl">
        <UInput 
          v-model="searchQuery" 
          placeholder="Search by name, GSTIN, or PAN..." 
          icon="i-heroicons-magnifying-glass"
          size="sm"
          class="w-full" 
        />
      </div>
      <div class="w-48">
        <USelect 
          v-model="typeFilter" 
          :items="typeOptions" 
          placeholder="Select Type"
          size="sm"
          class="w-full" 
        />
      </div>
    </div>

    <!-- Loader -->
    <div v-if="loading" class="flex flex-col items-center justify-center py-24 gap-4 bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm">
      <UIcon name="i-heroicons-arrow-path" class="w-10 h-10 animate-spin text-primary" />
      <p class="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500">Loading parties...</p>
    </div>

    <!-- Parties Grid -->
    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      <UCard 
        v-for="party in filteredParties" 
        :key="party._id" 
        class="hover:border-primary-500 dark:hover:border-primary-400 transition-all flex flex-col border border-gray-100 dark:border-zinc-800 shadow-sm rounded-2xl" 
        :ui="{ 
          body: 'p-3 flex-1 flex flex-col space-y-2.5',
          header: 'p-3 py-2 bg-gradient-to-br from-primary-500/10 to-primary-600/10 border-b border-gray-100 dark:border-zinc-800/80',
          footer: 'p-2 px-3 bg-gray-50/50 dark:bg-zinc-800/30 border-t border-gray-100 dark:border-zinc-800 flex gap-2'
        }"
      >
        <template #header>
          <div class="flex items-start gap-3">
            <div class="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center font-bold text-lg backdrop-blur-md shrink-0">
              {{ party.name[0]?.toUpperCase() }}
            </div>
            <div class="flex-1 min-w-0">
              <h3 class="font-bold text-xs text-gray-900 dark:text-white truncate leading-none mt-1">{{ party.name }}</h3>
              <p class="text-[9px] text-gray-450 dark:text-zinc-500 truncate leading-none mt-1">{{ party.address || 'No address' }}</p>
            </div>
          </div>
        </template>

        <div class="flex-1 space-y-2 text-xs">
          <div>
            <p class="text-[8px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500 mb-0.5">GSTIN / Status</p>
            <div class="bg-gray-50 dark:bg-zinc-850 border border-gray-100 dark:border-zinc-800/40 rounded-lg px-2 py-1 flex items-center justify-between">
              <p class="font-bold text-gray-700 dark:text-zinc-300 text-[10px]">{{ party.gstin || 'UNREGISTERED' }}</p>
              <UBadge size="sm" variant="subtle" color="neutral" class="text-[8px] px-1.5 py-0 font-bold uppercase tracking-wider rounded-md">{{ party.partyType }}</UBadge>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <div class="bg-gray-50 dark:bg-zinc-850 rounded-lg p-1.5 border border-gray-100 dark:border-zinc-800/40">
              <p class="text-[8px] font-bold uppercase text-gray-400 dark:text-zinc-500 mb-0.5">State</p>
              <p class="font-bold text-gray-700 dark:text-zinc-300 text-[10px]">{{ party.state || '—' }}</p>
            </div>
            <div class="bg-gray-50 dark:bg-zinc-850 rounded-lg p-1.5 border border-gray-100 dark:border-zinc-800/40">
              <p class="text-[8px] font-bold uppercase text-gray-400 dark:text-zinc-500 mb-0.5">PAN</p>
              <p class="font-mono text-gray-600 dark:text-zinc-400 uppercase text-[10px]">{{ party.pan || '—' }}</p>
            </div>
          </div>
        </div>

        <template #footer>
          <UButton 
            size="xs" 
            color="primary" 
            label="Edit Details" 
            class="flex-1 font-bold text-[10px] h-7 cursor-pointer"
            @click="openEditParty(party)"
          />
        </template>
      </UCard>
      
      <div v-if="filteredParties.length === 0" class="col-span-full py-16 text-center bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm">
         <div class="w-12 h-12 bg-slate-50 dark:bg-zinc-850 rounded-full flex items-center justify-center mx-auto mb-2">
            <UIcon name="i-heroicons-user-group" class="w-6 h-6 text-slate-300 dark:text-zinc-500" />
         </div>
         <h3 class="text-slate-400 dark:text-zinc-500 text-xs font-black uppercase tracking-wider">No Parties Found</h3>
         <p class="text-slate-400 dark:text-zinc-550 text-[10px] mt-1">Try adjusting your search or filters</p>
      </div>
    </div>

    <!-- Modals -->
    <PartyModal 
      v-model="showCreateModal" 
      :initial-data="selectedParty" 
      @saved="fetchParties" 
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useBilling } from '@/composables/useBilling';
import PartyModal from '@/components/accounting/PartyModal.vue';

const { parties, fetchParties, loading } = useBilling();

const searchQuery = ref('');
const typeFilter = ref('ALL');
const showCreateModal = ref(false);
const selectedParty = ref<any>(null);

function openCreateParty() {
  selectedParty.value = null;
  showCreateModal.value = true;
}

function openEditParty(party: any) {
  selectedParty.value = party;
  showCreateModal.value = true;
}

const typeOptions = [
  { label: 'All Types', value: 'ALL' },
  { label: 'Customers', value: 'CUSTOMER' },
  { label: 'Suppliers', value: 'SUPPLIER' },
  { label: 'Both', value: 'BOTH' }
];

onMounted(() => {
  fetchParties();
});

const filteredParties = computed(() => {
  return parties.value.filter(p => {
    const matchesSearch = !searchQuery.value || 
      p.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      p.gstin?.toLowerCase().includes(searchQuery.value.toLowerCase());
    
    const matchesType = typeFilter.value === 'ALL' || !typeFilter.value || p.partyType === typeFilter.value;
    
    return matchesSearch && matchesType;
  });
});
</script>
